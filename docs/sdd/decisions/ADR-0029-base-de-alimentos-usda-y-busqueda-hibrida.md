# ADR-0029: Base de alimentos de USDA en Postgres con búsqueda híbrida por fusión de rankings

- **Estado:** Propuesta · 2026-10-20 (plan de `021-usda-food-database`)
- **Decidido por:** el `planner`; pendiente de revisión por el usuario en el gate de `review`.

## Contexto
La spec 021 carga Foundation Foods y SR Legacy de USDA FoodData Central (unos 8 200 alimentos) en la base de la app y
expone `GET /api/foods/search?q=` con búsqueda híbrida: coincidencia de texto con la descripción (en inglés y muy
técnica) y similitud de significado, para que consultas en español como «pechuga de pollo» encuentren alimentos sin
compartir palabras. Las specs 022 y 023 referirán los alimentos por su FDC ID. La importación se ejecuta a mano, como el
pipeline RAG, y debe poder reanudarse si Voyage falla. El plan gratuito de Supabase tiene 500 MB.

Opciones consideradas:
1. **Clave primaria:** `fdc_id` natural frente a un UUID propio con `fdc_id` único. El FDC ID es estable entre versiones
   de USDA y es lo que la 022 guardará; un UUID solo añadiría una indirección.
2. **Texto:** columna `tsvector` generada (`to_tsvector('english', description)`) con índice GIN, frente a `pg_trgm`
   (otra extensión) o `ILIKE` (sin ranking ni índice útil).
3. **Fusión:** Reciprocal Rank Fusion (RRF) sobre dos listas de candidatos, frente a una suma ponderada de
   `ts_rank` y distancia coseno (escalas no comparables, pesos difíciles de calibrar).
4. **Índice vectorial:** HNSW frente a búsqueda exacta. Con unos 8 200 vectores, la exacta es rápida y no pierde
   resultados por el filtro de distancia; HNSW añadiría unos 35 MB.
5. **Texto que se vectoriza:** la descripción original de USDA frente a una versión «limpia» o traducida.

## Decisión
- Tabla `public.foods` con `fdc_id` como clave primaria natural, descripción original, `data_type`
  (`foundation` | `sr_legacy`, con `CHECK`), cuatro nutrientes por 100 g nulos si no hay dato, `embedding vector(1024)`
  nulo y `search_vector tsvector` **generada** con la configuración `english` e índice GIN. Sin índice vectorial.
- La representación semántica es la de la **descripción original**, con el mismo cliente y modelo de Voyage que el coach
  (`utils/embeddings.py`, `input_type="document"` al importar y `"query"` al buscar).
- La búsqueda vive en `FoodSearchService`: valida la consulta, aplica el límite de uso de Redis, pide el vector de la
  consulta (si falla, 503), pide al repositorio hasta 40 candidatos por texto (`websearch_to_tsquery('english', q)`,
  ordenados por `ts_rank_cd` con **normalización 2**, que divide por la longitud del documento para que una descripción
  corta y exacta como «Bananas, raw» no quede detrás de descripciones largas que solo mencionan la palabra) y hasta 40
  por similitud (distancia coseno ≤ 0,6), y los fusiona con RRF
  (`k = 60`, puntuación = Σ 1/(k + posición)), devolviendo los 20 primeros. Con 40 candidatos por lista y `k = 60`, un
  alimento presente en las dos listas siempre supera a uno presente solo en una.
- La importación (`FoodImportService`, invocada por `backend/scripts/import_usda_foods.py`) tiene dos fases: (1) lee y
  valida **todos** los CSV antes de escribir y guarda los alimentos en una sola transacción; si una descripción cambia,
  su vector se borra; (2) calcula los vectores de todos los alimentos sin vector, por lotes de 128, con un commit por
  lote, y se detiene en el primer fallo de Voyage. La siguiente ejecución completa los pendientes.
- Antes de escribir, el script muestra el entorno y la base sin contraseña y, si el host de la base **no es local**,
  pide confirmación `[s/N]` salvo que se pase `--yes`. Son locales solo `localhost`, `127.0.0.1`, `::1` y `postgres`
  (sin distinguir mayúsculas); una URL sin host o con otro host cuenta como no local. Sin entrada interactiva, la
  respuesta es «no».

## Consecuencias
- (+) Los alimentos sin vector siguen apareciendo por texto, y reanudar la importación es volver a ejecutarla.
- (+) La fusión es lógica pura en el servicio, probable sin Postgres; el repositorio solo hace dos consultas simples.
- (+) Tamaño estimado de unos 40 MB (vectores de 4 KB por alimento), lejos del límite de Supabase.
- (−) `websearch_to_tsquery` exige todas las palabras: las consultas largas o en español dependen de la similitud.
  La calidad se valida a mano en la verificación (Q8 de la spec).
- (+) Una importación lanzada por error contra Supabase desde local se detiene en la confirmación.
- (−) El orden por texto favorece las descripciones cortas; si eso perjudica a alguna consulta, se ajusta en la 022.
- (−) Con `--yes` no hay confirmación: entonces solo protege que el script muestre la base antes de escribir. Por eso
  `--yes` no debe figurar como comando por defecto en el runbook.
- (−) El umbral de distancia (0,6) es un punto de partida; cambiarlo es un cambio de código.
- (−) Si cambia `VOYAGE_EMBEDDING_MODEL`, hay que volver a calcular todos los vectores (igual que en el coach).
- (−) Si los alimentos crecen mucho (FNDDS, Branded), habrá que reconsiderar un índice HNSW.
