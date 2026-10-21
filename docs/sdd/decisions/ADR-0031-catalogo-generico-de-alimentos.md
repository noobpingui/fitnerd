# ADR-0031: Catálogo genérico de alimentos en `catalog_foods`, con búsqueda por texto en memoria y carga que sincroniza desde un CSV

- **Estado:** Aceptada · 2026-10-21 (plan de `023-generic-food-catalog`; aceptada por el usuario en la review)
- **Decidido por:** el `planner`; revisada y aceptada por el usuario en el gate de `review`.

## Contexto
La spec 023 sustituye la búsqueda de USDA del diario (ADR-0029) por un catálogo propio de unos 300 alimentos simples,
con nombre en español, sinónimos regionales y un identificador estable que la spec 024 usará como lista cerrada. El
catálogo se edita en un CSV del repositorio y se carga a mano; los valores de los alimentos de origen `usda` deben ser
**idénticos** a los de `public.foods`. La búsqueda es solo por texto: cada palabra de la consulta debe ser el inicio de
una palabra del nombre o de un mismo sinónimo, sin distinguir mayúsculas, tildes, diéresis ni «ñ», con una regla
limitada de plurales (quitar «s» o «es» final si quedan al menos 3 caracteres) y un orden en tres grupos. Los alimentos
del catálogo registrados en comidas deben conservar su copia aunque el catálogo cambie (como ADR-0030).

Opciones consideradas:
1. **Dónde se busca:** en Postgres (extensión `unaccent`, `ILIKE` por palabra o `tsvector` con configuración `simple`),
   frente a leer el catálogo completo (como mucho 350 filas) y filtrar y ordenar en Python con una función pura.
2. **Identificador:** entero o UUID, frente a un texto legible y estable (`arroz-blanco-cocido`) como clave primaria.
3. **Sinónimos:** tabla hija, frente a una columna `TEXT[]`.
4. **Carga:** solo añadir y actualizar (como la importación de USDA), frente a sincronizar (añadir, actualizar y
   **borrar** lo que ya no está en el archivo).
5. **Relación con `foods` y con `meal_items`:** claves foráneas, frente a guardar `fdc_id` y `catalog_id` como dato
   informativo y validar en la carga.

## Decisión
- Tabla nueva `public.catalog_foods` con `id VARCHAR(60)` (el identificador del CSV) como clave primaria, `name`,
  `synonyms TEXT[]`, los cuatro valores por 100 g (`DOUBLE PRECISION NOT NULL`), `source` (`usda` o `manual`),
  `fdc_id` y `reference`. Restricciones `CHECK` de formato del identificador, longitudes, rangos y coherencia del
  origen; la suma de macros y la unicidad de nombres y sinónimos (sin mayúsculas ni tildes) las valida la carga, no la
  base (una `CHECK` sobre la suma en `float` podría rechazar 33,3 + 33,3 + 33,4, y una única `UNIQUE (name)` no
  cubre tildes ni sinónimos y estorbaría al intercambiar nombres dentro de una misma carga).
- Sin clave foránea de `catalog_foods.fdc_id` a `foods` ni de `meal_items.catalog_id` a `catalog_foods`: el catálogo
  podrá vivir sin la base de USDA cuando se retire (backlog) y el historial no depende del catálogo.
- **Búsqueda en memoria:** `CatalogSearchService` lee todo el catálogo por el repositorio y lo filtra y ordena con
  funciones puras (`services/catalog_rules.py` para normalizar con `unicodedata` y `services/catalog_search_service.py`
  para coincidir y ordenar). No se llama a Voyage ni a Redis, no hay límite de uso y no hace falta ninguna extensión
  nueva de Postgres.
- **Carga que sincroniza:** `CatalogLoadService` valida el CSV completo (formato, unicidad y valores frente a
  `public.foods`) antes de escribir y después, en una sola transacción, añade, actualiza y borra para dejar la tabla
  igual al archivo. Borrar es seguro porque los alimentos registrados guardan su copia.
- `meal_items` gana `catalog_id VARCHAR(60) NULL` y el origen `catalog`; sus `CHECK` de origen se sustituyen por unas
  que admiten las tres clases (`catalog`, `usda`, `custom`) con sus campos coherentes.
- La confirmación `[s/N]` ante una base no local se extrae a `scripts/database_target.py` y la comparten la importación
  de USDA y la carga del catálogo.

## Consecuencias
- Cada búsqueda lee como mucho 350 filas pequeñas; si el catálogo creciera mucho (miles de alimentos), habría que pasar
  la coincidencia a Postgres. Queda anotado en el backlog.
- La regla de búsqueda se prueba entera sin base de datos, con dobles del repositorio.
- Los identificadores no deben cambiar entre cargas: cambiar uno en el CSV equivale a borrar un alimento y crear otro.
- La migración altera las `CHECK` de `meal_items` (sin tocar datos) y crea `catalog_foods`; su `downgrade` se niega a
  ejecutarse si hay alimentos del catálogo registrados en comidas, para no perderlos en silencio.
- La igualdad exacta con USDA solo se puede comprobar contra una base con USDA cargado: los tests prueban la regla con
  datos sembrados, y la validación del CSV real se hace ejecutando la carga contra la base de desarrollo.
