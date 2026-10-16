# Verify report 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Modo:** full (etapa verify), ciclo de review 2
- **Fecha:** 2026-10-16T03:12:03.822Z · **Rama:** `feat/014-auth-hardening` @ `1ac3b26` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 807 passed, 0 failed |
| backend | ratchet ruff: `node …/lint-ratchet.mjs backend` (raíz del repo) | ✅ | Sin violaciones nuevas respecto a main (14 archivos de la feature revisados; 5 y 3 violaciones previas toleradas en `user_repository.py` y `auth_service.py`) |
| frontend | `npm test` (`frontend`) | ✅ | 504 passed, 0 failed (43 archivos) |
| frontend | `npm run lint` (`frontend`) | ✅ | 0 errores. 2 warnings previos en archivos que la feature no toca: `src/components/ui/form.tsx:159` y `src/components/ui/button.tsx:64` |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto. Aviso no bloqueante de chunk de más de 500 kB (previo) |

## 2. Trazabilidad
Los 60 AC de `spec.md` (59 de REQ-001 a REQ-013 y AC-N001.1) aparecen en al menos un marcador `SDD: 014` de un test, y la suite de cada ámbito pasa en verde. Las 42 tareas (T-001 a T-042) están marcadas `[x]`.

| REQ / NFR | AC | Tareas | Tests con `SDD:` (archivos principales) | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2 | T-011, T-015, T-030, T-031, T-033 | `test_auth_routes.py`, `test_auth_service.py`, `test_credential_rules.py` | ✅ |
| REQ-002 | AC-002.1 a AC-002.3 | T-011, T-016, T-031, T-033 | `test_auth_routes.py`, `test_auth_service.py` | ✅ |
| REQ-003 | AC-003.1 a AC-003.3 | T-012, T-017, T-031, T-034 | `test_password_reset_service.py`, `test_password_reset_routes.py` | ✅ |
| REQ-004 | AC-004.1, AC-004.2 | T-011, T-031, T-033 | `test_auth_service.py` | ✅ |
| REQ-005 | AC-005.1 a AC-005.4 | T-014, T-015, T-016, T-031, T-033, T-036 | `test_lowercase_emails_migration.py`, `test_auth_routes.py`, `test_auth_service.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.10 | T-010, T-011, T-015, T-030, T-033 | `test_credential_rules.py`, `test_auth_routes.py`, `test_auth_service.py` | ✅ |
| REQ-007 | AC-007.1 a AC-007.4 | T-010, T-011, T-015, T-030, T-033 | `test_credential_rules.py`, `test_auth_routes.py`, `test_auth_service.py` | ✅ |
| REQ-008 | AC-008.1 a AC-008.6 | T-019, T-037 | `RegisterForm.test.tsx` | ✅ |
| REQ-009 | AC-009.1 a AC-009.5 | T-011, T-016, T-030, T-033 | `test_auth_routes.py`, `test_auth_service.py` | ✅ |
| REQ-010 | AC-010.1 a AC-010.4 | T-017, T-018, T-021, T-022, T-032, T-034, T-039, T-040 | `test_password_reset_routes.py`, `test_password_reset_service.py` | ✅ |
| REQ-011 | AC-011.1 a AC-011.5 | T-020, T-038 | `LoginForm.test.tsx` | ✅ |
| REQ-012 | AC-012.1 a AC-012.6 | T-013, T-017, T-035, T-041 | `test_email_sender.py`, `test_password_reset_routes.py` | ✅ |
| REQ-013 | AC-013.1 a AC-013.5 | T-027, T-028, T-029, T-042 | `RegisterForm.test.tsx`, `LoginForm.test.tsx`, `ForgotPasswordForm.test.tsx`, `schemas.test.ts` | ✅ |
| NFR-001 | AC-N001.1 | T-017, T-023 a T-026, T-033, T-034 | Suites de autenticación, recuperación y correo | ✅ |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: —
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno

## 3. Criterios de aceptación manuales
Todos los AC tienen test automático. Se recomienda una comprobación manual en navegador real de AC-011.3 y AC-011.4 (comportamiento del historial del navegador), que los tests de componentes solo simulan.

## 4. Fallos (si los hay)
Ninguno.

## Comentarios del usuario

a, excepción como en la 012
