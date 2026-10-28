# ADR-0036: Biblioteca de alimentos propios, favoritos y recientes del diario, con búsqueda tolerante a erratas

- **Estado:** Aceptada · 2026-10-27 (plan de la feature `028-diary-food-library`; revisada en la iteración 2 del plan,
  tras los hallazgos F1 a F8 de la review)
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
   (Iteración 2, F3.) El límite de 100 cuenta solo los favoritos **visibles**: los propios (el `CASCADE` impide que
   queden huérfanos) y los del catálogo cuyo alimento sigue en `catalog_foods`. El recuento lo hace el servicio con
   `list_by_user` y `get_by_ids` del catálogo, la misma regla que filtra la lista de favoritos. `DELETE` de un favorito
   del catálogo borra la fila aunque el alimento ya no esté en el catálogo; solo responde 404 si el id no es válido o no
   está ni en el catálogo ni en los favoritos del usuario.
4. **Recientes sin estado**: una consulta sobre `meal_items` y `meals` del usuario, con `row_number()` por alimento
   (`catalog_id`, `custom_food_id`) ordenado por `created_at` e `id` descendentes; solo cuentan los del catálogo que
   siguen en `catalog_foods` y los personalizados con `custom_food_id`.
5. **Búsqueda en memoria en dos pasadas** (extiende ADR-0031): primero las reglas de la 023 más el plural «-ces» → «z»;
   si nada coincide, una segunda pasada con distancia de edición de Damerau restringida (OSA) contra cada palabra y sus
   inicios (mínimo de la última fila de la tabla de programación dinámica), con tolerancia 0, 1 o 2 según la longitud de
   la forma. La búsqueda conjunta ordena catálogo y propios con la misma función (`rank_candidates`). Sin proveedores
   externos ni límite de uso.
   (Iteración 2, F4.) Como no hay límite de uso, el trabajo de la segunda pasada se acota de forma **determinista**, sin
   depender del tiempo ni de la máquina: las distancias se guardan en una memoria por pareja (forma, palabra) que vive
   lo que dura una búsqueda (`TypoDistances`), así cada pareja se calcula una vez y repetir palabras en la consulta no
   añade cálculos; las formas de menos de 4 caracteres se resuelven con `startswith` (su tolerancia es 0) y una palabra
   más corta que la forma menos su tolerancia se descarta sin calcular (la distancia no puede ser menor que la
   diferencia de longitudes). Con eso, cada búsqueda hace como mucho F × P cálculos (F, formas distintas de 4 o más
   caracteres de la consulta; P, palabras distintas de nombres y sinónimos). Un contador opcional (`TypoSearchStats`)
   que reciben las funciones puras y los dos servicios de búsqueda hace la cota observable en las pruebas; las rutas no
   lo usan. El resultado y el orden no cambian.
6. **Migración aditiva** que crea las dos tablas y la columna, y rellena la biblioteca desde los personalizados ya
   registrados (una clave por usuario y nombre, con los valores del registro más reciente por `created_at` e `id`). No
   aplica el límite de 500. Su `downgrade` quita la columna y las dos tablas (se pierden los favoritos; los alimentos
   propios se pueden regenerar con otro `upgrade`).
7. **Propuesta de foto sin `form.watch`**: la estructura sale de `fields` de `useFieldArray` (al día tras `append`,
   `update` y `remove`) y los gramos de `useWatch`, emparejados por una clave estable (`key`) de cada entrada; toda
   entrada nueva o sustituida recibe una clave nueva, así un valor obsoleto de `useWatch` nunca se aplica a otra fila.
   (Iteración 2, F6.) El formulario de la propuesta valida con su propio esquema, `proposalReviewSchema`, con `key`
   obligatoria y tipado como `z.ZodType<ProposalFormValues, ProposalFormValues>`, así `zodResolver` y `useForm` encajan
   sin forzar tipos (`as never`). (Iteración 3, F11.) Se retira `proposalFormSchema` (la 025, con `key` opcional), que
   ya solo usaban los tests; `proposalReviewSchema` es el único esquema de la propuesta.
   (Iteración 2, F7.) Si el usuario borra de su biblioteca, desde la búsqueda de la propuesta, un alimento propio que
   ya está en filas de esa propuesta, esas filas pierden el `customFoodId` y conservan nombre, valores, gramos y
   «Personalizado»; al guardar se envían con `name` y `per_100g` y `POST /api/meals` vuelve a crear el alimento propio.
8. **Deshacer** (ADR-0035): el token añade `cf` (el `custom_food_id`) solo cuando lo hay; al restaurar se vuelve a
   vincular si el alimento propio sigue en la biblioteca del usuario. Los tokens sin `cf` siguen siendo válidos.
9. **Confirmación de borrado en línea, no modal** (iteración 2, F1, F2 y F8; sustituye al `ConfirmDialog` con la prop
   `confirmContainer` que proponía la primera versión del plan). Un `AlertDialog` de Radix dentro del diálogo
   «Añadir a {sección}» o de la propuesta marca el resto como `aria-hidden` y oculta la búsqueda a los lectores de
   pantalla. La confirmación es un `role="alertdialog"` que se pinta **dentro del elemento de la lista** en que se pulsó
   «Borrar» (`LibraryFoodList` con `renderInline`). Escape: Radix escucha `keydown` en `document` en fase de captura,
   antes que React, así que un manejador del propio elemento no llega a tiempo; mientras la confirmación está abierta,
   el hook `useEscapeCapture` (`src/lib`) escucha en `window` en fase de captura, que va antes que `document`, detiene
   la propagación y cancela solo la confirmación. Así no cierra el diálogo de añadir ni abre la confirmación de
   descartar la propuesta (026), y no hace falta tocar `AddFoodDialog` ni `MealPhotoDialog`. Foco: al abrir, en
   «Cancelar»; al cancelar, con Escape o tras un borrado que falla (la confirmación se cierra y el error queda en el
   elemento), en el botón «Borrar» que la abrió; tras un borrado correcto, en la caja «Buscar alimento».
   (Iteración 3, F9.) La confirmación pertenece a la vista en que se abrió. Si cambia el texto de la caja, o si su
   alimento deja de mostrarse en esa lista, se cierra en silencio junto con su aviso de error, sin mover el foco (salvo
   que este haya quedado en el cuerpo de la página, en cuyo caso va a la caja). Así, al volver a mostrarse la lista,
   ni reaparece ni roba el foco. Con el borrado en curso no se cierra.

## Consecuencias
- (+) Sin tablas de estado derivadas: los recientes reflejan siempre el diario, incluso al quitar, deshacer o borrar.
- (+) Borrar un alimento propio no altera el historial; la base garantiza el `SET NULL` y la limpieza de favoritos.
- (+) La búsqueda tolerante no cambia el contrato de `GET /api/catalog/search` ni añade dependencias.
- (−) `POST /api/meals` hace más trabajo con personalizados (consulta de claves y, si hay nombres nuevos, un recuento).
- (+) Un favorito del catálogo que una carga quita no cuenta para el límite y se puede quitar; si el alimento vuelve
  sin haberlo quitado, reaparece aunque eso deje más de 100 visibles (marcar uno nuevo da el 400 hasta bajar de 100).
- (+) El coste de la segunda pasada tiene una cota determinista (F × P cálculos de distancia) que se comprueba en las
  pruebas con un contador, sin medir tiempos.
- (−) La segunda pasada sigue recorriendo en Python todo el catálogo y la biblioteca del usuario (unos 261 + 500
  alimentos como mucho); la cota limita los cálculos de distancia, no el recorrido.
- (−) El recuento de favoritos visibles lee todos los favoritos del usuario y consulta el catálogo por sus ids en cada
  `PUT`; con un máximo de unos cientos de filas por usuario es despreciable.
- (−) Mientras la confirmación de borrado está abierta, Escape no llega a ningún otro manejador de la página.
- (−) El `downgrade` pierde los favoritos.
