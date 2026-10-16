# Verify report 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Modo:** red (tras la etapa tests), iteración 2
- **Fecha:** 2026-10-16T02:20:07.306Z · **Rama:** `feat/014-auth-hardening` @ `6617a78` (con cambios de tests sin commit) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q {files}` sobre los 7 archivos de test con marcador `SDD: 014` (`backend`) | ✅ | 77 tests nuevos: 69 fallan de forma legítima y 8 pasan, los 8 son guardas de no regresión exceptuadas por el usuario. Ningún test nuevo falla por fixture ni import ilegítimo. Los tests existentes de esos archivos siguen en verde. |
| frontend | `npx vitest run {files}` sobre `LoginForm.test.tsx` y `RegisterForm.test.tsx` (`frontend`) | ✅ | 12 tests nuevos: 5 fallan de forma legítima y 7 pasan, los 7 son guardas de no regresión exceptuadas por el usuario. Los tests existentes siguen en verde. |

Modo red: no se ejecutan `lint`, `typecheck` ni `build`. El ratchet de ruff no aplica en esta etapa.

### 1.1 Cambios respecto a la iteración 1
- `test_auth_service.py::test_login_rejects_a_missing_email_without_querying` y `::test_login_rejects_a_non_text_email_without_querying` ya no fallan por el fake: ahora fallan por aserción (`assert [None] == []` y `assert [123] == []`). Rojo legítimo.
- `test_auth_service.py::test_register_rejects_a_duplicate_email_ignoring_case` (AC-001.2) ya no pasa: falla con `DID NOT RAISE ConflictError`. Rojo legítimo. Era la única guarda que no estaba exceptuada.
- El resto de tests nuevos no ha cambiado de estado respecto a la iteración 1.

### 1.2 Escaneo de esqueletos (scaffold)
- `backend/services/credential_rules.py`: `normalize_email`, `validate_email`, `validate_new_password` y `exceeds_bcrypt_limit` solo lanzan `NotImplementedError("not implemented")`. Las constantes tienen su valor final. ✅
- `backend/services/auth_service.py`: `verify_google_id_token` solo lanza `not implemented`. `AuthService.__init__` guarda `google_token_verifier` sin lanzar y `login_with_google` no cambia. ✅
- `backend/utils/email_sender.py`: `escape_log_text` solo lanza `not implemented`. `_error_snippet` no cambia. ✅
- `frontend/src/features/auth/hooks.ts`: `usePasswordResetNotice` solo lanza `not implemented`. ✅

### 1.3 Clasificación de los fallos (rojo)
- **Rojo legítimo (69 backend y 5 frontend):** `NotImplementedError` de los esqueletos, aserciones fallidas (`assert 201 == 400`, `assert 401 == 200`, `assert [200, 200] == [200, 400]`, etc.), `DID NOT RAISE`, respuestas `500` donde se espera `400` o `401` (campos ausentes, numéricos o contraseña de 73 bytes llegan a bcrypt o a la consulta SQL sin validar), `Invalid Google token` porque `login_with_google` aún no usa `google_token_verifier` inyectado, texto del formulario ausente (`Contraseña demasiado larga`, `Mínimo 8 caracteres`), aserciones sobre los avisos de `/login` (`expected true not to be true`), y el archivo de la migración `a7d3f9c1e5b2_lowercase_user_emails.py`, aún inexistente y definido en el plan.
- **Rojo ilegítimo:** ninguno.

Notas sobre fallos en cadena (legítimos): `test_link_requested_with_uppercase_email_resets_the_account_password` falla en `request_token` (`IndexError`) porque el correo en mayúsculas aún no encuentra la cuenta y no sale ningún correo. Es el mismo comportamiento ausente de AC-003.1.

### 1.4 Tests nuevos que pasan sin implementación (exceptuados)
Todos son guardas de comportamiento existente, exceptuadas por el usuario en la iteración 1 (ver "Comentarios del usuario").

Backend (8):
- `tests/test_routes/test_auth_routes.py::test_register_accepts_a_password_of_exactly_8_characters` (AC-006.4).
- `tests/test_routes/test_auth_routes.py::test_register_accepts_a_password_of_72_bytes` (AC-006.6).
- `tests/test_routes/test_auth_routes.py::test_register_accepts_36_enyes_that_are_72_bytes` (AC-006.8).
- `tests/test_routes/test_auth_routes.py::test_login_with_uppercase_email_and_wrong_password_returns_401` (AC-002.3).
- `tests/test_routes/test_auth_routes.py::test_login_without_email_returns_401` (AC-009.3).
- `tests/test_routes/test_password_reset_routes.py::test_used_link_is_rejected_and_the_password_does_not_change` (AC-010.4).
- `tests/test_routes/test_password_reset_routes.py::test_invalid_password_in_a_simultaneous_reset_does_not_consume_the_link` (AC-010.3).
- `tests/test_services/test_email_sender.py::test_logged_error_body_keeps_accented_letters_unchanged` (AC-012.4).

Frontend (7):
- `RegisterForm.test.tsx`: "muestra Mínimo 8 caracteres con 7 caracteres y no envia la peticion" (AC-008.1); "envia el registro con 36 eñes (exactamente 72 bytes)" (AC-008.4); "muestra el error 400 del servidor sobre la contraseña demasiado larga" (AC-008.6).
- `LoginForm.test.tsx`: "muestra el aviso al llegar a /login tras restablecer la contraseña" (AC-011.1); "mantiene el aviso visible mientras se escribe en los campos" (AC-011.2); "mantiene el aviso visible cuando un intento de login falla con 401" (AC-011.2); "no muestra el aviso en una visita a /login sin venir de un restablecimiento" (AC-011.5).

### 1.5 Tests nuevos con rojo legítimo (resumen)
- Backend (69): `credential_rules` (17), `auth_service` (15), `password_reset_service` (2), `email_sender` (6), `lowercase_emails_migration` (3), `auth_routes` (21), `password_reset_routes` (5).
- Frontend (5): `RegisterForm` (3: AC-008.2, AC-008.3, AC-008.5) y `LoginForm` (2: AC-011.3, AC-011.4).

## 2. Trazabilidad
Modo red: la trazabilidad completa (REQ → tarea, tareas `[x]`, `skip`/`xfail`) se comprueba en verify. Aquí solo se confirma que cada AC tiene un test nuevo con marcador y el estado de ese test.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-011, T-015 | `test_auth_service.py::test_register_stores_the_normalized_email`, `test_auth_routes.py::test_register_stores_and_returns_the_email_trimmed_and_lowercase` | ❌ rojo legítimo |
| REQ-001 | AC-001.2 | T-011, T-015 | `test_auth_service.py::test_register_rejects_a_duplicate_email_ignoring_case`, `test_auth_routes.py::test_register_rejects_a_duplicate_email_that_differs_only_in_case` | ❌ rojo legítimo |
| REQ-002 | AC-002.1, 002.2 | T-011, T-016 | `test_auth_service.py::test_login_finds_the_account_with_*`, `test_auth_routes.py::test_login_accepts_an_email_with_*` | ❌ rojo legítimo |
| REQ-002 | AC-002.3 | T-016 | `test_auth_routes.py::test_login_with_uppercase_email_and_wrong_password_returns_401` | ✅ guarda exceptuada |
| REQ-003 | AC-003.1, 003.2 | T-012, T-017 | `test_password_reset_service.py::test_request_reset_normalizes_the_email_for_lock_lookup_row_and_delivery`, `test_password_reset_routes.py::test_forgot_password_with_uppercase_email_*`, `test_email_cooldown_ignores_letter_case` | ❌ rojo legítimo |
| REQ-003 | AC-003.3 | T-017 | `test_password_reset_routes.py::test_link_requested_with_uppercase_email_resets_the_account_password` | ❌ rojo legítimo |
| REQ-004 | AC-004.1, 004.2 | T-011 | `test_auth_service.py::test_google_login_links_the_existing_account_with_an_uppercase_email`, `test_google_login_creates_the_account_with_a_lowercase_email` | ❌ rojo legítimo |
| REQ-005 | AC-005.1 | T-015, T-016 | `test_auth_routes.py::test_login_finds_a_legacy_account_stored_with_uppercase`, `test_register_rejects_an_email_matching_a_legacy_account_with_uppercase` | ❌ rojo legítimo |
| REQ-005 | AC-005.2 | T-015 | `test_auth_routes.py::test_register_rejects_an_email_matching_a_legacy_account_with_uppercase` | ❌ rojo legítimo |
| REQ-005 | AC-005.3, 005.4 | T-014 | `test_lowercase_emails_migration.py` (3 tests) | ❌ rojo legítimo (archivo de migración inexistente) |
| REQ-006 | AC-006.1 … 006.3, 006.5, 006.7, 006.9, 006.10 | T-010, T-011, T-015 | `test_credential_rules.py`, `test_auth_routes.py` | ❌ rojo legítimo |
| REQ-006 | AC-006.4, 006.6, 006.8 | T-010, T-015 | `test_auth_routes.py` (tests de límites) | ✅ guardas exceptuadas |
| REQ-007 | AC-007.1 … 007.4 | T-010, T-011, T-015 | `test_credential_rules.py`, `test_auth_service.py`, `test_auth_routes.py` | ❌ rojo legítimo |
| REQ-008 | AC-008.1, 008.4, 008.6 | T-019 | `RegisterForm.test.tsx` | ✅ guardas exceptuadas |
| REQ-008 | AC-008.2, 008.3, 008.5 | T-019 | `RegisterForm.test.tsx` | ❌ rojo legítimo |
| REQ-009 | AC-009.1 … 009.5 | T-011, T-016 | `test_auth_service.py`, `test_auth_routes.py` | ❌ rojo legítimo; AC-009.3 de ruta pasa como guarda exceptuada |
| REQ-010 | AC-010.1 | T-018 | `test_password_reset_routes.py::test_two_simultaneous_resets_with_the_same_link_only_one_wins` | ❌ rojo legítimo |
| REQ-010 | AC-010.2 | T-018 | `test_password_reset_routes.py` (concurrencia) | ❌ rojo legítimo |
| REQ-010 | AC-010.3, 010.4 | T-017, T-018 | `test_password_reset_routes.py` | ✅ guardas exceptuadas |
| REQ-011 | AC-011.1, 011.2, 011.5 | T-020 | `LoginForm.test.tsx` | ✅ guardas exceptuadas |
| REQ-011 | AC-011.3, 011.4 | T-020 | `LoginForm.test.tsx` | ❌ rojo legítimo |
| REQ-012 | AC-012.1 … 012.3, 012.5, 012.6 | T-013, T-017 | `test_email_sender.py`, `test_password_reset_routes.py` | ❌ rojo legítimo |
| REQ-012 | AC-012.4 | T-013 | `test_email_sender.py::test_logged_error_body_keeps_accented_letters_unchanged` | ✅ guarda exceptuada |
| NFR-001 | AC-N001.1 | T-017 | `test_password_reset_routes.py` (marcador NFR-001) | ❌ rojo legítimo |

- AC sin test: —
- REQ sin tarea: — (comprobación completa en verify)
- Tareas sin marcar `[x]`: — (comprobación completa en verify; T-001 a T-004 y T-010 a T-020 marcadas `[x]`, y T-030 a T-038 sin marcar, lo esperado en esta etapa)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno

## 3. Criterios de aceptación manuales
- Ninguno en esta etapa. Los AC de UX del aviso de `/login` (AC-011.1 a AC-011.5) tienen test automatizado.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |

Entorno: Postgres y Redis activos. No hay errores de entorno.

## Comentarios del usuario

a, excepción como en la 012
