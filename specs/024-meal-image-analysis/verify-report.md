# Verify report 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Modo:** red (tras la etapa tests, ronda de corrección F2–F9: tests T-060 a T-069)
- **Fecha:** 2026-10-21T20:56:41.000Z · **Rama:** `feat/024-meal-image-analysis` @ `97108e5` (HEAD; cambios de tests sin commit) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ámbito tocado: `backend` (único ámbito de `changed --json`). En modo red solo se ejecutan los tests nuevos; `lint`/ratchet, `typecheck` y `build` no se ejecutan en esta fase.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_services/test_gunicorn_config.py tests/test_services/test_meal_photo.py tests/test_services/test_vision_client.py tests/test_routes/test_meal_analysis_routes.py` (`backend`) | ⚠️ | 91 passed, 10 failed (los 10 fallos son rojo legítimo esperado, ver sección 4). Sin errores de colección ni de fixture. |
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre los 4 nodos de caracterización (`test_jpeg_with_an_unsupported_coding_process_is_unreadable`, `test_jpeg_without_a_scan_is_unreadable`, `test_request_body_over_4_mb_returns_413_in_spanish`, `test_request_body_under_4_mb_with_an_extra_file_is_analyzed`), `test_analyses_write_nothing_to_the_database` y `test_gunicorn_config.py` | ✅ | 7 passed (verificación individual de T-062, T-067, T-068 y T-069) |

Comprobación de `skip`, `xfail`, `.only`, `.skip` y `unittest.mock`/`monkeypatch` en las líneas añadidas del diff de tests: ninguna.

## 2. Trazabilidad
Alcance de esta ronda (modo red): solo los AC que cubren T-060 a T-069. El resto de la trazabilidad se comprobará en `verify` (full).

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-003 | AC-003.6 | T-060, T-061 | `test_meal_photo.py::test_webp_validation_does_not_decode_pixels` | ❌ rojo legítimo (pico de 36,2 MB frente a < 8 MB: se decodifica el WebP) |
| REQ-003 | AC-003.3 | T-062 | `test_meal_photo.py::test_jpeg_with_an_unsupported_coding_process_is_unreadable`, `test_meal_photo.py::test_jpeg_without_a_scan_is_unreadable` | ✅ caracterización (pasan) |
| REQ-010 | AC-010.1 | T-060, T-063 | `test_meal_photo.py::test_icc_profile_is_stripped[jpeg]` | ✅ caracterización (pasa) |
| REQ-010 | AC-010.1 | T-063 | `test_meal_photo.py::test_icc_profile_is_stripped[webp]` | ❌ rojo legítimo (el chunk `ICCP` sigue en la salida) |
| REQ-009 | AC-009.4 | T-064 | `test_vision_client.py::test_init_app_with_a_model_and_no_region_leaves_the_client_unconfigured[none|empty|blank]` (3 casos) | ❌ rojo legítimo (el cliente queda instanciado con región vacía) |
| REQ-009 | AC-009.4 | T-064 | `test_vision_client.py::test_init_app_survives_a_client_factory_that_fails` | ❌ rojo legítimo (`NoRegionError` escapa de `init_app`) |
| REQ-009 | AC-009.4 | T-065 | `test_meal_analysis_routes.py::test_app_with_an_empty_bedrock_region_starts_and_answers_503` | ❌ rojo legítimo (`create_app` falla con `ValueError: Invalid endpoint` al pasar región vacía) |
| REQ-009 | AC-009.2 | T-066 | `test_vision_client.py::test_tool_input_that_is_not_an_object_is_not_interpretable[str|list|int]` (3 casos) | ❌ rojo legítimo (`AttributeError` en `recognize_foods` en vez de `VisionProviderError`) |
| REQ-003 | AC-003.5 | T-067 | `test_meal_analysis_routes.py::test_request_body_over_4_mb_returns_413_in_spanish`, `test_request_body_under_4_mb_with_an_extra_file_is_analyzed` | ✅ pasan (corrección de test) |
| NFR-001 | AC-N001.1 | T-068 | `test_meal_analysis_routes.py::test_analyses_write_nothing_to_the_database` | ✅ pasa (refuerzo de test) |
| REQ-009 | AC-009.1 | T-069 | `test_gunicorn_config.py::test_gunicorn_timeout_exceeds_the_vision_provider_budget` | ✅ pasa (renombrado desde `test_server_timeout.py`) |

- AC sin test: — (en esta ronda; el resto se comprobará en `verify`)
- REQ sin tarea: — (en esta ronda)
- Tareas sin marcar `[x]`: T-070 a T-075 (implementación de la ronda, pendiente: esperado en esta fase)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: —
- Nota de estado: `backend/tests/test_services/test_server_timeout.py` figura como borrado en el índice (`git rm` autorizado por el usuario) y `test_gunicorn_config.py` es nuevo y sin añadir al índice; el snapshot de tests de `state.json` sigue sin regenerar.

## 3. Criterios de aceptación manuales
Ninguno en esta ronda. Los AC cubiertos son automáticos.

## 4. Fallos (si los hay)
Los 10 casos siguientes fallan por comportamiento ausente (rojo legítimo, esperado por las tareas T-070 a T-075). No son fallos del test ni de entorno.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | `test_webp_validation_does_not_decode_pixels` | `assert 36156515 < 8388608` | — (rojo legítimo, falta T-070) |
| 2 | `test_icc_profile_is_stripped[webp]` | `assert b'fitnerd-icc-device-model' not in b'RIFF…ICCP…'` | — (rojo legítimo, falta T-072) |
| 3–5 | `test_init_app_with_a_model_and_no_region_leaves_the_client_unconfigured[none|empty|blank]` | `assert vision.client is None` (queda un `FakeBedrockRuntimeClient`) | — (rojo legítimo, falta T-073) |
| 6 | `test_init_app_survives_a_client_factory_that_fails` | `botocore.exceptions.NoRegionError` escapa de `init_app` | — (rojo legítimo, falta T-073) |
| 7 | `test_app_with_an_empty_bedrock_region_starts_and_answers_503` | `create_app` → `init_app` → `ValueError: Invalid endpoint: https://bedrock-runtime..amazonaws.com` | — (rojo legítimo, falta T-073) |
| 8–10 | `test_tool_input_that_is_not_an_object_is_not_interpretable[str|list|int]` | `AttributeError: 'str' object has no attribute 'get'` en `recognize_foods` | — (rojo legítimo, falta T-074) |

Nota de clasificación: los casos 6, 7 y 8–10 provienen de excepciones lanzadas por el código de producción (no por el test ni por el fixture) en el punto exacto que las tareas T-073 y T-074 corrigen. Se clasifican como rojo legítimo porque la aserción esperada (no lanzar, `VisionProviderError`) es el comportamiento que falta.

Hallazgos de esta ronda: ninguno.
