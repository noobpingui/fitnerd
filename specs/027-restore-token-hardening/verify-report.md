# Verify report 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Modo:** full (etapa verify), iteración 2
- **Fecha:** 2026-10-27T07:05:07.450Z · **Rama:** `fix/027-restore-token-hardening` @ `39c9116` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2182 passed en 125,59 s (suite completa, incluidos los 35 tests de la 027 y la regresión de la 026). |
| backend | `lint_ratchet` (`node .../lint-ratchet.mjs backend`, desde la raíz) | ✅ | Sin violaciones nuevas respecto a main en los 7 archivos del ámbito. `test_meal_routes.py` tiene 0 violaciones previas y 0 nuevas. |
| backend | `lint` | — | `null` en `backend`; el ratchet lo sustituye. |
| backend | `typecheck`, `build` | — | `null` en `backend`; no aplican. |

Comprobación de la corrección de la iteración anterior: `ruff check --select I001 tests/test_routes/test_meal_routes.py` → «All checks passed!». El ítem 1 de FAILURES de la versión anterior (I001 en `test_meal_routes.py`, L8) queda resuelto en el commit `39c9116`.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.5 | T-011, T-014, T-030, T-031 | `backend/tests/test_services/test_secret_key_config.py`: `test_resolve_rejects_in_production_*`, `test_production_app_does_not_start_with_an_invalid_secret_key[*]` | ✅ pasan |
| REQ-001 | AC-001.6 | T-014, T-030, T-031 | `test_secret_key_config.py::test_production_app_does_not_start_when_both_variables_are_invalid` | ✅ pasa |
| REQ-002 | AC-002.1, AC-002.2 | T-012, T-015, T-030, T-031 | `test_secret_key_config.py::test_resolve_returns_a_valid_production_key_unchanged[*]`, `::test_production_app_starts_and_keeps_the_exact_secret_key[*]` | ✅ pasan |
| REQ-002 | AC-002.3 | T-023, T-030, T-031 | `backend/tests/test_routes/test_meal_routes.py::test_undo_and_restore_work_in_a_production_app_with_its_own_secret_key` | ✅ pasa |
| REQ-003 | AC-003.1, AC-003.2 | T-013, T-015, T-030, T-031 | `test_secret_key_config.py::test_resolve_uses_the_default_when_not_required_and_missing`, `::test_resolve_keeps_the_value_when_not_required[*]`, `::test_development_app_starts_*` | ✅ pasan |
| REQ-003 | AC-003.3 | T-015, T-030, T-031 | `test_secret_key_config.py::test_testing_app_starts_without_its_own_secret_key[*]` | ✅ pasa |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3 | T-016, T-032 | `backend/tests/test_services/test_meal_rules.py::test_parse_snapshot_payload_rejects_version_1_0`, `::test_parse_snapshot_payload_rejects_version_true`, `::test_parse_snapshot_payload_still_rejects_other_versions[*]`, `::test_parse_snapshot_payload_accepts_version_one_with_the_full_snapshot` | ✅ pasan |
| REQ-004 | AC-004.4 | T-020, T-032 | `test_meal_routes.py::test_restore_rejects_a_signed_token_with_version_1_0` | ✅ pasa |
| REQ-005 | AC-005.1, AC-005.4 | T-017, T-032 | `test_meal_rules.py::test_parse_snapshot_payload_accepts_the_position_limits[0]` y `[2147483647]` | ✅ pasan |
| REQ-005 | AC-005.2, AC-005.3 | T-017, T-032 | `test_meal_rules.py::test_parse_snapshot_payload_rejects_a_position_beyond_the_database_range[*]`, `::test_parse_snapshot_payload_still_rejects_other_invalid_positions[*]`, `::test_parse_snapshot_payload_rejects_a_position_of_1_0`, `::test_parse_snapshot_payload_rejects_a_position_of_true` | ✅ pasan |
| REQ-005 | AC-005.5 | T-021, T-032 | `test_meal_routes.py::test_restore_rejects_a_signed_token_with_a_position_beyond_the_integer_range` | ✅ pasa |
| REQ-006 | AC-006.1, AC-006.2 | T-018, T-032 | `test_meal_rules.py::test_parse_snapshot_payload_rejects_a_usda_id_out_of_range[*]`, `::test_parse_snapshot_payload_rejects_a_usda_id_of_1_0` | ✅ pasan |
| REQ-006 | AC-006.3, AC-006.4 | T-018, T-032 | `::test_parse_snapshot_payload_accepts_the_usda_id_limits[*]`, `::test_parse_snapshot_payload_accepts_catalog_and_custom_without_a_usda_id[*]` | ✅ pasan |
| REQ-006 | AC-006.5 | T-022, T-032 | `test_meal_routes.py::test_restore_rejects_a_signed_usda_token_with_an_id_beyond_the_integer_range` | ✅ pasa |
| NFR-001 | AC-N001.1 | T-019, T-032 | `test_meal_rules.py::test_snapshot_payload_round_trips_by_source_and_position[*]` | ✅ pasan |
| NFR-001 | AC-N001.2 | T-019, T-032 | `test_secret_key_config.py::test_restore_token_round_trip_still_works_with_the_026_signer`; suite completa en verde | ✅ pasa |
| NFR-002 | AC-N002.1 | T-010, T-030, T-031 | `test_secret_key_config.py::test_production_app_starts_in_tests_without_secret_key_in_the_environment` | ✅ pasa en local; ver observación 2 |

- AC sin test con marcador: — (los 29 AC de `spec.md` aparecen en al menos un marcador `SDD: 027`, comprobado con Grep).
- REQ sin tarea: — (REQ-001 a REQ-006, NFR-001 y NFR-002 aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: — (18 de 18 tareas marcadas `[x]`).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (revisado en `git diff main...HEAD -- backend`).
- Tests existentes debilitados o borrados: — (en `backend/tests/**` solo hay adiciones; el único cambio de import es `from datetime import datetime` → `datetime, timezone`).
- `monkeypatch` o `unittest.mock` en los tests nuevos: — (Art. P1.3).
- Migraciones: — (la spec no cambia modelos; no hay migración nueva).
- Secretos en el diff: — (sin cambios en `.env`; `SECRET_KEY` no aparece en `.github/`).
- Finales de línea: — (sin CRLF en el diff de `backend`, Art. P5.1).

## 3. Criterios de aceptación manuales
- Ninguno. Todos los AC de la 027 son comprobables con tests de backend.

## 4. Fallos (si los hay)
Ninguno.

## 5. Observaciones (no bloquean; van al backlog de la feature)
1. `test_production_app_starts_in_tests_without_secret_key_in_the_environment` (NFR-002) prueba el valor por defecto que aporta el fixture `make_app`, no la ausencia real de la variable en el entorno. El nombre es más fuerte que lo que comprueba.
2. AC-N002.1 pide ausencia de `SECRET_KEY` en el entorno, y `backend/.env` local la define (`load_dotenv()` en `config.py`). En local no se reproduce literalmente. El CI (`.github/`) no define `SECRET_KEY`, así que la suite de la 020 se ejecutará sin ella en GitHub Actions; eso solo se confirma con la ejecución de CI tras el push.
3. La firma del esqueleto usa `_value` sin anotaciones de tipo, frente a `value: str | None` del plan (cosmético).
4. Pendiente para la fase de cierre: anotar en el backlog del proyecto la longitud mínima de `SECRET_KEY` (Q3) y la validación de longitud de nombre, `catalog_id` y tipo de dato del token.

## 6. Veredicto
PASS. La suite completa del ámbito `backend` pasa (2182 passed), el ratchet de lint no tiene violaciones nuevas, la trazabilidad está completa (29 AC con marcador, REQ y NFR con tareas, 18 tareas `[x]`, sin skip/xfail nuevos) y el ítem de la iteración 1 queda corregido. El ámbito `frontend` no se ha tocado.
