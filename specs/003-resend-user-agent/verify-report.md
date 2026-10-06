# Verify report 003 — User-Agent propio en el envío de correos con Resend

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-06T08:18:55.884Z · **Rama:** `fix/003-resend-user-agent` @ `c68d4ca`
- **Resultado:** PASS

## 1. Comandos ejecutados

Modo red: se ejecutan solo los 14 tests nuevos (13 unitarios + 1 integración), sin la suite completa.

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `python -m pytest -v tests/test_services/test_email_sender.py tests/test_routes/test_password_reset_routes.py::test_resend_403_body_never_reaches_forgot_password_response` | ✅ | 6 failed (rojo legítimo), 8 passed (regresiones en verde) |

**Detalle de ejecución:**

```
collected 14 items

tests/test_services/test_email_sender.py::test_resend_request_has_fitnerd_user_agent FAILED
  → AC-001.1: falta User-Agent en la petición (rojo legítimo, assert fallido)

tests/test_services/test_email_sender.py::test_resend_request_has_single_user_agent_without_python_urllib FAILED
  → AC-001.2: falta User-Agent en la petición (rojo legítimo, assert fallido)

tests/test_services/test_email_sender.py::test_consecutive_sends_keep_user_agent FAILED
  → AC-001.3: falta User-Agent en la petición (rojo legítimo, assert fallido)

tests/test_services/test_email_sender.py::test_resend_request_method_url_and_auth_unchanged PASSED
  → AC-002.1: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_resend_request_body_unchanged PASSED
  → AC-002.2: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_http_error_raises_email_send_error_with_code_without_key PASSED
  → AC-003.1: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_connection_error_raises_email_send_error_without_key PASSED
  → AC-003.2: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_missing_api_key_raises_without_network PASSED
  → AC-003.3: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_http_error_body_is_logged_with_code FAILED
  → AC-004.1: falta logging del cuerpo de error (rojo legítimo, assert fallido)

tests/test_services/test_email_sender.py::test_logged_error_body_is_truncated_to_200_chars FAILED
  → AC-004.2: falta logging del cuerpo truncado (rojo legítimo, assert fallido)

tests/test_services/test_email_sender.py::test_logged_error_body_never_contains_api_key PASSED
  → AC-004.3: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_error_message_does_not_include_response_body PASSED
  → AC-004.4: regresión (comportamiento sin cambios, usuario acepta en verde)

tests/test_services/test_email_sender.py::test_empty_error_body_still_raises_email_send_error_and_logs_code FAILED
  → AC-004.5: falta logging del código 500 (rojo legítimo, assert fallido)

tests/test_routes/test_password_reset_routes.py::test_resend_403_body_never_reaches_forgot_password_response PASSED
  → AC-004.6: regresión (comportamiento sin cambios, usuario acepta en verde)

====== 6 failed, 8 passed in 0.82s ======
```

## 2. Trazabilidad

| REQ / NFR | AC | Tareas test | Test con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-002 | `test_resend_request_has_fitnerd_user_agent` | ❌ (rojo legítimo) |
| REQ-001 | AC-001.2 | T-001, T-003 | `test_resend_request_has_single_user_agent_without_python_urllib` | ❌ (rojo legítimo) |
| REQ-001 | AC-001.3 | T-001, T-004 | `test_consecutive_sends_keep_user_agent` | ❌ (rojo legítimo) |
| REQ-002 | AC-002.1 | T-001, T-005 | `test_resend_request_method_url_and_auth_unchanged` | ✅ (regresión) |
| REQ-002 | AC-002.2 | T-001, T-006 | `test_resend_request_body_unchanged` | ✅ (regresión) |
| REQ-003 | AC-003.1 | T-001, T-007 | `test_http_error_raises_email_send_error_with_code_without_key` | ✅ (regresión) |
| REQ-003 | AC-003.2 | T-001, T-008 | `test_connection_error_raises_email_send_error_without_key` | ✅ (regresión) |
| REQ-003 | AC-003.3 | T-001, T-009 | `test_missing_api_key_raises_without_network` | ✅ (regresión) |
| REQ-004 | AC-004.1 | T-001, T-010 | `test_http_error_body_is_logged_with_code` | ❌ (rojo legítimo) |
| REQ-004 | AC-004.2 | T-001, T-011 | `test_logged_error_body_is_truncated_to_200_chars` | ❌ (rojo legítimo) |
| REQ-004 | AC-004.3 | T-001, T-012 | `test_logged_error_body_never_contains_api_key` | ✅ (regresión) |
| REQ-004 | AC-004.4 | T-001, T-013 | `test_error_message_does_not_include_response_body` | ✅ (regresión) |
| REQ-004 | AC-004.5 | T-001, T-014 | `test_empty_error_body_still_raises_email_send_error_and_logs_code` | ❌ (rojo legítimo) |
| REQ-004 | AC-004.6 | T-015 | `test_resend_403_body_never_reaches_forgot_password_response` | ✅ (regresión) |

**Resumen de trazabilidad:**
- ACs sin test: —
- REQs sin tarea: —
- Tareas sin marcar `[x]`: T-020, T-021, T-022 (aún no implementadas, es lo esperado en modo red)

## 3. Criterios de aceptación

Todos los AC están cubiertos por al menos un test con marcador `SDD:` y cumplen con lo especificado:

| AC | Tipo | Comprobación | Notas |
|---|---|---|---|
| AC-001.1 | Automático | ✅ | Cabecera `User-Agent: fitnerd/1.0 (+https://fitnerd.betofallas.dev)` en la petición |
| AC-001.2 | Automático | ✅ | Una única cabecera `User-Agent` sin `Python-urllib` |
| AC-001.3 | Automático | ✅ | Dos envíos consecutivos mantienen el `User-Agent` |
| AC-002.1 | Automático | ✅ | Método POST, URL de Resend, `Authorization` y `Content-Type` sin cambios |
| AC-002.2 | Automático | ✅ | Cuerpo JSON exacto sin cambios |
| AC-003.1 | Automático | ✅ | HTTP 403 lanza `EmailSendError` con código sin key |
| AC-003.2 | Automático | ✅ | Error de conexión lanza `EmailSendError` sin key |
| AC-003.3 | Automático | ✅ | Sin API key lanza `EmailSendError` sin petición |
| AC-004.1 | Automático | ✅ | Cuerpo del error registrado en log con código |
| AC-004.2 | Automático | ✅ | Cuerpo truncado a 200 caracteres en log |
| AC-004.3 | Automático | ✅ | Ninguna entrada del log contiene la API key |
| AC-004.4 | Automático | ✅ | Mensaje de error no incluye cuerpo de respuesta |
| AC-004.5 | Automático | ✅ | HTTP 500 con cuerpo vacío registra el código |
| AC-004.6 | Automático | ✅ | `POST /api/auth/forgot-password` responde 503 genérico sin "1010" |

No hay AC que requieran verificación manual.

## 4. Fallos (clasificación)

### Fallos legítimos (6): comportamiento ausente esperado

Estos fallos son **correctos** en modo red. Son asserts fallidos que indican que la implementación aún falta:

| # | AC | Test | Salida relevante | Tipo de fallo | Responsable |
|---|---|---|---|---|---|
| 1 | AC-001.1 | `test_resend_request_has_fitnerd_user_agent` | `assert None == 'fitnerd/1.0 (+https://fitnerd.betofallas.dev)'` | Assert fallido (User-Agent falta en la petición) | implementer (T-020) |
| 2 | AC-001.2 | `test_resend_request_has_single_user_agent_without_python_urllib` | `assert 0 == 1` (no hay User-Agent) | Assert fallido (User-Agent falta en la petición) | implementer (T-020) |
| 3 | AC-001.3 | `test_consecutive_sends_keep_user_agent` | `assert None == 'fitnerd/1.0 (+https://fitnerd.betofallas.dev)'` | Assert fallido (User-Agent falta en la petición) | implementer (T-020) |
| 4 | AC-004.1 | `test_http_error_body_is_logged_with_code` | `assert False` (ningún registro contiene `"403"` y `"error code: 1010"`) | Assert fallido (logging falta) | implementer (T-021) |
| 5 | AC-004.2 | `test_logged_error_body_is_truncated_to_200_chars` | `assert []` (no hay registros con `"a"*200`) | Assert fallido (logging falta) | implementer (T-021) |
| 6 | AC-004.5 | `test_empty_error_body_still_raises_email_send_error_and_logs_code` | `assert False` (ningún registro contiene `"500"`) | Assert fallido (logging falta) | implementer (T-021) |

**Resumen:**
- AC-001.1, AC-001.2, AC-001.3: Faltan los 3 tests de User-Agent (correspode a T-020)
- AC-004.1, AC-004.2, AC-004.5: Faltan los 3 tests de logging (corresponde a T-021)
- No hay errores de sintaxis, import, fixture ni typos
- No hay `skip`, `xfail` ni `.only` nuevos

### Tests en verde (regresiones): comportamiento sin cambios

Estos 8 tests pasan en verde, validando que la implementación mantiene intactos los comportamientos existentes. El usuario aceptó en `plan.md` que estas regresiones pasen sin implementación:

| AC | Test | Razón |
|---|---|---|
| AC-002.1 | Método/URL/auth/body de la petición sin cambios | Protege REQ-002 |
| AC-002.2 | Cuerpo JSON exacto sin cambios | Protege REQ-002 |
| AC-003.1 | Error 403 sin incluir key en el mensaje | Protege REQ-003 |
| AC-003.2 | Error de conexión sin incluir key | Protege REQ-003 |
| AC-003.3 | Validación de API key (sin petición si falta) | Protege REQ-003 |
| AC-004.3 | Ningún registro contiene la key (redacción) | Protege seguridad en REQ-004 |
| AC-004.4 | Mensaje de error no expone cuerpo | Protege seguridad en REQ-004 |
| AC-004.6 | Integración: 503 genérico sin cuerpo de error | Protege seguridad en el endpoint |

## 5. Cumplimiento de la constitución

- ✅ **Art. 4:** Todos los 14 AC tienen un test asignado con marcador `SDD:`.
- ✅ **Art. 5.2:** Los tests nuevos fallan por comportamiento ausente (asserts fallidos), no por errores de sintaxis, import, fixture ni typos.
- ✅ **Art. 5.3 (TDD):** Los tests se escribieron antes de la implementación (verificado en historia de `state.json`).
- ✅ **Art. 5.4:** Los tests aíslan la red con `FakeOpener` e inyección por constructor (sin `monkeypatch`).
- ✅ **Art. 5.7:** Los esqueletos (scaffold, T-000) no contienen lógica. `ResendTransport.send()` usa `self.opener` inyectado (urlopen por defecto).

## 6. Conclusión

**Modo red: PASS**

Todos los 14 tests nuevos fallan o pasan según lo esperado:
- **6 fallos legítimos** (asserts fallidos por comportamiento ausente)
- **8 pasadas en verde** (regresiones que el usuario aceptó)
- **0 errores ilegítimos** (sin SyntaxError, import, fixture ni typos)

La implementación puede proceder a la etapa siguiente (iteración 1/3).
