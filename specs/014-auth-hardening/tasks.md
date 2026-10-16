# Tareas 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-16)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-001, REQ-006, REQ-007, REQ-009] (scaffold) Crear `normalize_email`, `validate_email`, `validate_new_password` y `exceeds_bcrypt_limit` con las firmas del plan, que lancen `NotImplementedError("not implemented")`; las constantes (`INVALID_EMAIL_MESSAGE`, `PASSWORD_TOO_SHORT_MESSAGE`, `PASSWORD_TOO_LONG_MESSAGE`, `MIN_PASSWORD_CHARS`, `MAX_PASSWORD_BYTES`, `EMAIL_PATTERN`) ya con su valor final — `backend/services/credential_rules.py`
- [x] T-002 [REQ-004] (scaffold) Crear `verify_google_id_token(id_token_str, client_id)` que lance "not implemented" y añadir a `AuthService.__init__` el parámetro `google_token_verifier=verify_google_id_token` (se guarda sin lanzar; `login_with_google` no cambia todavía) — `backend/services/auth_service.py`
- [x] T-003 [REQ-012] (scaffold) Crear `escape_log_text(text)` que lance "not implemented" (sin usarla aún en `_error_snippet`) — `backend/utils/email_sender.py`
- [x] T-004 [REQ-011] (scaffold) Crear `usePasswordResetNotice(): boolean` que lance `throw new Error("not implemented");` (sin usarla aún en `LoginForm`) — `frontend/src/features/auth/hooks.ts`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-006, REQ-007, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-006.7, AC-006.8, AC-006.9, AC-007.1, AC-007.2, AC-007.4] (test) Unitarios de `normalize_email`, `validate_email` y `validate_new_password` en sus fronteras, con mensajes exactos — `backend/tests/test_services/test_credential_rules.py`
- [x] T-011 [REQ-001, REQ-002, REQ-004, REQ-006, REQ-007, REQ-009, AC-001.1, AC-001.2, AC-002.1, AC-002.2, AC-004.1, AC-004.2, AC-006.10, AC-007.3, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5] (test) `AuthService` con fakes a mano: correo normalizado al crear y buscar, login con mayúsculas y espacios, Google con correo en mayúsculas (vincula o crea en minúsculas), orden de validación del registro y login con datos anómalos sin consultar el repositorio — `backend/tests/test_services/test_auth_service.py`
- [x] T-012 [REQ-003, AC-003.1, AC-003.2] (test) `request_reset` con correo en mayúsculas: clave de lock, búsqueda y fila normalizadas, envío a `user.email` y `RateLimitError` ante la variante `ANA@EXAMPLE.COM` — `backend/tests/test_services/test_password_reset_service.py`
- [x] T-013 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5, AC-012.6] (test) `ResendTransport` con `FakeOpener` y `FakeLogger`: saltos, `\r`, `\t`, ESC, U+2028, U+2029 y U+0085 escapados, `ñandú` intacto, recorte antes de escapar y sin API key en el log — `backend/tests/test_services/test_email_sender.py`
- [x] T-014 [REQ-005, AC-005.3, AC-005.4] (test) Migración de correos a minúsculas contra Postgres: conserva el resto de datos y falla sin modificar nada ante conflictos, con los correos en el mensaje — `backend/tests/test_services/test_lowercase_emails_migration.py`
- [x] T-015 [REQ-001, REQ-005, REQ-006, REQ-007, AC-001.1, AC-001.2, AC-005.1, AC-005.2, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-006.7, AC-006.8, AC-006.9, AC-006.10, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (test) Integración de `POST /api/auth/register`: correo normalizado, duplicados sin distinguir mayúsculas (incluida cuenta antigua con mayúsculas), reglas de contraseña y formato de correo con su orden — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-016 [REQ-002, REQ-005, REQ-009, AC-002.1, AC-002.2, AC-002.3, AC-005.1, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5] (test) Integración de `POST /api/auth/login`: correo con mayúsculas y espacios, credenciales erróneas y datos anómalos con `401` — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-017 [REQ-003, REQ-010, REQ-012, NFR-001, AC-003.1, AC-003.2, AC-003.3, AC-010.4, AC-012.6, AC-N001.1] (test) Integración de recuperación de contraseña: correo en mayúsculas, segundo uso secuencial del enlace (con marcador de NFR-001) y `503` extremo a extremo sin API key en el log — `backend/tests/test_routes/test_password_reset_routes.py`
- [x] T-018 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) Concurrencia de `reset-password`: bloqueo `FOR UPDATE` desde el test, dos hilos con `app.test_client()`, espera por `pg_stat_activity` y comprobación de un `200` y un `400` — `backend/tests/test_routes/test_password_reset_routes.py`
- [x] T-019 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6] (test) Formulario de registro: reglas y mensajes de contraseña sin enviar petición, envío con 72 bytes y error `400` del servidor mostrado — `frontend/src/features/auth/components/RegisterForm.test.tsx`
- [x] T-020 [REQ-011, AC-011.1, AC-011.2, AC-011.3, AC-011.4, AC-011.5] (test) Aviso de contraseña actualizada en `/login`: visible en la visita, persiste con edición y `401`, no depende del historial tras recargar ni con "atrás" y ausente sin venir de un restablecimiento — `frontend/src/features/auth/components/LoginForm.test.tsx`

### Iteración 2 — correcciones de la review (F1–F5, REQ-013)
- [x] T-021 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) F1: `FakePasswordResetRepository` gana `get_by_token_hash_for_update` (registra la llamada y ejecuta el gancho `before_lock`) y tres tests de `reset_password`: `"corta"` no toma el bloqueo ni consume el enlace, carrera perdida con `rollback` sin `commit`, y orden lectura sin bloqueo → relectura con bloqueo — `backend/tests/test_services/test_password_reset_service.py`
- [x] T-022 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) F4: en `concurrent_resets`, `assert` en español sobre el resultado de `wait_until`; para AC-010.3 la condición pasa a `done[0] and waiters >= 1` — `backend/tests/test_routes/test_password_reset_routes.py`
- [x] T-023 [NFR-001, AC-N001.1] (test) F2: tildes en docstrings, comentarios, mensajes de `assert` y nombres de tests añadidos por la 014 (bloque "Spec 014"), sin cambiar aserciones ni marcadores — `backend/tests/test_routes/test_password_reset_routes.py`, `backend/tests/test_services/test_email_sender.py`
- [x] T-024 [NFR-001, AC-N001.1] (test) F2: tildes en lo añadido por la 014 en los tests de autenticación y reglas de credenciales, sin cambiar aserciones ni marcadores — `backend/tests/test_routes/test_auth_routes.py`, `backend/tests/test_services/test_auth_service.py`, `backend/tests/test_services/test_credential_rules.py`
- [x] T-025 [NFR-001, AC-N001.1] (test) F2: tildes en lo añadido por la 014 en los tests de migración y de restablecimiento (solo lo de la 014), sin cambiar aserciones ni marcadores — `backend/tests/test_services/test_lowercase_emails_migration.py`, `backend/tests/test_services/test_password_reset_service.py`
- [x] T-026 [NFR-001, AC-N001.1] (test) F2: tildes en nombres de tests, comentarios y docstrings de la 014 en los tests de formularios, sin cambiar aserciones ni marcadores — `frontend/src/features/auth/components/LoginForm.test.tsx`, `frontend/src/features/auth/components/RegisterForm.test.tsx`
- [x] T-027 [REQ-013, AC-013.1, AC-013.4, AC-013.5] (test) Registro: correo `"  Ana@Example.COM "` se envía recortado y con sus mayúsculas; correo de solo espacios y `" no-es-un-correo "` dan "Email inválido" sin llamar a `register` — `frontend/src/features/auth/components/RegisterForm.test.tsx`
- [x] T-028 [REQ-013, AC-013.2] (test) Login: correo `" ana@example.com  "` no da "Email inválido" y el cuerpo de la petición lleva `email: "ana@example.com"` — `frontend/src/features/auth/components/LoginForm.test.tsx`
- [x] T-029 [REQ-013, AC-013.3] (test) Solicitud de restablecimiento: correo `"  Ana@Example.com "` no da "Email inválido" y el cuerpo de la petición lleva `email: "Ana@Example.com"` — `frontend/src/features/auth/components/ForgotPasswordForm.test.tsx`

## Fase B — Implementación (implementer)
- [x] T-030 [REQ-001, REQ-006, REQ-007, REQ-009] (impl) Implementar `normalize_email`, `validate_email`, `validate_new_password` y `exceeds_bcrypt_limit` según el plan — `backend/services/credential_rules.py`
- [x] T-031 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005] (impl) `UserRepository.get_by_email` sin distinguir mayúsculas (`func.lower`, orden por `created_at` e `id`) — `backend/repositories/user_repository.py`
- [x] T-032 [REQ-010] (impl) `get_by_token_hash` con `.with_for_update()` y comentario del bloqueo — `backend/repositories/password_reset_repository.py`
- [x] T-033 [REQ-001, REQ-002, REQ-004, REQ-005, REQ-006, REQ-007, REQ-009, NFR-001] (impl) `AuthService`: `verify_google_id_token` real, registro con correo y contraseña validados antes del duplicado, login robusto con correo normalizado y Google con correo en minúsculas — `backend/services/auth_service.py`
- [x] T-034 [REQ-003, REQ-006, REQ-010, NFR-001] (impl) `PasswordResetService`: importar reglas de `credential_rules` (conservando los nombres como atributos del módulo), `request_reset` con correo normalizado y `reset_password` con la lectura bloqueante dentro del `try` — `backend/services/password_reset_service.py`
- [x] T-035 [REQ-012] (impl) Implementar `escape_log_text` y aplicarla en `ResendTransport._error_snippet` tras quitar la key y recortar — `backend/utils/email_sender.py`
- [x] T-036 [REQ-005] (migration) Migración de datos `a7d3f9c1e5b2` (`down_revision = 'f2c4e6a8b0d1'`): correos a minúsculas con `RuntimeError` y lista de correos ante conflictos, downgrade sin acción — `backend/migrations/versions/a7d3f9c1e5b2_lowercase_user_emails.py`
- [x] T-037 [REQ-008] (impl) `newPasswordSchema` compartido por `registerSchema` y `resetPasswordSchema`, y actualizar el comentario de cabecera — `frontend/src/features/auth/schemas.ts`
- [x] T-038 [REQ-011] (impl) Implementar `usePasswordResetNotice` (estado fijado al montar y `navigate` con `replace` y `state: null`) y usarlo en `LoginForm` — `frontend/src/features/auth/hooks.ts`, `frontend/src/features/auth/components/LoginForm.tsx`

### Iteración 2 — correcciones de la review (F1–F5, REQ-013)
- [x] T-039 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (impl) F1: `get_by_token_hash` vuelve a ser lectura sin bloqueo y nuevo `get_by_token_hash_for_update` con `.with_for_update()` y `populate_existing=True`, con comentario del bloqueo — `backend/repositories/password_reset_repository.py`
- [x] T-040 [REQ-010, AC-010.1, AC-010.2, AC-010.3, AC-010.4] (impl) F1: `reset_password` lee sin bloqueo, valida enlace y contraseña, calcula bcrypt, relee con `get_by_token_hash_for_update` y revalida con `_ensure_link_is_usable`, todo dentro del `try` con `rollback` — `backend/services/password_reset_service.py`
- [x] T-041 [REQ-012, AC-012.2] (impl) F3: claves de U+2028 y U+2029 en `_NAMED_ESCAPES` escritas como `" "` y `" "`, sin cambiar el comportamiento — `backend/utils/email_sender.py`
- [x] T-042 [REQ-013, AC-013.1, AC-013.2, AC-013.3, AC-013.4, AC-013.5] (impl) F5: `emailSchema = z.string().trim().pipe(z.email("Email inválido"))` usado por `loginSchema`, `registerSchema` y `forgotPasswordSchema`, y actualizar el comentario de cabecera — `frontend/src/features/auth/schemas.ts`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-011, T-015 | T-030, T-031, T-033 |
| REQ-001 | AC-001.2 | T-011, T-015 | T-030, T-031, T-033 |
| REQ-002 | AC-002.1 | T-011, T-016 | T-031, T-033 |
| REQ-002 | AC-002.2 | T-011, T-016 | T-031, T-033 |
| REQ-002 | AC-002.3 | T-016 | T-031, T-033 |
| REQ-003 | AC-003.1 | T-012, T-017 | T-031, T-034 |
| REQ-003 | AC-003.2 | T-012, T-017 | T-031, T-034 |
| REQ-003 | AC-003.3 | T-017 | T-031, T-034 |
| REQ-004 | AC-004.1 | T-011 | T-031, T-033 |
| REQ-004 | AC-004.2 | T-011 | T-031, T-033 |
| REQ-005 | AC-005.1 | T-015, T-016 | T-031, T-033 |
| REQ-005 | AC-005.2 | T-015 | T-031, T-033 |
| REQ-005 | AC-005.3 | T-014 | T-036 |
| REQ-005 | AC-005.4 | T-014 | T-036 |
| REQ-006 | AC-006.1 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.2 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.3 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.4 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.5 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.6 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.7 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.8 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.9 | T-010, T-015 | T-030, T-033 |
| REQ-006 | AC-006.10 | T-011, T-015 | T-030, T-033 |
| REQ-007 | AC-007.1 | T-010, T-015 | T-030, T-033 |
| REQ-007 | AC-007.2 | T-010, T-015 | T-030, T-033 |
| REQ-007 | AC-007.3 | T-011, T-015 | T-030, T-033 |
| REQ-007 | AC-007.4 | T-010, T-015 | T-030, T-033 |
| REQ-008 | AC-008.1 | T-019 | T-037 |
| REQ-008 | AC-008.2 | T-019 | T-037 |
| REQ-008 | AC-008.3 | T-019 | T-037 |
| REQ-008 | AC-008.4 | T-019 | T-037 |
| REQ-008 | AC-008.5 | T-019 | T-037 |
| REQ-008 | AC-008.6 | T-019 | T-037 |
| REQ-009 | AC-009.1 | T-011, T-016 | T-030, T-033 |
| REQ-009 | AC-009.2 | T-011, T-016 | T-030, T-033 |
| REQ-009 | AC-009.3 | T-011, T-016 | T-030, T-033 |
| REQ-009 | AC-009.4 | T-011, T-016 | T-030, T-033 |
| REQ-009 | AC-009.5 | T-011, T-016 | T-030, T-033 |
| REQ-010 | AC-010.1 | T-018, T-021, T-022 | T-032, T-034, T-039, T-040 |
| REQ-010 | AC-010.2 | T-018, T-021, T-022 | T-032, T-034, T-039, T-040 |
| REQ-010 | AC-010.3 | T-018, T-021, T-022 | T-032, T-034, T-039, T-040 |
| REQ-010 | AC-010.4 | T-017 | T-032, T-034, T-040 |
| REQ-011 | AC-011.1 | T-020 | T-038 |
| REQ-011 | AC-011.2 | T-020 | T-038 |
| REQ-011 | AC-011.3 | T-020 | T-038 |
| REQ-011 | AC-011.4 | T-020 | T-038 |
| REQ-011 | AC-011.5 | T-020 | T-038 |
| REQ-012 | AC-012.1 | T-013 | T-035 |
| REQ-012 | AC-012.2 | T-013 | T-035, T-041 |
| REQ-012 | AC-012.3 | T-013 | T-035 |
| REQ-012 | AC-012.4 | T-013 | T-035 |
| REQ-012 | AC-012.5 | T-013 | T-035 |
| REQ-012 | AC-012.6 | T-013, T-017 | T-035 |
| REQ-013 | AC-013.1 | T-027 | T-042 |
| REQ-013 | AC-013.2 | T-028 | T-042 |
| REQ-013 | AC-013.3 | T-029 | T-042 |
| REQ-013 | AC-013.4 | T-027 | T-042 |
| REQ-013 | AC-013.5 | T-027 | T-042 |
| NFR-001 | AC-N001.1 | T-017, T-023, T-024, T-025, T-026 | T-033, T-034 |
