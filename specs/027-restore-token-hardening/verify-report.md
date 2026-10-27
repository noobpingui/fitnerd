# Verify report 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Modo:** red (tras la etapa tests), iteración 3
- **Fecha:** 2026-10-27T06:55:49.268Z · **Rama:** `fix/027-restore-token-hardening` @ `02c325f` + cambios de tests sin commit · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q {files}` con `tests/test_services/test_secret_key_config.py tests/test_services/test_meal_rules.py tests/test_routes/test_meal_routes.py` (`backend`) | ❌ esperado (rojo legítimo) | 35 failed, 358 passed. Los 35 fallos son tests con marcador `SDD: 027`; todos por comportamiento ausente (ver §4). Los 358 pasados incluyen los tests de la 026 de esos archivos y las 27 guardas de regresión de la 027, todas con su comentario. |
| backend | Regresión de la 026 y de los tests que usan `make_app`: `tests/test_services/test_meal_service.py`, `tests/test_services/test_restore_token.py`, `tests/test_services/test_production_config.py`, `tests/test_routes/test_fixed_clock_routes.py`, `tests/test_routes/test_meal_analysis_routes.py`, `tests/test_routes/test_resend_email_routes.py`, `tests/test_routes/test_coach_feedback_routes.py` (`backend`) | ✅ | 240 passed. |
| backend | `lint_ratchet` | — | No aplica en modo red (se ejecuta en verify). |
| backend | `typecheck`, `build` | — | `null` en `backend`; no aplican. |

Solo se ejecutan los tests nuevos, los archivos que los contienen y la regresión de la 026 y de los tests con `make_app`. La suite completa no se ejecuta en modo red.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.5 | T-011, T-014 | `test_secret_key_config.py::test_resolve_rejects_in_production_*`, `::test_production_app_does_not_start_with_an_invalid_secret_key[*]` (9 casos) | ✅ rojo legítimo (`not implemented`, `DID NOT RAISE ValueError`) |
| REQ-001 | AC-001.6 | T-014 | `test_secret_key_config.py::test_production_app_does_not_start_when_both_variables_are_invalid` | ✅ pasa, guarda de la 020 |
| REQ-002 | AC-002.1, AC-002.2 | T-012, T-015 | `::test_resolve_returns_a_valid_production_key_unchanged[*]` (rojo, `not implemented`); `::test_production_app_starts_and_keeps_the_exact_secret_key[*]` (pasa, guarda de la 026) | ✅ |
| REQ-002 | AC-002.3 | T-023 | `test_meal_routes.py::test_undo_and_restore_work_in_a_production_app_with_its_own_secret_key` | ✅ pasa, guarda de la 026 |
| REQ-003 | AC-003.1 | T-013, T-015 | `::test_resolve_uses_the_default_when_not_required_and_missing` (rojo); `::test_development_app_starts_without_the_variable_with_the_default` (rojo, `None == 'DEFAULT SECRET'`) | ✅ rojo legítimo |
| REQ-003 | AC-003.2 | T-013, T-015 | `::test_resolve_keeps_the_value_when_not_required[*]` (rojo); `::test_development_app_starts_with_a_default_looking_value` (pasa, guarda de la 026) | ✅ |
| REQ-003 | AC-003.3 | T-015 | `::test_testing_app_starts_without_its_own_secret_key[None]`, `[DEFAULT SECRET]` | ✅ pasan, guarda de la 026 |
| REQ-004 | AC-004.1 | T-016 | `test_meal_rules.py::test_parse_snapshot_payload_rejects_version_1_0` (rojo); `::test_parse_snapshot_payload_rejects_version_true` (pasa, guarda de la 026) | ✅ |
| REQ-004 | AC-004.2 | T-016 | `::test_parse_snapshot_payload_still_rejects_other_versions[*]` (pasa, guarda de la 026); `::test_parse_snapshot_payload_rejects_version_true` | ✅ |
| REQ-004 | AC-004.3 | T-016 | `::test_parse_snapshot_payload_accepts_version_one_with_the_full_snapshot` (pasa, guarda de la 026); `test_meal_routes.py::test_restore_accepts_a_correctly_signed_token_with_a_valid_content` (pasa, guarda de la 026) | ✅ |
| REQ-004 | AC-004.4 | T-020 | `test_meal_routes.py::test_restore_rejects_a_signed_token_with_version_1_0` (`assert 200 == 404`) | ✅ rojo legítimo |
| REQ-005 | AC-005.1, AC-005.4 | T-017 | `test_meal_rules.py::test_parse_snapshot_payload_accepts_the_position_limits[0]` y `[2147483647]` (pasan, guarda de la 026) | ✅ |
| REQ-005 | AC-005.2 | T-017 | `::test_parse_snapshot_payload_rejects_a_position_beyond_the_database_range[2147483648]` y `[10**20]` | ✅ rojo legítimo |
| REQ-005 | AC-005.3 | T-017 | `::test_parse_snapshot_payload_still_rejects_other_invalid_positions[*]`, `::test_parse_snapshot_payload_rejects_a_position_of_1_0`, `::test_parse_snapshot_payload_rejects_a_position_of_true` (pasan, guarda de la 026) | ✅ |
| REQ-005 | AC-005.5 | T-021 | `test_meal_routes.py::test_restore_rejects_a_signed_token_with_a_position_beyond_the_integer_range` (`assert 500 == 404`, `DataError: integer out of range`) | ✅ rojo legítimo (el 500 es el defecto que corrige la spec) |
| REQ-006 | AC-006.1, AC-006.2 | T-018 | `test_meal_rules.py::test_parse_snapshot_payload_rejects_a_usda_id_out_of_range[2147483648]`, `[0]`, `[-5]` (rojo); `::test_parse_snapshot_payload_rejects_a_usda_id_of_1_0` (pasa, guarda de la 026) | ✅ |
| REQ-006 | AC-006.3, AC-006.4 | T-018 | `::test_parse_snapshot_payload_accepts_the_usda_id_limits[*]`, `::test_parse_snapshot_payload_accepts_catalog_and_custom_without_a_usda_id[*]` (pasan, guarda de la 026) | ✅ |
| REQ-006 | AC-006.5 | T-022 | `test_meal_routes.py::test_restore_rejects_a_signed_usda_token_with_an_id_beyond_the_integer_range` (`assert 500 == 404`) | ✅ rojo legítimo |
| NFR-001 | AC-N001.1 | T-019 | `test_meal_rules.py::test_snapshot_payload_round_trips_by_source_and_position[*]` (pasa, guarda de la 026) | ✅ |
| NFR-001 | AC-N001.2 | T-019 | `test_secret_key_config.py::test_restore_token_round_trip_still_works_with_the_026_signer` (pasa, guarda de la 026). Además, la suite de la 026 de `test_meal_service.py` y `test_restore_token.py` pasa en la regresión (§1) | ✅ marcador presente; ver observación 2 |
| NFR-002 | AC-N002.1 | T-010 | `test_secret_key_config.py::test_production_app_starts_in_tests_without_secret_key_in_the_environment` (pasa, guarda de la 020) | ✅ marcador presente; ver observación 3 |

- AC sin test con marcador: — (los 29 AC de la spec tienen al menos un marcador `SDD: 027`, comprobado con grep).
- REQ sin tarea: — (REQ-001 a REQ-006 y NFR-001 y NFR-002 aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: T-030, T-031, T-032 (fase B, implementación; se esperan sin marcar en modo red).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno.
- Monkeypatch o `unittest.mock` en los tests de la 027: ninguno (Art. P1.3).
- Guardas: todo test de la 027 que pasa sin implementación lleva encima del marcador el comentario `Guarda de regresión de la 0XX: pasa sin implementar la 027.`. Los 35 que fallan no lo necesitan.
- Esqueleto (Art. B5.6): `backend/config.py` añade solo constantes y `resolve_secret_key(_value, *, required)` con `raise NotImplementedError("not implemented")`, sin lógica ni valores de retorno.

## 3. Criterios de aceptación manuales
- Ninguno en esta etapa. Todos los AC son comprobables con tests de backend.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno bloqueante. Los 35 tests 027 que fallan lo hacen por comportamiento ausente (ver abajo). | — | ninguno |

Fallos legítimos (no son FAIL): los 35 tests 027 que fallan lo hacen por `NotImplementedError: not implemented` (esqueleto de `resolve_secret_key`), `DID NOT RAISE ValueError`, `AttributeError` por `SECRET_KEY_REQUIRED` ausente, `assert None == 'DEFAULT SECRET'`, `assert 200 == 404` y `assert 500 == 404` (el endpoint acepta el token o falla con `integer out of range` de la base). No hay errores de sintaxis, de fixture ni de import; todos los imports del plan existen.

Corrección de los fallos de la versión anterior de este informe:
- Fallo 1 (`monkeypatch.delenv`): corregido. El test `test_production_app_starts_in_tests_without_secret_key_in_the_environment` usa solo `make_app("production", FRONTEND_BASE_URL=PROD_URL)`, sin `monkeypatch`.
- Fallo 2 (marcador de AC-N001.2): corregido. Lo lleva `test_restore_token_round_trip_still_works_with_the_026_signer`, con guarda de la 026.

Valoración de la decisión de AC-N002.1 (sin override `SECRET_KEY=None`): es coherente con el plan y con la spec.
- La spec pide que los tests de producción de la 020 pasen sin `SECRET_KEY` en el entorno. Con la 027 implementada, `make_app("production", SECRET_KEY=None)` no arranca por diseño, así que el override `None` no puede expresar ese caso en producción.
- El plan (§1 y §5) hace que el fixture `make_app` aporte la clave propia de pruebas por defecto. Usar el fixture sin override es el mecanismo que el propio plan define y no requiere `monkeypatch` (Art. P1.3).
- El nombre del test es algo más fuerte que lo que comprueba: el fixture sobrescribe el entorno, así que el test prueba el valor por defecto del fixture, no la ausencia de la variable (ver observación 3).

Observaciones (no bloquean, van al backlog de la feature):
1. La nota DECISIONS del test-author no está en los artefactos de `specs/027-restore-token-hardening/` ni en el repositorio. La decisión de AC-N002.1 se ha valorado a partir del docstring del test y de `plan.md` §5.
2. AC-N001.2 pide que la suite de la 026 pase completa. El marcador está en un test nuevo que comprueba el firmante de la 026, no en la suite. La evidencia real es la regresión de `test_meal_service.py`, `test_restore_token.py` y de los archivos de rutas y reglas de la 026, que pasa (240 passed). La suite completa debe mantenerse en la etapa verify.
3. AC-N002.1 no se puede reproducir literalmente en local: `backend/.env` define `SECRET_KEY` y `config.py` lo carga con `load_dotenv()`. La evidencia real es que la suite de la 020 pase en CI, donde no hay `SECRET_KEY`. Pendiente de confirmar en la ejecución de CI (etapa verify o gate de review).
4. La firma del esqueleto usa `_value` sin anotaciones de tipo, frente a `value: str | None` del plan. Es cosmético y ya está en el backlog de la feature.
