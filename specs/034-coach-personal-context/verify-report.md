# Verify report 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Modo:** red (tras la etapa tests, iteración 4 de 5: tests de la corrección de review, T-043 a T-047, sin el caso `[True]`)
- **Fecha:** 2026-11-03T04:17:25.963Z · **Rama:** `feat/034-coach-personal-context` @ `5c8d54e` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -v -k "<nombres de T-043 a T-046>" tests/test_services/test_coach_personal_context.py tests/test_services/test_coach_service.py tests/test_services/test_coach_observability.py` (`backend`) | ✅ (rojo legítimo) | 18 tests nuevos seleccionados (colección verificada: 18/175): 18 failed, 0 passed. 11 `test_read_first_name_*` con `NotImplementedError: not implemented`; 4 `test_parse_client_context_discards_a_text_ending_in_a_line_break` con aserción (devuelve contexto en vez de `None`); `test_with_the_context_off_only_the_first_name_is_read_for_the_trace` (`name_calls == []`); `test_a_failing_reader_gives_the_usual_503_without_calling_voyage_or_the_model` (`DID NOT RAISE`); `test_with_the_context_off_the_history_name_is_still_kept_out_of_the_trace` («Carlos» en la traza) |
| frontend | `npx vitest run src/features/legal/pages/PrivacyPolicyPage.test.tsx -t "3 de noviembre"` (`frontend`) | ✅ (rojo legítimo) | 1 test nuevo (T-047) de 20 seleccionado: 1 failed, 19 skipped. Aserción: la página muestra «Última actualización: 27 de octubre de 2026» |

Solo se ejecutaron los tests nuevos de la corrección (T-043 a T-047). Los demás tests de la feature ya estaban en verde por la implementación previa y no cuentan para este red check. No se ejecutaron `lint_ratchet`, `typecheck` ni `build`: en modo red no aplican.

Comprobación del caso retirado: el test de 503 con contexto activado (`[True]`) ya no está parametrizado en `backend/tests/test_services/test_coach_service.py` (línea 539 sin `@pytest.mark.parametrize`), así que no entra en el red check.

## 2. Trazabilidad (tests nuevos del red check)
| REQ / NFR | AC | Tareas | Tests con `SDD: 034` | Estado del test |
|---|---|---|---|---|
| NFR-003, NFR-004 | AC-N003.1, AC-N004.1 | T-043 | `backend/tests/test_services/test_coach_personal_context.py`: `test_read_first_name_*` (11 casos) | ✅ rojo legítimo (`NotImplementedError: not implemented`, esqueleto sin lógica) |
| REQ-010, REQ-012 | AC-010.4, AC-012.3 | T-044 | `backend/tests/test_services/test_coach_service.py::test_with_the_context_off_only_the_first_name_is_read_for_the_trace` | ✅ rojo legítimo (aserción: `name_calls == []`, el servicio no llama a `read_first_name`) |
| REQ-012 | AC-012.3 | T-044 | `backend/tests/test_services/test_coach_service.py::test_a_failing_reader_gives_the_usual_503_without_calling_voyage_or_the_model` | ✅ rojo legítimo (`DID NOT RAISE ServiceUnavailableError`) |
| NFR-003, REQ-010 | AC-N003.1, AC-010.4 | T-045 | `backend/tests/test_services/test_coach_observability.py::test_with_the_context_off_the_history_name_is_still_kept_out_of_the_trace` | ✅ rojo legítimo (aserción: «Carlos» presente en la traza) |
| REQ-006, REQ-003 | AC-006.2 | T-046 | `backend/tests/test_services/test_coach_personal_context.py::test_parse_client_context_discards_a_text_ending_in_a_line_break[weight|weight_change_30d|rate|bmi]` (4 casos) | ✅ rojo legítimo (aserción: devuelve `ClientCoachContext` en vez de `None`) |
| REQ-011 | — | T-047 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx::la última actualización es la del 3 de noviembre de 2026 y ya no la del 27 de octubre` | ✅ rojo legítimo (aserción: sigue «27 de octubre de 2026») |

- Esqueleto `read_first_name` (T-042): su cuerpo solo contiene `raise NotImplementedError("not implemented")` (`backend/services/coach_personal_context.py`, línea 197-198), sin lógica ni valor de retorno. ✅
- Observación: el marcador de T-047 es `SDD: 034 REQ-011` sin AC. Los AC-011.1 a AC-011.3 tienen cobertura en otros tests del mismo archivo (T-025). No bloquea.
- Trazabilidad completa de la feature y tareas `[x]`: no se comprueban en modo red.

## 3. Criterios de aceptación manuales
No aplica en modo red.

## 4. Fallos (si los hay)
Ninguno. El caso que bloqueaba la iteración anterior (`test_a_failing_reader_gives_the_usual_503_without_calling_voyage_or_the_model[True]`) ya no existe. Los 19 tests nuevos fallan por comportamiento ausente.

Resultado: PASS. Iteración de tests: 4 de 5.
