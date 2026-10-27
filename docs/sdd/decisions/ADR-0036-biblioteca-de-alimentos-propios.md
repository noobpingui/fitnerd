# ADR-0036: Biblioteca de alimentos propios, favoritos y recientes del diario, con búsqueda tolerante a erratas

- **Estado:** Propuesta · 2026-10-27 (plan de la feature `028-diary-food-library`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de `review` (Art. P5.2).

## Contexto
La spec 028 pide que los alimentos personalizados se guarden por usuario para reutilizarlos (REQ-001 a REQ-005), una
lista de recientes (REQ-008), favoritos del catálogo y propios (REQ-009 y REQ-010) y una búsqueda conjunta en el
catálogo y en los propios, tolerante a erratas (REQ-006 y REQ-007). Hasta ahora:
- `meal_items` guarda una copia del nombre y de los valores por 100 g, sin clave foránea a `foods` ni a `catalog_foods`
  (ADR-0030 y ADR-0031), y un personalizado solo vive en su comida.
- El catálogo se busca en memoria con funciones puras (ADR-0031) y una carga posterior puede quitar alimentos que siguen
  registrados en comidas.
- Las escrituras del diario se serializan bloqueando la fila del usuario (ADR-0020 y ADR-0030).

La propuesta de foto (spec 025) lee los valores del formulario con `form.watch`, que el lint marca con
`react(incompatible-library)`; cambiarlo por `useWatch` dejaba los totales desactualizados tras `update()`.

Opciones consideradas para los recientes:
1. **Tabla propia de recientes**, actualizada en cada registro. Necesita mantenerla al quitar, deshacer o borrar
   comidas.
2. **Consulta sobre `meal_items`** con una función de ventana. Sin estado nuevo; refleja siempre lo que queda en el
   diario.

Opciones consideradas para el vínculo con el alimento propio:
1. Sin vínculo, buscando por nombre. No distingue un alimento propio borrado de uno nuevo con el mismo nombre.
2. **Columna `meal_items.custom_food_id`** con clave foránea `ON DELETE SET NULL`, conservando la copia de la 022.

## Decisión
1. **Alimentos propios** en `public.custom_foods` (id entero, `user_id`, `name`, `name_key`, cuatro valores por
   100 g, `created_at`, `updated_at`), con `UNIQUE (user_id, name_key)`. `name_key` es el nombre sin mayúsculas ni
   tildes (la misma `fold` del catálogo), sin espacios en los extremos y con los espacios repetidos como uno
   (`custom_food_name_key`). Registrar un personalizado con `name` crea o actualiza el alimento propio de la misma
   clave dentro de la transacción de `POST /api/meals`, con la fila del usuario bloqueada; el límite de 500 se comprueba
   antes de escribir. La restricción única es la red de seguridad ante peticiones simultáneas.
2. **Vínculo** `meal_items.custom_food_id` con `FOREIGN KEY … ON DELETE SET NULL` y una `CHECK` que solo lo admite en
   `source = 'custom'`. La copia del nombre y de los valores por 100 g se mantiene: borrar un alimento propio deja las
   comidas intactas y su `custom_food_id` en `null`. Es la primera clave foránea de `meal_items` hacia una tabla de
   alimentos; se admite porque el historial no depende de ella (el `SET NULL` no borra ni cambia la copia).
3. **Favoritos** en `public.food_favorites` con dos columnas excluyentes (`catalog_id` sin clave foránea, como en
   ADR-0031, para que un favorito del catálogo vuelva a aparecer si una carga lo devuelve; `custom_food_id` con
   `ON DELETE CASCADE`), una `CHECK` de exactamente una de las dos y una restricción única por usuario y alimento.
4. **Recientes sin estado**: una consulta sobre `meal_items` y `meals` del usuario, con `row_number()` por alimento
   (`catalog_id`, `custom_food_id`) ordenado por `created_at` e `id` descendentes; solo cuentan los del catálogo que
   siguen en `catalog_foods` y los personalizados con `custom_food_id`.
5. **Búsqueda en memoria en dos pasadas** (extiende ADR-0031): primero las reglas de la 023 más el plural «-ces» → «z»;
   si nada coincide, una segunda pasada con distancia de edición de Damerau restringida (OSA) contra cada palabra y sus
   inicios (mínimo de la última fila de la tabla de programación dinámica), con tolerancia 0, 1 o 2 según la longitud de
   la forma. La búsqueda conjunta ordena catálogo y propios con la misma función (`rank_candidates`). Sin proveedores
   externos ni límite de uso.
6. **Migración aditiva** que crea las dos tablas y la columna, y rellena la biblioteca desde los personalizados ya
   registrados (una clave por usuario y nombre, con los valores del registro más reciente por `created_at` e `id`). No
   aplica el límite de 500. Su `downgrade` quita la columna y las dos tablas (se pierden los favoritos; los alimentos
   propios se pueden regenerar con otro `upgrade`).
7. **Propuesta de foto sin `form.watch`**: la estructura sale de `fields` de `useFieldArray` (al día tras `append`,
   `update` y `remove`) y los gramos de `useWatch`, emparejados por una clave estable (`key`) de cada entrada; toda
   entrada nueva o sustituida recibe una clave nueva, así un valor obsoleto de `useWatch` nunca se aplica a otra fila.
8. **Deshacer** (ADR-0035): el token añade `cf` (el `custom_food_id`) solo cuando lo hay; al restaurar se vuelve a
   vincular si el alimento propio sigue en la biblioteca del usuario. Los tokens sin `cf` siguen siendo válidos.

## Consecuencias
- (+) Sin tablas de estado derivadas: los recientes reflejan siempre el diario, incluso al quitar, deshacer o borrar.
- (+) Borrar un alimento propio no altera el historial; la base garantiza el `SET NULL` y la limpieza de favoritos.
- (+) La búsqueda tolerante no cambia el contrato de `GET /api/catalog/search` ni añade dependencias.
- (−) `POST /api/meals` hace más trabajo con personalizados (consulta de claves y, si hay nombres nuevos, un recuento).
- (−) Un favorito del catálogo que una carga quita sigue contando para el límite de 100 sin verse, y no se puede quitar
  hasta que vuelva.
- (−) La tolerancia a erratas recorre en Python todo el catálogo y la biblioteca del usuario en la segunda pasada
  (unos 261 + 500 alimentos como mucho); suficiente para este volumen.
- (−) El `downgrade` pierde los favoritos.
