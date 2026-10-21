# Verify report 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Modo:** red (tras la etapa tests), repetición del red check acotado tras la corrección de `test_the_minimum_list_has_39_foods`
- **Fecha:** 2026-10-21T08:33:59.928Z · **Rama:** `feat/023-generic-food-catalog` @ `4685b3e` (con `backend/tests/test_services/test_food_catalog_csv.py` modificado sin commit) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ámbito tocado: `backend`. Los comandos `lint` (ratchet), `typecheck` y `build` no se ejecutan en modo red.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q -rfE tests/test_services/test_food_catalog_csv.py` (`backend`) | ✅ | 10 failed, 6 passed (16 casos). Los 10 fallos son `AssertionError` sobre contenido del CSV; ninguno es de sintaxis, fixture, import ni entorno. Los 6 pasan (guardas). |
| backend | Comprobación de cambios con `git status` y `git diff --stat` (raíz del repo) | ✅ | Entre los archivos de código, solo cambia `backend/tests/test_services/test_food_catalog_csv.py`. El resto de cambios son de `specs/023-generic-food-catalog/`. |

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
Tests nuevos o modificados de `test_food_catalog_csv.py` en esta ronda (10 en total):

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.4 | T-035 | `test_the_minimum_list_has_39_foods` | ✅ rojo legítimo: `assert 'yuca-cocida' not in {...}` (la fila sigue en el CSV) |
| REQ-001 | AC-001.1 | T-028 | `test_the_csv_has_fewer_than_265_foods` | ✅ rojo legítimo: `assert 265 < 265` |
| REQ-001 | AC-001.4 | T-028 | `test_there_is_no_yuca_row` | ✅ rojo legítimo: `yuca-cocida` presente |
| REQ-001 | AC-001.1 | T-028 | `test_no_row_has_the_manual_source` | ✅ rojo legítimo: `['yuca-cocida'] == []` |
| REQ-001 | AC-001.3 | T-028 | `test_no_synonym_is_a_brand_name` | ✅ rojo legítimo: `['pan-blanco', 'queso-crema'] == []` |
| REQ-001 | AC-001.3 | T-028 | `test_contramuslo_is_not_a_synonym_of_the_drumstick` | ✅ rojo legítimo: `['contramuslo de pollo'] == []` |
| REQ-001 | AC-001.3 | T-028 | `test_limonada_is_not_a_synonym_of_lemon_juice` | ✅ rojo legítimo: `['limonada sin azúcar'] == []` |
| REQ-001 | AC-001.2 | T-028 | `test_a_food_does_not_have_two_versions[zanahoria-zanahoria-cocida]` | ✅ rojo legítimo: coexisten ambas filas |
| REQ-001 | AC-001.2 | T-028 | `test_a_food_does_not_have_two_versions[champinones-champinones-cocidos]` | ✅ rojo legítimo: coexisten ambas filas |
| REQ-001 | AC-001.2 | T-028 | `test_a_food_does_not_have_two_versions[frijoles-blancos-cocidos-frijoles-navy-cocidos]` | ✅ rojo legítimo: coexisten ambas filas |

Guardas del archivo que pasan y no cambian (fuera del criterio de rojo): `test_the_repository_csv_validates_without_errors_and_has_250_to_350_foods`, `test_no_name_or_synonym_is_repeated_ignoring_case_and_accents`, `test_no_identifier_is_repeated`, `test_no_name_contains_a_forbidden_word`, `test_the_catalog_covers_the_minimum_list_by_name_or_synonym`, `test_every_manual_row_has_a_reference_and_every_usda_row_an_fdc_id`.

Comprobaciones adicionales:
- `MINIMUM_LIST` tiene 39 alimentos sin «Yuca cocida». El test ahora lee el CSV real y falla solo porque la fila `yuca-cocida` sigue presente, no por la constante del test.
- El CSV actual tiene 265 filas: 264 `usda` más `yuca-cocida` como `manual`.
- Solo cambia el archivo de test entre los de código respecto de la ronda anterior.

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-120, T-121, T-122, T-123 y T-125 (esperado en esta etapa, son tareas de datos pendientes)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (el archivo solo usa `pytest.mark.parametrize`)

## 3. Criterios de aceptación manuales
Los AC que los tests no pueden juzgar se dejan para la revisión del usuario:

- **REQ-001, reglas de contenido 1 a 3 de la sección 6 de la spec:** que cada alimento sea simple, que la versión cocida o cruda sea la correcta y que no haya preparaciones con aceite. Los tests solo comprueban formato, unicidad, límites, la lista mínima y las palabras prohibidas.

## 4. Fallos (si los hay)
Ninguno en modo red. Los 10 tests nuevos fallan por contenido del CSV (rojo legítimo) y el resultado es PASS. Los fallos de la ronda anterior (`test_the_minimum_list_has_39_foods` pasaba sin tocar el CSV) quedan resueltos.

Pendiente para la etapa implement (no bloquea esta ronda): los 9 fallos de contenido se corrigen con T-120 a T-123 y T-125.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |
