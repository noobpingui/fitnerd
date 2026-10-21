# Verify report 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Modo:** red (tras la etapa tests), corrección acotada a esta ronda
- **Fecha:** 2026-10-21T09:00:14.584Z · **Rama:** `feat/023-generic-food-catalog` @ `a66dcf8` (con cambios sin commit en los dos archivos de test) · **Base:** `main`
- **Resultado:** PASS (alcance: los dos archivos de esta ronda)

## 1. Comandos ejecutados
Ámbitos tocados: `backend`, `frontend`. Solo se ejecutan los tests de los dos archivos de esta ronda; no se reejecuta el resto de la suite de tests nuevos de la feature.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_services/test_food_catalog_csv.py` (`backend`) | ❌ (1 fallo esperado) | 15 passed, 1 failed. El fallo es `test_the_iceberg_lettuce_row_is_named_iceberg_and_keeps_repollada_as_synonym`: `assert 'Lechuga repollada' == 'Lechuga iceberg'` (fila `fdc_id` 2346388 aún con el nombre antiguo, pendiente de T-126). Rojo legítimo por contenido ausente. |
| frontend | `npx vitest run src/features/legal/pages/TermsOfServicePage.test.tsx` (`frontend`) | ❌ (1 fallo esperado) | 5 passed, 1 failed. El fallo es «Datos nutricionales» mantiene la atribución… : la sección aún contiene «Algunos alimentos de comida local se añadieron a mano…» (`TermsOfServicePage.tsx:33-34`, pendiente de T-138). Rojo legítimo por contenido ausente. |

Comprobaciones adicionales:
- **Clasificación del rojo:** los dos fallos son aserciones sobre contenido (nombre de la fila y texto de la página). No hay errores de sintaxis, de fixture, de configuración ni de import.
- **Tests nuevos o modificados que pasan hoy (no cuentan como rojo):**
  - `test_every_manual_row_declares_its_reference` sustituye a `test_no_row_has_the_manual_source`. Es una relajación (admite filas `manual` con referencia) y pasa porque el CSV no tiene filas `manual`.
  - Se eliminó `test_the_csv_has_fewer_than_265_foods`. Su cobertura de AC-001.1 la mantienen `test_the_repository_csv_validates_without_errors_and_has_250_to_350_foods` y `test_every_manual_row_has_a_reference_and_every_usda_row_an_fdc_id`.
  - Los marcadores de `test_no_synonym_is_a_brand_name`, `test_contramuslo_is_not_a_synonym_of_the_drumstick` y `test_limonada_is_not_a_synonym_of_lemon_juice` pasan de AC-001.3 a AC-001.2. Son reetiquetados, no tests nuevos.
  - En `TermsOfServicePage.test.tsx`, la prueba «Datos nutricionales» pasa de exigir la frase a exigir su ausencia, y conserva la atribución y el aviso de valores aproximados. Es un test reescrito (guarda la atribución) y su parte nueva es la que falla.
- **Tests que pasaban antes y no cambiaron en esta ronda (guardas, excluidos):** el resto de los tests de `test_food_catalog_csv.py` y de `TermsOfServicePage.test.tsx` (incluida la fecha «21 de octubre de 2026», el voseo y «No es asesoría médica»).
- **Diff de los dos archivos (`git diff`):** no se añaden `skip`, `xfail`, `.only` ni `.skip`.
- **Cobertura de AC:** los 67 AC de `spec.md` tienen al menos un marcador `SDD:` en `backend/tests` y `frontend/src` (67/67, sin pérdida frente a la ronda anterior). AC-001.1, AC-001.3 y AC-012.1 siguen cubiertos por tests de estos archivos (AC-001.1 por el test de 250–350 filas y el de filas `manual`; AC-001.3 por los tests de palabras prohibidas y de «dos versiones»).

## 2. Trazabilidad
Solo se listan los AC que tocan los tests de esta ronda. El resto se verifica en la etapa verify.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.2 | T-028, T-036; T-120 a T-123, T-126 | `backend/tests/test_services/test_food_catalog_csv.py::test_the_iceberg_lettuce_row_is_named_iceberg_and_keeps_repollada_as_synonym` | ❌ rojo legítimo (esperado) |
| REQ-001 | AC-001.2 | T-036 | `test_food_catalog_csv.py::test_no_synonym_is_a_brand_name`, `::test_contramuslo_is_not_a_synonym_of_the_drumstick`, `::test_limonada_is_not_a_synonym_of_lemon_juice` | ✅ (reetiquetados, guardas) |
| REQ-001 | AC-001.1 | T-036 | `test_food_catalog_csv.py::test_every_manual_row_declares_its_reference` | ✅ (relajación, pasa hoy) |
| REQ-001 | AC-001.3 | T-036 | `test_food_catalog_csv.py::test_no_name_contains_a_forbidden_word`, `::test_a_food_does_not_have_two_versions` | ✅ (guardas) |
| REQ-012 | AC-012.1 | T-049, T-138 | `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx` («Datos nutricionales» mantiene la atribución… sin la frase de alimentos añadidos a mano) | ❌ rojo legítimo (esperado) |
| REQ-012 | AC-012.3 | T-049 | `TermsOfServicePage.test.tsx` («la última actualización es la del 21 de octubre de 2026») | ✅ (guarda) |

- AC sin test: — (67 de 67 con marcador `SDD:`)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: no se comprueba en modo red. Quedan sin marcar T-126 y T-127 (lechuga iceberg y su recarga) y T-138 (frase de Términos), que son las implementaciones que hacen pasar los dos tests en rojo.
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff de los dos archivos: —

## 3. Criterios de aceptación manuales
No aplica en modo red.

## 4. Fallos (si los hay)
Ninguno. Los dos tests en rojo son el rojo esperado de esta ronda, no fallos de la comprobación.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |
