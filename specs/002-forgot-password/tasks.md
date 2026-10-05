# Tareas 002 — Recuperación de contraseña por correo (forgot password)

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-05)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos.
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold (implementer, modo scaffold, ADR-0012) → test (test-author) → impl, migration y config (implementer).
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea.
- Las vistas nuevas de auth_routes.py, email_sender.init_app y ProxyFix en app.py, PROXY_FIX_X_FOR en config.py,
  las rutas de router.tsx y los cambios de LoginForm.tsx NO se andaman (plan §5): el rojo debe ser legítimo.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [ ] T-001 [REQ-002, REQ-004, REQ-012] (scaffold) Declarar el modelo completo `PasswordResetRequest` (columnas, índices simples, índice compuesto `client_ip`+`created_at`, esquema `public`); solo declaración, los fakes lo instancian — `backend/models/password_reset_request.py`
- [ ] T-002 [REQ-002] (scaffold) Exportar `PasswordResetRequest` en el paquete de modelos — `backend/models/__init__.py`
- [ ] T-003 [REQ-002, REQ-006] (scaffold) Firmas de `EmailSendError`, `EmailMessage`, `EmailSender` (`init_app`, `send`), `InMemoryTransport` (`outbox`, `fail_with`, `send`, `clear`), `ResendTransport` y `ConsoleTransport`, con los métodos que lanzan `NotImplementedError`; el constructor de `EmailSender` solo deja `transport` y `sender` en `None` — `backend/utils/email_sender.py`
- [ ] T-004 [REQ-002, REQ-006] (scaffold) Añadir el singleton `email_sender = EmailSender()` (sin `init_app`) — `backend/extensions.py`
- [ ] T-005 [REQ-004, REQ-008, REQ-012] (scaffold) Firmas de `PasswordResetRepository` (`lock_keys`, `count_recent_by_ip`, `get_latest_by_email`, `get_by_token_hash`, `invalidate_active_for_user`) que lanzan `NotImplementedError` — `backend/repositories/password_reset_repository.py`
- [ ] T-006 [REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-012] (scaffold) `PasswordResetService`: constructor que guarda atributos, `request_reset(email, client_ip)` y `reset_password(token, password)` que lanzan `NotImplementedError`; sin constantes de mensajes — `backend/services/password_reset_service.py`
- [ ] T-007 [REQ-010, REQ-011] (scaffold) Tipos `ForgotPasswordPayload`, `ResetPasswordPayload` y `MessageResponse` — `frontend/src/features/auth/types.ts`
- [ ] T-008 [REQ-010, REQ-011] (scaffold) Funciones `requestPasswordReset` y `resetPassword` que lanzan `Error("not implemented")` — `frontend/src/features/auth/api.ts`
- [ ] T-009 [REQ-010, REQ-011] (scaffold) Hooks `useRequestPasswordReset` y `useResetPassword` que lanzan `Error("not implemented")` — `frontend/src/features/auth/hooks.ts`
- [ ] T-010 [REQ-010, REQ-005] (scaffold) Componente `ForgotPasswordForm` stub que lanza `Error("not implemented")` — `frontend/src/features/auth/components/ForgotPasswordForm.tsx`
- [ ] T-011 [REQ-011] (scaffold) Componente `ResetPasswordForm` (prop `token`) stub que lanza `Error("not implemented")` — `frontend/src/features/auth/components/ResetPasswordForm.tsx`
- [ ] T-012 [REQ-001, REQ-010] (scaffold) Página `ForgotPasswordPage` stub que lanza `Error("not implemented")` — `frontend/src/features/auth/pages/ForgotPasswordPage.tsx`
- [ ] T-013 [REQ-011] (scaffold) Página `ResetPasswordPage` stub que lanza `Error("not implemented")` — `frontend/src/features/auth/pages/ResetPasswordPage.tsx`

## Fase A — Tests (test-author)

### Fakes y fixtures del backend
- [ ] T-020 [REQ-002, REQ-006, REQ-004] (test) Fakes `FakeEmailSender(raise_error=None)` (con `sent`) y `FakeClock(now)` (invocable, con `advance(**kwargs)`) — `backend/tests/fakes.py`
- [ ] T-021 [REQ-002, REQ-006] (test) Fixture autouse que vacía `outbox` y `fail_with` del transporte `memory` en el teardown, tolerando `transport is None` mientras `init_app` no esté cableado — `backend/tests/conftest.py`
- [ ] T-022 [REQ-002, REQ-004, REQ-012] (test) Fakes locales `FakeUserRepository` y `FakePasswordResetRepository` (misma semántica que el SQL; `lock_keys` anota en `locked_keys`) y helpers para extraer el token del correo — `backend/tests/test_services/test_password_reset_service.py`

### Tests unitarios de servicio
- [ ] T-023 [REQ-002, REQ-003, NFR-001, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-003.1, AC-003.2, AC-N001.1] (test) Solicitud aceptada con cuenta con contraseña (correo, asunto, enlace, 5 minutos, cuenta vinculada a Google) y sin cuenta o solo Google (sin correo, fila sin token) — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-024 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5] (test) Límite de 2 minutos por correo con `FakeClock` (1:59, 2:00, sin cuenta, otro correo, token anterior sigue válido) — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-025 [REQ-005, AC-005.1, AC-005.2] (test) Correo inválido, vacío, `None` o en blanco: `ValidationError`, sin correo, sin filas y sin `lock_keys` — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-026 [REQ-006, NFR-001, AC-006.1, AC-006.2, AC-006.3, AC-N001.2] (test) Fallo del correo: `ServiceUnavailableError` sin filas ni texto interno, recuperación inmediata y enlace anterior vigente — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-027 [REQ-007, NFR-003, AC-007.1, AC-007.2, AC-007.3, AC-N003.1] (test) Reset válido con hash bcrypt, uso único y contraseña no en claro — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-028 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5] (test) Caducidad (4:59 y 5:00), sustitución por enlace más reciente, token inventado, vacío o `None` — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-029 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-009.7, AC-009.8, AC-009.9] (test) Validación de contraseña (mínimo 8, máximo 72 bytes UTF-8, `ñ`), token no consumido tras rechazo y precedencia del error del token — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-030 [NFR-002, AC-N002.1] (test) Dos emisiones separadas por 2 minutos dan tokens distintos de al menos 32 caracteres — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-031 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5] (test) Límite de 3 solicitudes por IP en 10 minutos: bloqueo en la cuarta, borde exacto de 10 minutos, IP independiente y correos sin cuenta que cuentan — `backend/tests/test_services/test_password_reset_service.py`
- [ ] T-032 [REQ-012, AC-012.6, AC-012.7, AC-012.8] (test) Solo cuentan las aceptadas (400, 429 y 503 no), la rechazada por IP no consume el límite por correo, prevalece el límite por IP, y `locked_keys` contiene las claves de correo e IP — `backend/tests/test_services/test_password_reset_service.py`

### Tests de integración de rutas
- [ ] T-033 [REQ-002, REQ-003, NFR-001, AC-002.1, AC-002.2, AC-002.3, AC-003.1, AC-003.2, AC-N001.1] (test) `POST /api/auth/forgot-password` con cuenta, sin cuenta y solo Google: cuerpo exacto, `outbox`, token ausente en la respuesta — `backend/tests/test_routes/test_password_reset_routes.py`
- [ ] T-034 [REQ-004, REQ-005, AC-004.1, AC-004.3, AC-004.4, AC-004.5, AC-005.1, AC-005.2] (test) Límite por correo (con `UPDATE` de `created_at` para envejecer) y validación del correo (formato, sin campo, vacío, sin JSON) — `backend/tests/test_routes/test_password_reset_routes.py`
- [ ] T-035 [REQ-006, NFR-001, AC-006.1, AC-006.2, AC-N001.2] (test) Fallo del transporte `memory` (`fail_with`): `503` exacto sin detalle interno y recuperación posterior — `backend/tests/test_routes/test_password_reset_routes.py`
- [ ] T-036 [REQ-007, REQ-008, NFR-003, AC-007.1, AC-007.2, AC-007.3, AC-008.3, AC-008.4, AC-008.5, AC-N003.1] (test) `POST /api/auth/reset-password`: éxito con login nuevo y viejo, reutilización, enlaces sustituidos, token inventado o ausente y hash en `db_session` — `backend/tests/test_routes/test_password_reset_routes.py`
- [ ] T-037 [REQ-009, NFR-002, AC-009.1, AC-009.5, AC-009.6, AC-009.8, AC-009.9, AC-N002.1] (test) Contraseñas corta, de 73 y 74 bytes (400 exactos, nunca 5xx) y de 72 bytes (200 y login), y tokens distintos entre emisiones — `backend/tests/test_routes/test_password_reset_routes.py`
- [ ] T-038 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5, AC-012.6, AC-012.7, AC-012.8, AC-012.9] (test) Límite por IP de punta a punta con `X-Forwarded-For` (el test client hace de proxy) — `backend/tests/test_routes/test_password_reset_routes.py`

### Tests de frontend
- [ ] T-039 [REQ-001, REQ-011, AC-001.1, AC-011.4] (test) Enlace "¿Olvidaste tu contraseña?" a `/forgot-password` y aviso de éxito cuando `state.passwordReset` es `true` (y no sin él) — `frontend/src/features/auth/components/LoginForm.test.tsx`
- [ ] T-040 [REQ-001, AC-001.2] (test) `/forgot-password` y `/reset-password?token=abc` son accesibles sin sesión y sin redirección al login — `frontend/src/app/router.test.tsx`
- [ ] T-041 [REQ-005, REQ-010, AC-005.3, AC-010.1, AC-010.2, AC-010.3, AC-010.4] (test) Formulario de solicitud: validación del correo, mensaje de éxito, errores 429 (correo e IP) y 503, estado "Enviando..." y enlace "Volver al login" — `frontend/src/features/auth/components/ForgotPasswordForm.test.tsx`
- [ ] T-042 [REQ-011, AC-011.2, AC-011.3, AC-011.5, AC-011.7, AC-011.8, AC-011.9] (test) Formulario de nueva contraseña: mínimo 8, no coinciden, 73 bytes y `ñ`×37 sin petición, error 400 con enlace "Solicitar un enlace nuevo", "Guardando..." y cuerpo con `token` y `password` — `frontend/src/features/auth/components/ResetPasswordForm.test.tsx`
- [ ] T-043 [REQ-011, AC-011.1, AC-011.4, AC-011.6] (test) Página de reset: campos con token, mensaje de enlace no válido sin token o vacío, y flujo de punta a punta hasta `/login` con el aviso — `frontend/src/features/auth/pages/ResetPasswordPage.test.tsx`

## Fase B — Implementación (implementer)

### Backend (models → migration → config → utils → repositories → services → routes)
- [ ] T-050 [REQ-002, REQ-004, REQ-012] (migration) Migración `create password_reset_requests table` (`down_revision = 'e28ebf553c7d'`), revisada a mano: solo `create_table` con tres índices simples y el compuesto, y su inverso en `downgrade()`; sin operaciones espurias — `backend/migrations/versions/`
- [ ] T-051 [REQ-002, REQ-012] (config) `MAIL_BACKEND`, `RESEND_API_KEY`, `MAIL_FROM`, `FRONTEND_BASE_URL` y `PROXY_FIX_X_FOR` en `Config`, `ProductionConfig` y `TestingConfig` (valores fijos en tests) — `backend/config.py`
- [ ] T-052 [REQ-002, REQ-006, NFR-001, AC-002.2, AC-002.3, AC-006.1, AC-N001.2] (impl) `EmailSender`, `ResendTransport` (urllib, timeout 10, sin filtrar la API key), `ConsoleTransport` e `InMemoryTransport` — `backend/utils/email_sender.py`
- [ ] T-053 [REQ-002, REQ-012] (impl) `email_sender.init_app(app)` y `ProxyFix(x_for=PROXY_FIX_X_FOR)` en `create_app()` — `backend/app.py`
- [ ] T-054 [REQ-004, REQ-008, REQ-012] (impl) Repositorio: `lock_keys` (advisory locks en orden), `count_recent_by_ip`, `get_latest_by_email`, `get_by_token_hash`, `invalidate_active_for_user` — `backend/repositories/password_reset_repository.py`
- [ ] T-055 [REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-012, NFR-001, NFR-002] (impl) Constantes de mensajes, `utc_now`, `hash_token` y `request_reset` (validación, locks, límite por IP, límite por correo, envío antes de escribir) — `backend/services/password_reset_service.py`
- [ ] T-056 [REQ-007, REQ-008, REQ-009, NFR-003] (impl) `reset_password` (token, mínimo 8, máximo 72 bytes, bcrypt, `used_at`) — `backend/services/password_reset_service.py`
- [ ] T-057 [REQ-002, REQ-007, REQ-012] (impl) `_build_password_reset_service()` y vistas `forgot_password` (con `request.remote_addr`) y `reset_password` — `backend/routes/auth_routes.py`
- [ ] T-058 [REQ-002, REQ-012] (config) Documentar las cinco variables nuevas — `backend/.env.example`

### Frontend (types → schemas → api → hooks → components → pages → router)
- [ ] T-060 [REQ-005, REQ-009, REQ-011, AC-005.3, AC-011.2, AC-011.3, AC-011.8, AC-011.9] (impl) `forgotPasswordSchema` y `resetPasswordSchema` (puntos de código, bytes con `TextEncoder`, confirmación) — `frontend/src/features/auth/schemas.ts`
- [ ] T-061 [REQ-010, REQ-011] (impl) `requestPasswordReset` y `resetPassword` con `apiFetch` — `frontend/src/features/auth/api.ts`
- [ ] T-062 [REQ-010, REQ-011] (impl) `useRequestPasswordReset` y `useResetPassword` (navega a `/login` con `state.passwordReset`) — `frontend/src/features/auth/hooks.ts`
- [ ] T-063 [REQ-005, REQ-010] (impl) `ForgotPasswordForm` real — `frontend/src/features/auth/components/ForgotPasswordForm.tsx`
- [ ] T-064 [REQ-011] (impl) `ResetPasswordForm` real — `frontend/src/features/auth/components/ResetPasswordForm.tsx`
- [ ] T-065 [REQ-001, REQ-010] (impl) `ForgotPasswordPage` real con `AuthLayout` — `frontend/src/features/auth/pages/ForgotPasswordPage.tsx`
- [ ] T-066 [REQ-011] (impl) `ResetPasswordPage` real (lee `token`, mensaje de enlace no válido) — `frontend/src/features/auth/pages/ResetPasswordPage.tsx`
- [ ] T-067 [REQ-001, REQ-011] (impl) Enlace "¿Olvidaste tu contraseña?" y aviso de éxito en el login — `frontend/src/features/auth/components/LoginForm.tsx`
- [ ] T-068 [REQ-001] (impl) Rutas públicas `/forgot-password` y `/reset-password` con `PageTransition`, antes del comodín — `frontend/src/app/router.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-039 | T-067 |
| REQ-001 | AC-001.2 | T-040 | T-065, T-068 |
| REQ-002 | AC-002.1 | T-023, T-033 | T-055, T-057 |
| REQ-002 | AC-002.2 | T-023, T-033 | T-052, T-053, T-055 |
| REQ-002 | AC-002.3 | T-023, T-033 | T-052, T-055 |
| REQ-002 | AC-002.4 | T-023 | T-055 |
| REQ-003 | AC-003.1 | T-023, T-033 | T-055, T-057 |
| REQ-003 | AC-003.2 | T-023, T-033 | T-055, T-057 |
| REQ-004 | AC-004.1 | T-024, T-034 | T-054, T-055 |
| REQ-004 | AC-004.2 | T-024 | T-055, T-056 |
| REQ-004 | AC-004.3 | T-024, T-034 | T-055 |
| REQ-004 | AC-004.4 | T-024, T-034 | T-055 |
| REQ-004 | AC-004.5 | T-024, T-034 | T-055 |
| REQ-005 | AC-005.1 | T-025, T-034 | T-055, T-057 |
| REQ-005 | AC-005.2 | T-025, T-034 | T-055, T-057 |
| REQ-005 | AC-005.3 | T-041 | T-060, T-063 |
| REQ-006 | AC-006.1 | T-026, T-035 | T-052, T-055 |
| REQ-006 | AC-006.2 | T-026, T-035 | T-055 |
| REQ-006 | AC-006.3 | T-026 | T-055 |
| REQ-007 | AC-007.1 | T-027, T-036 | T-056, T-057 |
| REQ-007 | AC-007.2 | T-027, T-036 | T-056 |
| REQ-007 | AC-007.3 | T-027, T-036 | T-056 |
| REQ-008 | AC-008.1 | T-028 | T-056 |
| REQ-008 | AC-008.2 | T-028 | T-056 |
| REQ-008 | AC-008.3 | T-028, T-036 | T-054, T-055, T-056 |
| REQ-008 | AC-008.4 | T-028, T-036 | T-054, T-056 |
| REQ-008 | AC-008.5 | T-028, T-036 | T-056 |
| REQ-009 | AC-009.1 | T-029, T-037 | T-056 |
| REQ-009 | AC-009.2 | T-029 | T-056 |
| REQ-009 | AC-009.3 | T-029 | T-056 |
| REQ-009 | AC-009.4 | T-029 | T-056 |
| REQ-009 | AC-009.5 | T-029, T-037 | T-056 |
| REQ-009 | AC-009.6 | T-029, T-037 | T-056 |
| REQ-009 | AC-009.7 | T-029 | T-056 |
| REQ-009 | AC-009.8 | T-029, T-037 | T-056 |
| REQ-009 | AC-009.9 | T-029, T-037 | T-056 |
| REQ-010 | AC-010.1 | T-041 | T-061, T-062, T-063, T-065 |
| REQ-010 | AC-010.2 | T-041 | T-063 |
| REQ-010 | AC-010.3 | T-041 | T-063 |
| REQ-010 | AC-010.4 | T-041 | T-063 |
| REQ-011 | AC-011.1 | T-043 | T-064, T-066 |
| REQ-011 | AC-011.2 | T-042 | T-060, T-064 |
| REQ-011 | AC-011.3 | T-042 | T-060, T-064 |
| REQ-011 | AC-011.4 | T-039, T-043 | T-062, T-066, T-067 |
| REQ-011 | AC-011.5 | T-042 | T-064 |
| REQ-011 | AC-011.6 | T-043 | T-066 |
| REQ-011 | AC-011.7 | T-042 | T-064 |
| REQ-011 | AC-011.8 | T-042 | T-060, T-064 |
| REQ-011 | AC-011.9 | T-042 | T-060, T-064 |
| REQ-012 | AC-012.1 | T-031, T-038 | T-054, T-055 |
| REQ-012 | AC-012.2 | T-031, T-038 | T-054, T-055 |
| REQ-012 | AC-012.3 | T-031, T-038 | T-054, T-055 |
| REQ-012 | AC-012.4 | T-031, T-038 | T-055, T-057 |
| REQ-012 | AC-012.5 | T-031, T-038 | T-055 |
| REQ-012 | AC-012.6 | T-032, T-038 | T-055 |
| REQ-012 | AC-012.7 | T-032, T-038 | T-055 |
| REQ-012 | AC-012.8 | T-032, T-038 | T-055 |
| REQ-012 | AC-012.9 | T-038 | T-051, T-053, T-057 |
| NFR-001 | AC-N001.1 | T-023, T-033 | T-055, T-057 |
| NFR-001 | AC-N001.2 | T-026, T-035 | T-052, T-055 |
| NFR-002 | AC-N002.1 | T-030, T-037 | T-055 |
| NFR-003 | AC-N003.1 | T-027, T-036 | T-056 |
