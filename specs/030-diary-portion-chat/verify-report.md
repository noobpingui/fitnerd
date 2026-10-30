# Verify report 030 — Chat de porciones del diario (backend)

- **Modo:** full (etapa verify, tras el rework desde review: iteración 2, T-025 a T-041)
- **Fecha:** 2026-10-30T09:05:09.082Z · **Rama:** `feat/030-diary-portion-chat` @ `7fc3615` (HEAD) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
<!-- Una fila por comando declarado en `scopes.<ámbito>.commands` de la config, solo de los ámbitos tocados.
     Los comandos a null no se ejecutan ni se listan. -->
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`), suite completa | ✅ | `2839 passed in 178.79s`, código de salida 0 |
| backend | Misma suite, con un plugin de sesión que bloquea toda conexión saliente que no sea loopback (`-p netguard`) | ✅ | `2839 passed in 177.65s`, código de salida 0. Hosts no locales intentados: ninguno (Anthropic, Voyage, Redis remoto… 0 intentos). |
| backend | `node .../lint-ratchet.mjs backend` (ratchet ruff, desde la raíz del repo) | ✅ | `sin violaciones nuevas respecto a main. OK` (15 ficheros tocados, todos OK) |

Comandos a `null` en `scopes.backend`, no ejecutados ni listados: `lint`, `typecheck`, `build`.

Verificación de red: ninguna ejecución llama a Anthropic. El módulo `test_coach_routes.py` sustituye `anthropic.Anthropic` por un doble que lanza `AssertionError` si se usa `messages.create`, y todos los tests de porciones usan `FakeStructuredLLMClient` o `FakeLLMClient`. La ejecución con el bloqueo de red no registró ningún intento de conexión fuera de loopback (Postgres `localhost:5433` y Redis en local).

Recuento de AC: la spec tiene **42 AC en total** (37 de REQ-001 a REQ-011 y 5 de NFR-001 a NFR-003), no 47. Los 5 AC de NFR ya están dentro de los 42.

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` (`backend/…::test`) | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-008, T-012, T-016 | `tests/test_routes/test_portion_estimate_routes.py::test_valid_question_returns_the_exact_estimation`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_returns_the_estimation_for_valid_food`<br>`tests/test_services/test_portion_estimate_service.py::test_estimate_returns_the_estimation_for_valid_food` | ✅ |
| REQ-001 | AC-001.2 | T-008 | `tests/test_services/test_portion_estimate_rules.py::test_parse_grams_rounds_half_up_to_an_integer`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_rounds_the_grams` | ✅ |
| REQ-001 | AC-001.3 | T-008 | `tests/test_services/test_portion_estimate_rules.py::test_build_estimate_accepts_the_range_limits` | ✅ |
| REQ-001 | AC-001.4 | T-008 | `tests/test_services/test_portion_estimate_rules.py::test_clean_text_returns_none_when_missing_or_blank`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_leaves_unit_and_note_none_when_the_model_omits_them`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_leaves_unit_and_note_none_when_blank` | ✅ |
| REQ-002 | AC-002.1 | T-008, T-036 | `tests/test_services/test_portion_estimate_rules.py::test_build_estimate_truncates_a_long_note_to_100` | ✅ |
| REQ-002 | AC-002.2 | T-008 | `tests/test_services/test_portion_estimate_rules.py::test_clean_text_truncates_without_trailing_space`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_truncates_a_long_unit_to_50` | ✅ |
| REQ-002 | AC-002.3 | T-008 | `tests/test_services/test_portion_estimate_rules.py::test_clean_text_strips_the_edges`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_strips_the_unit` | ✅ |
| REQ-003 | AC-003.1 | T-009, T-012, T-016 | `tests/test_routes/test_portion_estimate_routes.py::test_not_food_question_returns_the_fixed_message`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_returns_not_food_with_the_fixed_message`<br>`tests/test_services/test_portion_estimate_service.py::test_estimate_returns_not_food_with_the_fixed_message` | ✅ |
| REQ-003 | AC-003.2 | T-009 | `tests/test_services/test_portion_estimate_rules.py::test_build_estimate_ignores_everything_else_when_not_food` | ✅ |
| REQ-004 | AC-004.1 | T-009, T-016 | `tests/test_routes/test_portion_estimate_routes.py::test_invalid_grams_return_unknown`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_grams_returns_none_when_not_valid`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_is_unknown_when_the_grams_are_not_valid`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_is_unknown_when_the_grams_are_missing` | ✅ |
| REQ-004 | AC-004.2 | T-010, T-012 | `tests/test_routes/test_portion_estimate_routes.py::test_model_refusal_returns_unknown`<br>`tests/test_services/test_llm_client.py::test_generate_structured_returns_no_data_on_refusal_or_truncation`<br>`tests/test_services/test_portion_estimate_service.py::test_estimate_is_unknown_when_the_model_refuses`<br>`tests/test_services/test_portion_estimate_service.py::test_estimate_is_unknown_when_the_response_is_truncated` | ✅ |
| REQ-004 | AC-004.3 | T-009, T-010 | `tests/test_services/test_llm_client.py::test_generate_structured_returns_no_data_without_a_tool_use_block`<br>`tests/test_services/test_llm_client.py::test_generate_structured_ignores_a_tool_use_block_of_another_tool`<br>`tests/test_services/test_llm_client.py::test_generate_structured_returns_no_data_when_the_input_is_not_a_dict`<br>`tests/test_services/test_llm_client.py::test_generate_structured_uses_the_first_matching_tool_use_block`<br>`tests/test_services/test_portion_estimate_rules.py::test_build_estimate_is_unknown_when_the_structure_is_not_the_expected`<br>`tests/test_services/test_portion_estimate_service.py::test_estimate_is_unknown_when_the_structure_is_not_the_expected` | ✅ |
| REQ-005 | AC-005.1 | T-007, T-013, T-017 | `tests/test_routes/test_portion_estimate_routes.py::test_a_body_that_is_not_a_json_object_returns_400`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_question_rejects_a_body_that_is_not_an_object`<br>`tests/test_services/test_portion_estimate_service.py::test_invalid_request_touches_neither_the_limiter_nor_the_model_nor_the_tracer` | ✅ |
| REQ-005 | AC-005.2 | T-007, T-017 | `tests/test_routes/test_portion_estimate_routes.py::test_a_missing_or_blank_question_returns_400`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_question_requires_a_non_blank_question` | ✅ |
| REQ-005 | AC-005.3 | T-007, T-017 | `tests/test_routes/test_portion_estimate_routes.py::test_a_question_that_is_not_text_returns_400`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_question_rejects_a_question_that_is_not_text` | ✅ |
| REQ-005 | AC-005.4 | T-007, T-017 | `tests/test_routes/test_portion_estimate_routes.py::test_a_question_of_201_characters_returns_400`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_question_rejects_201_characters` | ✅ |
| REQ-005 | AC-005.5 | T-007, T-017 | `tests/test_routes/test_portion_estimate_routes.py::test_a_question_of_200_characters_with_edge_spaces_is_accepted_stripped`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_question_accepts_200_characters_and_strips_the_edges`<br>`tests/test_services/test_portion_estimate_rules.py::test_parse_question_counts_the_length_after_stripping`<br>`tests/test_services/test_portion_estimate_service.py::test_the_model_receives_the_question_without_edge_spaces` | ✅ |
| REQ-005 | AC-005.6 | T-017 | `tests/test_routes/test_portion_estimate_routes.py::test_invalid_requests_do_not_count_for_the_limit` | ✅ |
| REQ-006 | AC-006.1 | T-013, T-018 | `tests/test_routes/test_portion_estimate_routes.py::test_the_eleventh_question_returns_429_without_calling_the_model`<br>`tests/test_services/test_portion_estimate_service.py::test_rate_limited_user_gets_a_rate_limit_error_without_calling_the_model` | ✅ |
| REQ-006 | AC-006.2 | T-013 | `tests/test_routes/test_portion_estimate_routes.py::test_the_counter_is_set_to_expire_in_21600_seconds`<br>`tests/test_services/test_portion_estimate_service.py::test_the_limit_checked_is_10_per_21600_seconds_with_a_key_of_the_user` | ✅ |
| REQ-006 | AC-006.3 | T-018 | `tests/test_routes/test_portion_estimate_routes.py::test_one_users_limit_does_not_affect_another` | ✅ |
| REQ-006 | AC-006.4 | T-013, T-033, T-037 | `tests/test_routes/test_coach_routes.py::test_the_coach_and_portion_counters_are_independent_over_http`<br>`tests/test_services/test_llm_client.py::test_lazy_client_generate_with_usage_creates_the_client_once_and_delegates`<br>`tests/test_services/test_portion_estimate_service.py::test_the_portion_and_coach_counters_are_independent` | ✅ |
| REQ-006 | AC-006.5 | T-018 | `tests/test_routes/test_portion_estimate_routes.py::test_every_valid_question_counts_whatever_its_outcome` | ✅ |
| REQ-007 | AC-007.1 | T-012, T-018 | `tests/test_routes/test_portion_estimate_routes.py::test_provider_failure_returns_503_without_the_original_error`<br>`tests/test_services/test_portion_estimate_service.py::test_provider_failure_becomes_a_service_unavailable_error_without_the_original_text` | ✅ |
| REQ-008 | AC-008.1 | T-019 | `tests/test_routes/test_portion_estimate_routes.py::test_request_without_token_returns_401`<br>`tests/test_routes/test_portion_estimate_routes.py::test_request_with_an_invalid_token_returns_401`<br>`tests/test_routes/test_portion_estimate_routes.py::test_request_with_an_expired_token_returns_401` | ✅ |
| REQ-008 | AC-008.2 | T-019 | `tests/test_routes/test_portion_estimate_routes.py::test_a_user_id_in_the_body_is_ignored_for_the_limit` | ✅ |
| REQ-009 | AC-009.1 | T-014 | `tests/test_services/test_portion_estimate_service.py::test_a_trace_is_recorded_with_user_question_response_and_outcome` | ✅ |
| REQ-009 | AC-009.2 | T-014 | `tests/test_services/test_portion_estimate_service.py::test_the_trace_outcome_is_not_food_or_unknown`<br>`tests/test_services/test_portion_estimate_service.py::test_the_trace_outcome_is_error_when_the_provider_fails` | ✅ |
| REQ-009 | AC-009.3 | T-014 | `tests/test_services/test_portion_estimate_service.py::test_no_trace_is_recorded_for_a_validation_error`<br>`tests/test_services/test_portion_estimate_service.py::test_no_trace_is_recorded_when_rate_limited` | ✅ |
| REQ-009 | AC-009.4 | T-014 | `tests/test_services/test_portion_estimate_service.py::test_a_failure_closing_the_trace_does_not_change_the_response` | ✅ |
| REQ-010 | AC-010.1 | T-029, T-030, T-031 | `tests/test_routes/test_portion_estimate_routes.py::test_a_failing_counter_returns_503_without_the_original_error`<br>`tests/test_services/test_portion_estimate_service.py::test_a_failing_limiter_becomes_a_service_unavailable_error_without_calling_the_model` | ✅ |
| REQ-010 | AC-010.2 | T-029, T-030 | `tests/test_services/test_portion_estimate_service.py::test_no_trace_is_recorded_when_the_limiter_fails` | ✅ |
| REQ-010 | AC-010.3 | T-029, T-030, T-031 | `tests/test_routes/test_portion_estimate_routes.py::test_a_blank_question_returns_400_even_when_the_counter_fails`<br>`tests/test_services/test_portion_estimate_service.py::test_validation_goes_before_the_limiter_even_when_it_fails` | ✅ |
| REQ-011 | AC-011.1 | T-031 | `tests/test_routes/test_portion_estimate_routes.py::test_a_body_of_4097_bytes_returns_400_without_calling_the_model` | ✅ |
| REQ-011 | AC-011.2 | T-031 | `tests/test_routes/test_portion_estimate_routes.py::test_a_body_of_exactly_4096_bytes_is_accepted` | ✅ |
| REQ-011 | AC-011.3 | T-031 | `tests/test_routes/test_portion_estimate_routes.py::test_a_body_of_4097_bytes_touches_neither_the_counter_nor_the_tracer` | ✅ |
| REQ-011 | AC-011.4 | T-032 | `tests/test_routes/test_meal_routes.py::test_post_accepts_a_valid_body_larger_than_4096_bytes` | ✅ |
| NFR-001 | AC-N001.1 | T-010, T-015, T-034 | `tests/test_services/test_llm_client.py::test_generate_structured_forces_the_tool_and_returns_data_and_tokens`<br>`tests/test_services/test_llm_client.py::test_llm_client_passes_timeout_and_max_retries_to_the_sdk_client`<br>`tests/test_services/test_portion_estimate_service.py::test_the_model_is_called_once_with_150_tokens_and_temperature_0` | ✅ |
| NFR-001 | AC-N001.2 | T-011 | `tests/test_services/test_llm_client.py::test_lazy_client_uses_the_default_small_model_when_not_configured`<br>`tests/test_services/test_llm_client.py::test_lazy_client_falls_back_to_the_default_for_an_empty_value`<br>`tests/test_services/test_llm_client.py::test_lazy_client_uses_the_configured_model`<br>`tests/test_services/test_llm_client.py::test_lazy_client_creates_the_real_client_on_the_first_call_with_model_and_options`<br>`tests/test_services/test_llm_client.py::test_lazy_client_init_app_discards_a_previously_created_client` | ✅ |
| NFR-002 | AC-N002.1 | T-015 | `tests/test_services/test_portion_estimate_service.py::test_the_instructions_are_fixed_and_the_question_is_the_only_user_message` | ✅ |
| NFR-002 | AC-N002.2 | T-015 | `tests/test_services/test_portion_estimate_service.py::test_the_second_question_does_not_carry_the_first_one_or_its_answer` | ✅ |
| NFR-003 | AC-N003.1 | T-019 | `tests/test_routes/test_portion_estimate_routes.py::test_a_question_does_not_change_any_diary_or_library_row` | ✅ |

Resumen de cobertura:
- AC sin test: — (42 de 42 AC tienen al menos un test con marcador `SDD: 030` y ese test pasa).
- REQ / NFR sin tarea: — (REQ-001 a REQ-011 y NFR-001 a NFR-003 aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: — (41 de 41 tareas, T-001 a T-041, están marcadas).
- Marcadores `SDD: 030` en la línea anterior a la definición del test: 87 de 87.
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff de `backend/`: ninguno. Las únicas apariciones de la palabra en el diff están en texto de `state.json` y de este informe.
- Excepción B5.2 aceptada por el usuario (`tasks.md`, «Comentarios del usuario»): T-034 (AC-N001.1, F3) y T-036 (AC-002.1, F5) pasan sin código nuevo, como refuerzo de tests existentes. Se anota aquí; no cuenta como fallo.

## 3. Criterios de aceptación manuales
<!-- AC que no se pueden comprobar de forma automática (visuales, UX): se listan para que los pruebe el usuario en el gate. -->
- Ninguno de los 42 AC requiere prueba manual: la feature es solo de backend y todos los AC son automatizables.
- Nota informativa, no es un AC: el comportamiento de la estimación cuando la pregunta menciona varios alimentos («2 huevos y una tostada») depende del modelo. La spec (NFR-002) lo deja fuera de los tests automatizados; solo se comprueba que las instrucciones son fijas (AC-N002.1 y AC-N002.2). Conviene que el usuario lo pruebe a mano tras el despliegue.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. | — | — |

Entorno: Postgres (`localhost:5433`) y Redis locales estaban arriba y respondieron. No hubo errores de entorno.
