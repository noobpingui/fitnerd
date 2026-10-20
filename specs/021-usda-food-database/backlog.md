# Backlog · 021-usda-food-database

## spec · spec-writer
- [ ] FNDDS, si se confirma Q1.
- [ ] Validar a mano la calidad de la búsqueda en español con consultas reales; es un riesgo abierto del plan global.
- [ ] Medir cuánto ocupa la importación en Supabase (límite de 500 MB) y documentar en el runbook la ejecución en producción y la migración.
- [ ] Llevar la atribución a USDA a la página legal en la 022.

## spec · spec-writer (iteración con las respuestas del usuario)
- [ ] Decidir FNDDS en la 023 con el tamaño real medido tras esta importación.
- [ ] Calidad de las consultas en español sin traducción: se valida a mano con unas 20 consultas durante la verificación; si no es buena, pasa a la 022.
- [ ] Dónde enlazar «Alimentos» en la navegación y añadir la atribución a la página legal (022).
- [ ] Un parámetro para elegir el número de resultados, si la 022 lo necesita.

## plan · planner
- [ ] Calibrar `DEFAULT_MAX_DISTANCE`, y quizá pasar a lógica OR en el texto, según el resultado de la validación manual de las 20 consultas.
- [ ] Índice HNSW si se añaden FNDDS o Branded Foods.
- [ ] Volver a calcular todos los vectores si cambia `VOYAGE_EMBEDDING_MODEL`.
- [ ] Pausas o reintentos entre lotes de Voyage si los límites de uso hacen lenta la importación.
- [ ] `backend/scripts/**` no está en los globs de producción del ámbito `backend` de `.sdd/config.json`; valorar añadirlo.
- [ ] El `doc-keeper` debe documentar en `docs/deploy-runbook.md` los pasos de producción: copiar los CSV a EC2, `flask db upgrade`, `docker compose -f docker-compose.prod.yml run --rm -v <carpeta>:/data/usda:ro backend python -m scripts.import_usda_foods …` y medir el tamaño.

## tasks · task-breaker
- [ ] `backend/scripts/` no está en los globs de producción del ámbito `backend`, así que un hook podría bloquear T-054. Si pasa, el implementer lo informa (ya está anotado en los riesgos del plan).
- [ ] Los pasos manuales de producción (migración, importación, medición del tamaño de `public.foods`) quedan para el `doc-keeper` en `docs/deploy-runbook.md`; no hay tarea `docs` en este archivo.

## tests · implementer (scaffold)
- Sin puntos.

## tests · test-author
- [ ] Si el implementer cambia el formato de la «línea n» del error de CSV, hay que ajustar `test_non_numeric_amount_raises_an_error_with_the_line`.
- [ ] El repositorio real de búsqueda (texto con `websearch_to_tsquery` y similitud con pgvector) solo se prueba a través de las rutas con Postgres. No hay tests unitarios propios de `FoodRepository` más allá de los de importación y rutas.

## tests · verifier (red)
- [ ] Helper `ids_of` y los tests de ruta leen el cuerpo sin comprobar antes el código de estado; conviene una aserción de 200 antes para que el fallo sea claro (no bloquea).
- [ ] Los tests de `FoodsPage` muestran un único error "not implemented" en la salida de vitest (el componente lanza al renderizar); se verificó el conteo (24 fallos).

## tests · verifier (red, iteración 1)
- [ ] `foodsRoute.test.tsx` y `noFoodsLink.test.tsx`: parte de las aserciones lee el texto de `router.tsx`; válido como precondición en red, pero en verify las comprobaciones de comportamiento deben probar el AC.

## implement · implementer
- [ ] Medir el tamaño de `public.foods` y validar las 20 consultas manuales en verify, como pide el plan.
- [ ] Corregir los E501 de los tests de la feature (`test_food_search_service.py`, `test_usda_csv_reader.py`, `usda_samples.py`) si se quiere dejar el ratchet limpio.
- [ ] Subir la base de desarrollo a head antes de verify, para aplicar `flask db upgrade` en local.

## implement · implementer (T-054)
- [ ] Corregir las líneas de más de 100 caracteres (E501) en los tests del 021: `test_food_search_service.py`, `test_usda_csv_reader.py` y `usda_samples.py`, entre otros. Lo debe hacer quien pueda editar tests.
- [x] `import_usda_foods.py` imprime `FLASK_ENV` con valor por defecto `development`; `create_app()` cae a `default` = `DevelopmentConfig`, así que coinciden.

## verify · verifier (full)
- [ ] Desajuste modelo/migración: `backend/models/food.py` declara `search_vector` como `Mapped[str]` (NOT NULL por defecto) y la migración `c8e2a4f6b9d3` lo crea `nullable=True`. Es columna generada, sin impacto práctico, pero los tests no lo detectan (`create_all`).
- [ ] Aplicar la migración `c8e2a4f6b9d3` en la base de desarrollo y medir `public.foods` tras la importación (pasos manuales del plan).
- [ ] Validación manual de calidad de búsqueda (20 consultas, Q8) pendiente.
- [ ] `state.json`: `verify.result` sigue null porque la CLI registró el resultado en `stage_result`; la entrada history/result refleja FAIL.

## review · reviewer
- [ ] F2 (MENOR): la validación manual de las 20 consultas y la medición del tamaño de `public.foods` no se hicieron, y la migración no se ha aplicado en la base de desarrollo; el usuario debe hacerlo o diferirlo explícitamente antes de close y del despliegue en Supabase.
- [ ] F3 (MENOR): `food_import_service.py:125`, usar `zip(pending, vectors, strict=True)` para que la fase 2 no entre en un bucle infinito si Voyage devuelve menos vectores que textos.
- [ ] F4 (MENOR): `scripts/import_usda_foods.py:31-38`, pedir confirmación (o un `--yes`) antes de escribir cuando la base de destino no es local.
- [ ] F5 (NIT): `frontend/src/app/router.tsx:29`, quedó «const CoachPage =lazyNamed(» por un cambio sin querer; falta el espacio.
- [ ] F6 (NIT): `frontend/src/app/foodsRoute.test.tsx:113`, el marcador AC-012.1 no corresponde con lo que prueba el test (onboarding pendiente); bastaría con REQ-012.
