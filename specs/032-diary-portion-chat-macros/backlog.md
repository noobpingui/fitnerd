
## spec-writer (spec)
- [ ] Preseleccionar la comida según la hora del día.
- [ ] Botón «Añadir alimento» en cada respuesta de la conversación, no solo en la última.
- [ ] Buscar en el catálogo o en la biblioteca propia un alimento parecido antes de crear uno nuevo.
- [ ] Varios botones «Añadir alimento» con el mismo nombre accesible en la página (el del chat y los de cada sección): valorar un nombre accesible más específico.

## planner (plan)
- [ ] El contexto de ADR-0037 sigue mencionando los 150 tokens de la 030; lo anotaría, si se quiere, la sesión principal (P5.2).
- [ ] Deuda de la 030: `parse_grams` hace `Decimal.quantize` sin capturar `InvalidOperation`, así que un entero gigantesco del modelo en `grams` daría 500 en lugar de `unknown`.
- [ ] Más adelante se podría añadir `name` y `per_100g` a la salida de la traza de Langfuse (excluido en esta spec).
