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
- [x] El `doc-keeper` debe documentar en `docs/deploy-runbook.md` los pasos de producción: copiar los CSV a EC2, `flask db upgrade`, `docker compose -f docker-compose.prod.yml run --rm -v <carpeta>:/data/usda:ro backend python -m scripts.import_usda_foods …` y medir el tamaño.

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
- [x] Desajuste modelo/migración: `backend/models/food.py` declara `search_vector` como `Mapped[str]` (NOT NULL por defecto) y la migración `c8e2a4f6b9d3` lo crea `nullable=True`. Es columna generada, sin impacto práctico, pero los tests no lo detectan (`create_all`).
- [ ] Aplicar la migración `c8e2a4f6b9d3` en la base de desarrollo y medir `public.foods` tras la importación (pasos manuales del plan).
- [ ] Validación manual de calidad de búsqueda (20 consultas, Q8) pendiente.
- [ ] `state.json`: `verify.result` sigue null porque la CLI registró el resultado en `stage_result`; la entrada history/result refleja FAIL.

## review · reviewer
- [x] F2 (MENOR): la validación manual de las 20 consultas y la medición del tamaño de `public.foods` no se hicieron, y la migración no se ha aplicado en la base de desarrollo; el usuario debe hacerlo o diferirlo explícitamente antes de close y del despliegue en Supabase.
- [ ] F3 (MENOR): `food_import_service.py:125`, usar `zip(pending, vectors, strict=True)` para que la fase 2 no entre en un bucle infinito si Voyage devuelve menos vectores que textos.
- [x] F4 (MENOR): `scripts/import_usda_foods.py:31-38`, pedir confirmación (o un `--yes`) antes de escribir cuando la base de destino no es local.
- [ ] F5 (NIT): `frontend/src/app/router.tsx:29`, quedó «const CoachPage =lazyNamed(» por un cambio sin querer; falta el espacio.
- [ ] F6 (NIT): `frontend/src/app/foodsRoute.test.tsx:113`, el marcador AC-012.1 no corresponde con lo que prueba el test (onboarding pendiente); bastaría con REQ-012.

## verify · verifier (full, tras review)
- [ ] El recuento de AC en `state.json` y en los resúmenes dice «60 AC»; `spec.md` tiene 61 identificadores AC (58 de REQ y 3 de NFR). Todos tienen test; solo hay que corregir el recuento en la documentación.
- [x] Documentar en `docs/deploy-runbook.md` el paso manual de la migración `c8e2a4f6b9d3` y de la importación (P4), en la etapa docs.
- [ ] Medir el tamaño de `public.foods` y ejecutar las 20 consultas manuales contra Voyage tras la importación real.

## review · reviewer (iteración 2)
- [ ] F7 (NIT): las notas de `spec` y `tasks` en `state.json` dicen «60 AC», pero `spec.md` tiene 61; usar la cifra correcta en la documentación de la etapa docs.

## implement · implementer (corrección de F4)
- [ ] Tests nuevos para `import_usda_foods.py` (test-author): (1) con host no local y sin `--yes`, responder «n» o EOF devuelve 1 y no llama al servicio; (2) con `--yes` o respondiendo «s», continúa; (3) con host localhost no pregunta. Los tests existentes usan una base local, así que no se ven afectados.

## review · validación manual de F2 (orquestador, 2026-10-20, base local `localhost:5433/fitnerd`)
- Migración: `flask db upgrade` aplicó `a7d3f9c1e5b2`, `e5b7d9f1a3c6` y `c8e2a4f6b9d3` sin errores (extensión `vector` presente; CHECK de correo canónico creados). Copia previa de la base local en el scratchpad (`backup/fitnerd_dev_pre021.dump`, ~940 kB).
- Importación real con los CSV oficiales: 469 Foundation + 7.793 SR Legacy = 8.262 alimentos, todos con vector; reimportación sin cambios en 4,6 s y sin llamadas a Voyage. Los ids de nutrientes del plan (1008, 2047, 2048, 1003, 1004, 1005) existen en los archivos reales.
- Tamaño de `public.foods`: 48 MB (tabla 2,8 MB, índices 2,1 MB, el resto TOAST de los vectores); base completa 58 MB. Cabe en los 500 MB de Supabase.
- Datos: SR Legacy completo; en Foundation faltan kcal en 91 de 469 alimentos, proteína en 44, carbohidratos en 92 y grasa en 56 (se guardan como «sin dato»).
- Consultas (22: 12 en español y 10 en inglés): sin errores ni listas vacías; en inglés y en español los alimentos comunes salen bien (huevo frito, aguacate, plátano maduro, queso fresco, frijoles negros, atún, leche entera). Ver problemas en los puntos siguientes.
- [x] «banana» (inglés) no devuelve «Bananas, raw» en los 20 primeros (salen Babyfood, Melon, Pepper); «banano» y «plátano» sí. Revisar el orden de los candidatos de texto antes de la 023.
- [ ] «avena cocida» no devuelve avena en los primeros 5 (sí «avena» sola y «oats cooked»); las consultas en español de varias palabras son más débiles.
- [ ] El umbral 0,6 filtra poco: «xyzzy qwerty» y «zapato de cuero» devuelven 1 resultado absurdo cada una. Probar 0,5 o menos.
- [x] Documentar en el runbook: los ZIP de USDA traen una carpeta anidada (`FoodData_Central_..._csv_AAAA-MM-DD/`) y el script debe apuntar a ella, no a la carpeta del ZIP.
- [x] En la consola de Windows los mensajes del script salen con la codificación rota (cp1252); funcionan con `PYTHONIOENCODING=utf-8`.

## tests · test-author (pasada F4 y ordenación de texto)
- [ ] La spec no tiene AC para la importación segura (confirmación con base no local y `--yes`). Conviene añadir un AC (p. ej. en REQ-001 o un REQ nuevo) y reetiquetar estos tests (hoy llevan `021 REQ-001`).
- [ ] La spec tampoco recoge el criterio de relevancia por longitud de descripción (normalizar `ts_rank_cd`). Conviene añadir un AC en REQ-006 (los tests de ordenación llevan hoy `021 REQ-006 AC-006.1`).

## review · reviewer (tercera pasada)
- [ ] F6 (NIT, test-author): `frontend/src/app/foodsRoute.test.tsx:113`, el marcador `AC-012.1` debería ser `REQ-012`.
- [ ] F7 (NIT): las notas de `state.json` dicen «60 AC» (spec.md tiene ahora 67), pero `spec.md` tiene 61; corregirlo en la documentación.
- [x] F8 (NIT, implementer): un túnel SSH a `localhost` se tomaría por base local y no preguntaría; advertirlo en el runbook o decidir también por `FLASK_ENV`.
- [x] F9 (MENOR, spec-writer): faltan los AC de la importación segura y del orden por longitud; añadirlos y reetiquetar los tests (hoy llevan `REQ-001` y `AC-006.1`).
- [x] F10 (NIT): marcar como hecho el punto «banana» (hecho por el orquestador).

## spec · spec-writer (corrección de F9)
- [ ] Volver a etiquetar los tests (test-author): `test_import_usda_foods_script.py` debe pasar de REQ-001 a los AC-001.8 a AC-001.12 y quitar el comentario de «sin AC propio»; `test_food_text_ranking.py` debe pasar de AC-006.1 a AC-006.10.
- [ ] Los tests no cubren las respuestas afirmativas «y» y «yes» del script (la spec las documenta porque el script las acepta).

## plan · planner (corrección de F9)
- [x] Al redactar el runbook, el doc-keeper debe confirmar si en producción se usa `--yes` o la confirmación interactiva (`docker compose run` es interactivo; `--yes` solo para ejecuciones no interactivas).
- [ ] Con `--yes` no se pide confirmación si se copia el comando a otro entorno.

## tests · test-author (reetiquetado, F9)
- [ ] Ampliar el texto de AC-001.8 para incluir «y» y «yes», que el script ya acepta y ahora tiene test.

## review · reviewer (cuarta pasada)
- [ ] F11 (MENOR, test-author): que el usuario confirme en el gate la excepción del red check de F4 y F9.
- [ ] F12 (NIT, spec-writer): AC-001.8 no enumera «y» ni «yes», aunque el test marcado con ese AC los prueba; añadirlos al AC.
- [ ] F7 (NIT): dejar una sola cifra de AC (67) en las notas y en la documentación de la etapa docs.
- Nota: la entrada de history de las 09:29:32 en `state.json` dice «tests: 2b53ca6» (es el commit de tasks); el commit de tests es `b8cd1af`.
