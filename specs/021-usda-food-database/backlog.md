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
