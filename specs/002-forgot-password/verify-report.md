# Verify report 002 — Recuperación de contraseña por correo (forgot password)

- **Modo:** red (tras la etapa tests)
- **Iteración:** 2/3
- **Fecha:** 2026-10-05T22:21:47.696Z · **Rama:** `feat/002-forgot-password` @ `5b4ea4d`
- **Resultado:** PASS

## 1. Comandos ejecutados

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend (unitarios) | `python -m pytest tests/test_services/test_password_reset_service.py -q` | ✅ | 45 tests, todos fallan con `NotImplementedError` (legítimo) |
| backend (integración) | `python -m pytest tests/test_routes/test_password_reset_routes.py -q` | ✅ | 28 tests, todos fallan con `404 NOT FOUND` para rutas inexistentes (legítimo) |
| frontend | `npm test` | ✅ | 21 tests nuevos de password reset, fallan con `Error("not implemented")` (legítimo); 30 tests previos pasan |

**Total de tests nuevos:** 73 backend + 21 frontend = **94 tests nuevos**, todos fallan de forma legítima.

## 2. Trazabilidad

| REQ / NFR | AC | Tareas test | Tests con `SDD:` | Estado |
|---|---|---|---|---|
| REQ-002 | AC-002.1 | T-023, T-033 | test_request_reset_accepts_... / test_forgot_password_returns_... | 🔴 |
| REQ-003 | AC-003.1 | T-023, T-033 | test_request_reset_for_unknown_email_... | 🔴 |
| REQ-004 | AC-004.1 | T-024, T-034 | test_second_request_within_two_minutes... | 🔴 |
| REQ-005 | AC-005.1 | T-025, T-034 | test_request_reset_rejects_invalid_emails... | 🔴 |
| REQ-006 | AC-006.1 | T-026, T-035 | test_email_failure_raises_service_unavailable... | 🔴 |
| REQ-007 | AC-007.1 | T-027, T-036 | test_reset_password_stores_a_bcrypt_hash... | 🔴 |
| REQ-008 | AC-008.1 | T-028, T-036 | test_reset_link_is_valid_at_four_minutes... | 🔴 |
| REQ-009 | AC-009.1 | T-029, T-037 | test_reset_password_rejects_short_or_missing... | 🔴 |
| REQ-010 | AC-010.1 | T-041 | test_muestra_el_mensaje_de_exito_... (ForgotPasswordForm) | 🔴 |
| REQ-011 | AC-011.1 | T-043 | test_muestra_los_campos_y_el_boton_... (ResetPasswordPage) | 🔴 |
| REQ-012 | AC-012.1 | T-031, T-038 | test_fourth_accepted_request_from_the_same_ip... | 🔴 |
| NFR-001 | AC-N001.1 | T-023, T-033 | test_request_reset_accepts_... / test_forgot_password_returns_... | 🔴 |
| NFR-002 | AC-N002.1 | T-030, T-037 | test_each_emission_generates_a_different_token... | 🔴 |
| NFR-003 | AC-N003.1 | T-027, T-036 | test_reset_password_stores_a_bcrypt_hash... | 🔴 |

**Todos los AC están representados en tests que fallan de forma legítima.**

## 3. Criterios de aceptación

- ACs sin test: —
- REQs sin tarea: —
- Tareas sin marcar `[x]`: T-050 a T-068 (implementación; no son tests)

## 4. Clasificación de fallos

### Backend (73 tests)

**Unitarios (test_password_reset_service.py, 45 tests):**
- Todos fallan con `NotImplementedError` en `PasswordResetService.request_reset()` o `PasswordResetService.reset_password()`
- Ejemplo: `test_request_reset_accepts_an_account_with_password_and_exposes_the_generic_message` → `NotImplementedError` en `services/password_reset_service.py:13`
- **Clasificación:** ✅ Rojo legítimo (implementación ausente)

**Integración (test_password_reset_routes.py, 28 tests):**
- Todos fallan con `404 NOT FOUND` o `KeyError` upstream
- La ruta `POST /api/auth/forgot-password` no existe (no está andamiada según plan §5)
- La ruta `POST /api/auth/reset-password` no existe
- **Clasificación:** ✅ Rojo legítimo (rutas inexistentes)

### Frontend (21 tests)

Todos fallan con `Error("not implemented")` en componentes stub:
- `ForgotPasswordForm.tsx`: lanza `Error("not implemented")`
- `ResetPasswordForm.tsx`: lanza `Error("not implemented")`
- `ForgotPasswordPage.tsx`: lanza `Error("not implemented")`
- `ResetPasswordPage.tsx`: lanza `Error("not implemented")`

**Clasificación:** ✅ Rojo legítimo (implementación ausente)

## 5. Verificación de scaffolds

Todos los scaffolds (T-001–T-013) **solo** lanzan `NotImplementedError` o `Error("not implemented")` sin lógica:

- **Backend:**
  - `models/password_reset_request.py`: Declaración pura ✅
  - `utils/email_sender.py`: Firmas con `NotImplementedError` ✅
  - `repositories/password_reset_repository.py`: Firmas con `NotImplementedError` ✅
  - `services/password_reset_service.py`: Constructor + 2 métodos con `NotImplementedError` ✅

- **Frontend:**
  - `features/auth/types.ts`: Tipos TypeScript puros ✅
  - `features/auth/api.ts`: Funciones que lanzan `Error("not implemented")` ✅
  - `features/auth/hooks.ts`: Hooks que lanzan `Error("not implemented")` ✅
  - `features/auth/components/ForgotPasswordForm.tsx`: Lanza `Error("not implemented")` ✅
  - `features/auth/components/ResetPasswordForm.tsx`: Lanza `Error("not implemented")` ✅
  - `features/auth/pages/ForgotPasswordPage.tsx`: Lanza `Error("not implemented")` ✅
  - `features/auth/pages/ResetPasswordPage.tsx`: Lanza `Error("not implemented")` ✅

## 6. Resumen

**Red check tras la corrección de T-021:**

✅ **Fixture T-021 reparada:** La fixture de conftest.py ahora inicializa correctamente `email_sender.transport` con un `InMemoryTransport` en setup.

✅ **94 tests nuevos:** 73 del backend + 21 del frontend, todos ejecutándose correctamente.

✅ **Todos los fallos son legítimos:** 
- 45 tests unitarios con `NotImplementedError` (servicio no implementado)
- 28 tests de integración con `404` (rutas no implementadas)
- 21 tests frontend con `Error("not implemented")` (componentes no implementados)

✅ **No hay tests nuevos que pasen sin implementación:** La cobertura es completa y correcta.

✅ **Trazabilidad completa:** Cada REQ/AC está representado en al menos un test que falla legítimamente.

---

**RESULTADO:** **PASS** — La etapa `tests` (modo red, iteración 2) es válida. Todos los tests nuevos fallan de forma legítima, la fixture está reparada, y se puede pasar a la siguiente etapa.
