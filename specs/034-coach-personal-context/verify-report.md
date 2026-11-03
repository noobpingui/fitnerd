# Verify report 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-11-03T03:45:15.410Z · **Rama:** `feat/034-coach-personal-context` @ `f1cc059` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre `tests/test_services/test_coach_personal_context.py`, `tests/test_services/test_coach_service.py`, `tests/test_services/test_coach_observability.py` y `tests/test_routes/test_coach_routes.py` (`backend`) | ✅ rojo legítimo | 149 failed, 47 passed. Los 47 pasados son tests anteriores a la feature, sin marcador `SDD: 034`. Ningún test nuevo pasa. Errores de fixture, sintaxis o import: ninguno. |
| frontend | `npx vitest run` sobre `src/features/coach/personalContext.test.ts`, `src/features/coach/personalContextPreference.test.ts`, `src/features/coach/pages/CoachPage.personalContext.test.tsx` y `src/features/legal/pages/PrivacyPolicyPage.test.tsx` (`frontend`) | ✅ rojo legítimo | 36 failed, 16 passed. Los 16 pasados son de `PrivacyPolicyPage.test.tsx`, anteriores a la feature y sin marcador. Ningún test nuevo pasa. |
| backend | lint_ratchet | — | No se ejecuta en modo red. |
| frontend | `npm run lint`, `npx tsc -b`, `npm run build` | — | No se ejecutan en modo red. |

Notas sobre el rojo:
- Backend: 89 `NotImplementedError: not implemented` (esqueletos de `coach_personal_context.py`), 19 `TypeError` por el kwarg `personal_context_reader` ausente en `CoachService.__init__` (previsto en tasks, A0), y aserciones sobre el bloque «Nombre: …», «Meta: …» y «Objetivo diario: …» que aún no llegan al modelo. Los `ERROR` del log de `coach_service` son los fallos simulados que los tests provocan a propósito, no errores de entorno.
- Frontend: 15 `Error: not implemented` (`personalContext.ts`, `personalContextPreference.ts`, `hooks.ts`, `switch.tsx`, `PersonalContextToggle.tsx`), 5 `Unable to find ... role "switch"` y 6 esperas que agotan el tiempo de `waitFor` sin petición con contexto (`expected undefined to be defined`), además de 4 aserciones de texto en la Política de privacidad.

## 2. Trazabilidad
Parcial, en modo red: solo se comprueba que cada tests nuevo falle y que cada AC tenga marcador.

| REQ / NFR | AC | Tareas | Tests con `SDD: 034` | Estado del test |
|---|---|---|---|---|
| REQ-010 | AC-010.4 | T-014 | `backend/tests/test_services/test_coach_service.py::test_without_a_reader_the_service_behaves_as_before` | ✅ falla (kwarg ausente y comportamiento nuevo) |
| REQ-010 | AC-010.4 | T-019 | `backend/tests/test_routes/test_coach_routes.py::test_with_the_context_off_the_model_receives_no_personal_data` [False, no, 0] | ✅ falla (aserción de conservación seguida de la aserción nueva) |
| REQ-012 | AC-012.1 | T-020 | `backend/tests/test_routes/test_coach_routes.py::test_asking_without_a_session_returns_401` | ✅ falla en la aserción de contexto personal, tras pasar el 401 |
| REQ-012 | AC-012.4 | T-020 | `backend/tests/test_routes/test_coach_routes.py::test_the_answer_carries_a_feedback_id_that_can_be_rated` | ✅ falla en la aserción de contexto personal |
| REQ-012 | AC-012.5 | T-020 | `backend/tests/test_routes/test_coach_routes.py::test_an_invalid_question_gets_400_even_with_valid_personal_data` [empty, 501-characters] | ✅ falla (kwarg ausente / aserción de contexto) |
| REQ-012 | AC-012.2 | T-016 | `backend/tests/test_routes/test_coach_routes.py::test_with_20_questions_in_the_last_hour_the_next_one_is_429_without_calling_providers` | ✅ falla en la aserción de contexto personal |
| REQ-012 | AC-012.3 | T-016 | `backend/tests/test_routes/test_coach_routes.py::test_a_model_failure_gets_503_with_the_current_message` | ✅ falla en la aserción de contexto personal |
| NFR-002 | AC-N002.1 | T-015 | `backend/tests/test_routes/test_coach_routes.py::test_voyage_only_receives_the_question` | ✅ falla en la aserción de contexto personal |
| REQ-010 | AC-010.1 | T-022 | `frontend/src/features/coach/personalContextPreference.test.ts` › «la clave de almacenamiento es fitnerd_coach_personal_context» | ✅ falla (`not implemented`) |
| REQ-011 | AC-011.1 | T-025 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` › «el punto de Anthropic menciona el nombre, el perfil, las macros y el progreso, y que se puede desactivar en el coach» | ✅ falla (texto nuevo ausente) |
| REQ-011 | AC-011.2 | T-025 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` › «el punto de Langfuse añade el perfil, las macros y el progreso y sigue diciendo que nunca se envían el email ni el nombre» | ✅ falla (texto nuevo ausente) |
| REQ-011 | AC-011.3 | T-025 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` › «el punto de Voyage AI sigue diciendo que recibe el texto de las preguntas y no menciona el perfil ni el progreso» | ✅ falla (`not implemented` / texto ausente) |
| REQ-011 | AC-011.1 | T-025 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` › «sigue sin formas de voseo tras añadir el texto del contexto personal» | ✅ falla (texto nuevo ausente) |

Cruce de AC: los 55 AC de `spec.md` aparecen en al menos un marcador `SDD: 034`.

- AC sin test: —
- REQ sin tarea: no comprobado en modo red
- Tareas sin marcar `[x]`: no comprobado en modo red (T-001 a T-025 están marcadas; T-026 a T-041 pendientes, como corresponde)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: ninguno (comprobado con grep sobre el diff y los archivos de test nuevos)

Esqueletos (Art. B5.6): ✅ `backend/services/coach_personal_context.py` (todas las funciones lanzan `NotImplementedError("not implemented")`; el `__init__` de `CoachPersonalContextReader` solo guarda dependencias), `backend/services/coach_service.py` (solo `DONT_KNOW_ANSWER` real y `build_coach_user_message` con `_`-prefijos y `not implemented`), `frontend/src/components/ui/switch.tsx`, `frontend/src/features/coach/personalContext.ts`, `frontend/src/features/coach/personalContextPreference.ts` (constante de clave real; el resto, `not implemented`), `frontend/src/features/coach/hooks.ts` y `frontend/src/features/coach/components/PersonalContextToggle.tsx`. Sin lógica.

## 3. Criterios de aceptación manuales
Ninguno en modo red. En modo full conviene revisar en navegador el interruptor de `/coach` (AC-010.1, AC-010.2) y el texto de la Política de privacidad (AC-011.1 a AC-011.3), porque los tests solo comprueban el texto y no el aspecto.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Todos los tests nuevos con `SDD: 034` fallan por comportamiento ausente. | — | ninguno |

Iteración 2 (red): la iteración 1 dejaba 14 tests nuevos en verde sin implementación (11 de backend y 3 de frontend). Tras reformularlos, ninguno pasa. Los tests de conservación (401, 429, 503, 400, `feedback_id`, contexto desactivado) ahora fallan en su aserción de contexto personal, y siguen fallando por comportamiento ausente.
