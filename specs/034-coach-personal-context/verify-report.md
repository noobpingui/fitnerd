# Verify report 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Modo:** red (tras la etapa tests, iteración 5 de la revisión 2: T-055 a T-066, con T-052 a T-054 como esqueletos)
- **Fecha:** 2026-11-03T05:53:47.387Z · **Rama:** `feat/034-coach-personal-context` @ `d3dbd53` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre `test_coach_personal_context.py`, `test_coach_service.py`, `test_coach_observability.py` y `test_coach_routes.py` (`backend`) | ✅ | 69 failed, 215 passed en 12,69 s. Los 69 fallos son tests nuevos o endurecidos de la revisión 2, todos en rojo legítimo. El único test de la revisión que pasa es la excepción F8 (ver abajo) |
| frontend | `npx vitest run` sobre `previousNames.test.ts`, `CoachPage.personalContext.test.tsx` y `PrivacyPolicyPage.test.tsx` (`frontend`) | ✅ | 19 failed, 34 passed de 53. Los 19 fallos son de la revisión 2, todos en rojo legítimo |
| backend | lint ratchet | — | No se ejecuta en modo red |
| frontend | `npm run lint`, `npx tsc -b`, `npm run build` | — | No se ejecutan en modo red |

Alcance: se ejecutaron los cuatro archivos de backend y los tres de frontend completos, y los fallos se filtraron a los tests nuevos o endurecidos de la revisión 2. Los 215 backend y 34 frontend que pasan incluyen los tests previos de la feature, que siguen en verde.

Clasificación de los 88 fallos de la revisión 2:
- Backend, 69 fallos: `NotImplementedError: not implemented` de los esqueletos `name_redaction_terms` y `parse_previous_names` (29); `TypeError` por el argumento nuevo `previous_names` de `ask`/`ask_with_feedback` o `other_names` de `redact_name` (13); aserciones de comportamiento nuevo (anonimizar partes del nombre, nombres anteriores, lista no válida ignorada, partículas, traza) (27). No hay errores de sintaxis, de fixtures, de configuración ni de imports fuera del plan.
- Frontend, 19 fallos: `not implemented` de `previousNames.ts` (12); texto de ayuda nuevo de F5 en el interruptor (4); `previous_names` ausente en el payload (2); frase nueva de Anthropic en la Política (1).

Esqueletos (B5.6): `parse_previous_names` y `name_redaction_terms` (`backend/services/coach_personal_context.py`, líneas 179 y 185) lanzan solo `raise NotImplementedError("not implemented")`, sin lógica. `rememberName` y `previousNamesFor` (`frontend/src/features/coach/previousNames.ts`) lanzan solo `throw new Error("not implemented")`. `previous_names?: string[]` en `frontend/src/features/coach/types.ts` es solo tipo. Las constantes `NAME_PARTICLES` (17), `MIN_NAME_PART_LETTERS`, `MAX_PREVIOUS_NAMES` y `MAX_NAME_LENGTH` son reales, como admite el plan §3.2.

Excepción declarada: `test_a_failing_read_with_the_context_on_gives_the_usual_503_without_calling_voyage_or_the_model` (`backend/tests/test_services/test_coach_service.py`, línea 562, marcador `REQ-012 AC-012.3`) pasa antes de implementar, como indica el plan §5 (F8). Su docstring lo declara. No cuenta como fallo. El test `test_a_failing_reader_gives_the_usual_503...` (línea 538, T-059) también pasa: solo cambia el docstring y es regresión existente.

Corrección verificada: `test_name_redaction_terms_removes_duplicates_ignoring_case_and_handles_empties`, `backend/tests/test_services/test_coach_personal_context.py` línea 994, ahora espera `name_redaction_terms("Ana María", ["María"]) == ["Ana María", "María", "Ana"]`. Coincide con el plan §3.3 (partes de 3 letras o más que no son partícula, sin duplicados con `casefold`, orden de más largo a más corto). El test sigue en rojo por `not implemented`, que es legítimo.

Revisión de expectativas frente al plan §3.3: se comprobaron las de `name_redaction_terms` (ejemplos de «María José», «María de la Paz», «Jo Ann», «José-Luis», «Mª José», «Carlos»/«Carlitos», «Ana», «Al»), las de `parse_previous_names` (listas válidas, `"<>"` que se omite tras sanear, y todas las listas no válidas que dan `()`), las de `redact_name` (palabra completa, partes, partículas en cualquier caso, una sola pasada y nombres anteriores) y las de la traza y la ruta. Ninguna contradice el plan §3.3. Las de `redact_name` que exigen anonimizar una parte (por ejemplo «Alto», «José») son el comportamiento nuevo del plan y no son errores de expectativa.

## 2. Trazabilidad
Abreviaturas: **P** = `backend/tests/test_services/test_coach_personal_context.py`; **S** = `backend/tests/test_services/test_coach_service.py`; **O** = `backend/tests/test_services/test_coach_observability.py`; **R** = `backend/tests/test_routes/test_coach_routes.py`; **F-PN** = `frontend/src/features/coach/previousNames.test.ts`; **F-CP** = `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`; **F-LEG** = `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`.

| REQ / NFR | AC | Tareas | Tests con `SDD: 034` | Estado del test (red) |
|---|---|---|---|---|
| NFR-003 | AC-N003.4 | T-055, T-060, T-061 | P (`test_redact_name_anonymizes_the_full_name_once_and_each_part_apart`, `test_name_redaction_terms_lists_…`), O (`test_compound_name_is_anonymized_part_by_part_end_to_end`), R (`test_a_compound_name_changed_in_the_profile_…`) | ❌ rojo legítimo (`not implemented`, `TypeError`, aserción) |
| NFR-003 | AC-N003.5 | T-055, T-060 | P (`test_redact_name_splits_a_hyphenated_name_into_parts`), O (`test_hyphenated_name_part_is_anonymized_in_the_trace`) | ❌ rojo legítimo (aserción) |
| NFR-003 | AC-N003.6 | T-055 | P (`test_redact_name_keeps_particles_…`, `test_redact_name_never_anonymizes_a_particle_on_its_own` ×17, `test_redact_name_particles_are_compared_ignoring_case`) | ❌ rojo legítimo (aserción) |
| NFR-003 | AC-N003.7 | T-055 | P (`test_redact_name_ignores_parts_of_less_than_three_letters`) | ❌ rojo legítimo (aserción) |
| NFR-003 | AC-N003.8 | T-055 | P (`test_redact_name_does_not_touch_words_that_only_contain_a_part`) | ❌ rojo legítimo (aserción) |
| REQ-013 | AC-013.3 | T-055, T-056, T-060, T-061 | P (`test_redact_name_also_anonymizes_the_previous_names`, `test_parse_previous_names_accepts_a_valid_list`), O (`test_a_previous_name_is_kept_out_of_the_trace_but_reaches_the_model` ×2), R (`test_previous_names_sent_over_http_are_kept_out_of_the_trace`) | ❌ rojo legítimo (`TypeError` por `previous_names`/`other_names`, `not implemented`, aserción) |
| REQ-013 | AC-013.4 | T-060 | O (`test_a_previous_name_is_kept_out_of_the_trace_but_reaches_the_model[False]`) | ❌ rojo legítimo (`TypeError`: `previous_names` ausente) |
| REQ-013 | AC-013.5 | T-057, T-060, T-061 | S (`test_previous_names_never_reach_the_model_the_block_or_the_search_text`), O (`test_a_previous_name_in_the_question_is_anonymized_but_never_replaces_the_name`), R (`test_a_previous_name_never_replaces_the_account_name_over_http`) | ❌ rojo legítimo (`TypeError` y aserción) |
| REQ-013 | AC-013.6 | T-056, T-060, T-061 | P (`test_parse_previous_names_ignores_an_invalid_list_entirely` ×14, `test_parse_previous_names_accepts_a_valid_list` ×6), O (`test_an_invalid_previous_names_list_is_ignored_entirely` ×4), R (`test_an_invalid_previous_names_list_is_ignored_and_a_valid_one_is_used`) | ❌ rojo legítimo (`not implemented`, `TypeError`, aserción) |
| REQ-013 | AC-013.1, AC-013.2 | T-062, T-065 | F-PN (12 tests), F-CP (`envía el nombre anterior solo cuando hay conversación y el nombre cambió`, `envía el nombre anterior también con el interruptor desactivado`) | ❌ rojo legítimo (`not implemented`; `previous_names` ausente) |
| REQ-010 | AC-010.7 | T-063, T-064 | F-CP (`al desactivarlo, el párrafo enlazado con aria-describedby tiene exactamente el texto nuevo`) | ❌ rojo legítimo (texto de ayuda nuevo) |
| REQ-010 | AC-010.8 | T-060, T-064 | O (`test_with_the_context_off_a_compound_name_in_the_history_is_kept_out_of_the_trace`), F-CP (`tras desactivarlo, el historial con el nombre y las cifras se reenvía idéntico y sin contexto`) | ❌ rojo legítimo (aserción sobre la traza y el texto de ayuda) |
| REQ-010 | AC-010.2, AC-010.5 (endurecidos por T-063) | T-063 | F-CP (`al desactivarlo cambia el texto…`, `tras desactivarlo y volver a montar…`) | ❌ rojo legítimo (texto de ayuda antiguo: `HELP_OFF` completo) |
| REQ-011 | AC-011.4 | T-066 | F-LEG (`el punto de Anthropic avisa de que los mensajes anteriores…`) | ❌ rojo legítimo (frase ausente en el punto de Anthropic) |
| REQ-012 | AC-012.3 | T-058 (regresión, excepción F8) | S (`test_a_failing_read_with_the_context_on_gives_the_usual_503_without_calling_voyage_or_the_model`) | ✅ pasa, excepción declarada en plan §5 |
| REQ-012 | AC-012.3 | T-059 (solo docstring) | S (`test_a_failing_reader_gives_the_usual_503_without_calling_voyage_or_the_model`) | ✅ pasa, regresión existente |

- AC sin test: — (todos los AC de la revisión 2 tienen marcador `SDD: 034`)
- REQ sin tarea: — (REQ-013 y AC-N003.4 a AC-N003.8 aparecen en `tasks.md`, T-055 a T-066)
- Tareas sin marcar `[x]`: — (T-052 a T-066 están marcadas; T-067 a T-074 son de implementación y se esperan sin marcar)
- `skip`, `xfail`, `.only` o equivalentes nuevos: no se ha buscado en esta etapa de red.

## 3. Criterios de aceptación manuales
— (no aplica en modo red)

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Los 88 tests nuevos o endurecidos de la revisión 2 que fallan lo hacen por comportamiento ausente. Los 2 que pasan son T-058 (F8, excepción declarada en plan §5) y T-059 (solo docstring, regresión existente). | — | — |

Notas (no son fallos):
- Working copy: `git diff` avisa de que cuatro archivos de test (`test_coach_personal_context.py`, `test_coach_service.py`, `CoachPage.personalContext.test.tsx` y `PrivacyPolicyPage.test.tsx`) tienen CRLF en el disco. Art. P5.1 exige LF en el repositorio. `.gitattributes` lo normaliza al hacer commit, pero conviene comprobarlo antes del commit de la etapa tests.
- El red check de la revisión 1 (T-043 a T-047) y todos los tests previos de la feature siguen en verde.
