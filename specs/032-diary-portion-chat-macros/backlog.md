
## spec-writer (spec)
- [ ] Preseleccionar la comida según la hora del día.
- [ ] Botón «Añadir alimento» en cada respuesta de la conversación, no solo en la última.
- [ ] Buscar en el catálogo o en la biblioteca propia un alimento parecido antes de crear uno nuevo.
- [ ] Varios botones «Añadir alimento» con el mismo nombre accesible en la página (el del chat y los de cada sección): valorar un nombre accesible más específico.

## planner (plan)
- [x] El contexto de ADR-0037 sigue mencionando los 150 tokens de la 030; lo anotaría, si se quiere, la sesión principal (P5.2).
- [ ] Deuda de la 030: `parse_grams` hace `Decimal.quantize` sin capturar `InvalidOperation`, así que un entero gigantesco del modelo en `grams` daría 500 en lugar de `unknown`.
- [ ] Más adelante se podría añadir `name` y `per_100g` a la salida de la traza de Langfuse (excluido en esta spec).

## test-author (tests)
- [x] El ADR-0037 sigue citando 150 tokens (lo anota la sesión principal, Art. P5.2).
- [ ] Los nombres de algunos tests de la 031 que mencionan «cinco claves» o el límite de 150 siguen describiendo la 030. No cambia su validez.
- [ ] Revisar en la review: el test-author escribió `test_portion_estimate_rules.py` con un script de Python desde Bash y marcó casillas de `tasks.md` con `sed` (el hook no lo bloqueó).

## test-author (tests, iteración 2)
- [ ] Revisar en la review: el test-author editó tests con scripts de Python desde la shell (solo archivos de tests, dentro de los globs permitidos).

## verifier (tests, red)
- [ ] Confirmar en implement/review que el cambio de contrato de los tres tests de ruta existentes (name y per_100g en la respuesta) está cubierto por REQ-001 y REQ-004.

## implementer (implement)
- [x] Anotar en ADR-0037 (lo hace la sesión principal) que el máximo de tokens pasó de 150 a 250.
- [ ] Revisar en Langfuse tras desplegar si hay respuestas cortadas por `max_tokens` (`stop_reason` en `step.end`).

## verifier (verify)
- [ ] Normalizar a LF los archivos comprometidos con CRLF (Art. P5.1), tarea del repo, no de esta feature.
- [ ] Revisión visual manual en navegador de la posición del botón «Añadir alimento» (AC-006.2) y del diálogo en móvil.

## reviewer (review)
- [ ] F1 (MENOR, test-author): escribió tests con scripts de Python desde Bash y marcó tasks.md con sed (Art. B2.4); en adelante, solo Write/Edit.
- [ ] F2 (NIT, test-author): 4 archivos de test en CRLF en la copia de trabajo (en LF en el índice); normalizarlos.
- [ ] F3 (NIT, implementer): el nombre se recorta a 100 puntos de código en el backend y maxLength/zod cuentan unidades UTF-16 en el frontend; afecta a nombres con emojis cerca del límite.
- [ ] F4 (NIT, implementer, deuda de la 030): parse_grams no captura InvalidOperation; un entero como 10**30 en grams daría 500 en lugar de unknown.
- [ ] Revisión visual en el navegador de la posición del botón «Añadir alimento» (AC-006.2) y del diálogo en móvil.

## usuario (revisión visual)
- [x] Revisión visual en el navegador de AC-006.2 y del diálogo: el usuario confirmó que se ve y funciona bien (2026-11-01).

## doc-keeper (docs)
- [x] Corregir en ADR-0037 el límite de tokens (150 a 250) cuando el usuario apruebe editarla.
