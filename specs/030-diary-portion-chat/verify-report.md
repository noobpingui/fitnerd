# Verify report 030 — Chat de porciones del diario (backend)

- **Modo:** red (tras la etapa tests, iteración 2: T-029 a T-037)
- **Fecha:** 2026-10-30T08:53:02.851Z · **Rama:** `feat/030-diary-portion-chat` @ `8a1816c` (HEAD; los tests de la iteración 2 están sin commitear) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
<!-- Una fila por comando declarado en `scopes.<ámbito>.commands` de la config, solo de los ámbitos tocados.
     Los comandos a null no se ejecutan ni se listan. -->
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -v {files}` (`backend`), con `test_portion_estimate_service.py`, `test_portion_estimate_routes.py`, `test_meal_routes.py`, `test_llm_client.py`, `test_portion_estimate_rules.py` y `test_coach_routes.py`; ejecutado a través de un runner de la sesión que bloquea toda conexión de red salvo `localhost:5433` (Postgres de prueba) | ✅ | `11 failed, 302 passed`. Los 11 fallos son tests nuevos en rojo legítimo; los 302 pasados incluyen los tests preexistentes de esos archivos. Conexiones de red bloqueadas: 0. |

Modo red: no se ejecuta lint (ratchet), typecheck ni build. Comandos a `null` en `scopes.backend`: `lint`, `typecheck`, `build`.

Verificación de red: el test del coach (`test_the_coach_and_portion_counters_are_independent_over_http`) sustituye `anthropic.Anthropic` por un doble que lanza `AssertionError` si se llama a `messages.create`. El fallo del coach es ese `AssertionError` capturado por `coach_service` (503), no una llamada real. Autoprueba del runner: una conexión a `api.anthropic.com:443` queda bloqueada. Durante la ejecución no hubo ningún intento de conexión a un host distinto de `localhost:5433`.

Nota histórica: el informe de la iteración 2 anterior registró 3 llamadas reales a Anthropic desde el test del coach. Esa versión del test ya no existe; la versión actual no llama a la red.

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
Alcance: los 13 tests nuevos o modificados de la iteración 2 (marcador `SDD: 030`, o `SDD: 030` en el test de F5).

| REQ / NFR | AC | Tareas | Test (`archivo::nombre`) | Estado del test |
|---|---|---|---|---|
| REQ-010 | AC-010.1 | T-030, T-039 | `test_portion_estimate_service.py::test_a_failing_limiter_becomes_a_service_unavailable_error_without_calling_the_model` | ❌ rojo legítimo (`ConnectionError` del limitador sin traducir a 503) |
| REQ-010 | AC-010.2 | T-030, T-039 | `test_portion_estimate_service.py::test_no_trace_is_recorded_when_the_limiter_fails` | ❌ rojo legítimo (mismo fallo, antes de la aserción de traza) |
| REQ-010 | AC-010.3 | T-030, T-039 | `test_portion_estimate_service.py::test_validation_goes_before_the_limiter_even_when_it_fails` | ❌ rojo legítimo (la primera mitad valida; la segunda, con limitador caído, lanza `ConnectionError` en lugar de 503) |
| REQ-010 | AC-010.1 | T-031, T-039 | `test_portion_estimate_routes.py::test_a_failing_counter_returns_503_without_the_original_error` | ❌ rojo legítimo (responde 500, no 503) |
| REQ-010 | AC-010.3 | T-031, T-039 | `test_portion_estimate_routes.py::test_a_blank_question_returns_400_even_when_the_counter_fails` | ❌ rojo legítimo (la pregunta vacía da 400; la válida con Redis caído da 500, no 503) |
| REQ-011 | AC-011.1 | T-031, T-040 | `test_portion_estimate_routes.py::test_a_body_of_4097_bytes_returns_400_without_calling_the_model` | ❌ rojo legítimo (responde 200, no 400) |
| REQ-011 | AC-011.2 | T-031, T-040 | `test_portion_estimate_routes.py::test_a_body_of_exactly_4096_bytes_is_accepted` | ❌ rojo legítimo (4096 da 200; 4097 da 200, no 400) |
| REQ-011 | AC-011.3 | T-031, T-040 | `test_portion_estimate_routes.py::test_a_body_of_4097_bytes_touches_neither_the_counter_nor_the_tracer` | ❌ rojo legítimo (responde 200, no 400) |
| REQ-011 | AC-011.4 | T-032, T-040 | `test_meal_routes.py::test_post_accepts_a_valid_body_larger_than_4096_bytes` | ❌ rojo legítimo (la parte de `POST /api/meals` da 201; la de la estimación con 4100 bytes da 200, no 400) |
| REQ-006 | AC-006.4 | T-033, T-038 | `test_llm_client.py::test_lazy_client_generate_with_usage_creates_the_client_once_and_delegates` | ❌ rojo legítimo (`NotImplementedError("not implemented")` de `generate_with_usage`) |
| NFR-001 | AC-N001.1 | T-034 | `test_llm_client.py::test_llm_client_passes_timeout_and_max_retries_to_the_sdk_client` | ✅ pasa sin implementación: excepción B5.2 aceptada por el usuario (F3) |
| REQ-002 | AC-002.1 | T-036 | `test_portion_estimate_rules.py::test_build_estimate_truncates_a_long_note_to_100` | ✅ pasa sin implementación: excepción B5.2 aceptada por el usuario (F5) |
| REQ-006 | AC-006.4 | T-037, T-041 | `test_coach_routes.py::test_the_coach_and_portion_counters_are_independent_over_http` | ❌ rojo legítimo (`503 == 200`: el coach todavía no usa `coach_llm`, T-041; el doble del SDK impide cualquier llamada real) |

- AC sin test: — (todos los AC nuevos de la iteración 2 tienen al menos un test con marcador `SDD: 030`: AC-002.1, AC-006.4, AC-010.1 a AC-010.3, AC-011.1 a AC-011.4, AC-N001.1)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-038, T-039, T-040 y T-041 (fase B de la iteración 2, pendientes; esperado en esta etapa)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff de `backend/tests`: ninguno
- Mocks (`unittest.mock`, `monkeypatch`, `MagicMock`) en los tests nuevos: ninguno. El test del coach sustituye `anthropic.Anthropic` por un doble a mano dentro de su módulo, con fixture `autouse`.
- Guardas puras (pasan sin implementación) distintas de F3 y F5: ninguna. Las guardas de AC-010.3 (servicio y ruta), AC-011.2, AC-011.4 y la mitad inversa de AC-006.4 ahora llevan una aserción roja, como acordó el usuario.
- Esqueletos: `OK` en `LazyLLMClient.generate_with_usage` (T-026, lanza `NotImplementedError("not implemented")`). Ningún test nuevo de la iteración 2 da error de importación, de sintaxis ni de fixture.
- Pasados de los archivos ejecutados: 302, incluidos los tests preexistentes (B5.3 se cumple: ninguno roto).

## 3. Criterios de aceptación manuales
<!-- AC que no se pueden comprobar de forma automática (visuales, UX): se listan para que los pruebe el usuario en el gate. -->
- Ninguno. Feature solo de backend y todos los AC son automatizables.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Los 11 rojos son legítimos y esperados en esta etapa. Los 2 tests que pasan (F3 y F5) están aceptados por el usuario (Art. B5.2, «Comentarios del usuario» de `tasks.md`). | — | — |
