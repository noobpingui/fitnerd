# Verify report 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Modo:** full (etapa verify), iteración 2
- **Fecha:** 2026-10-16T02:33:09.954Z · **Rama:** `feat/014-auth-hardening` @ `e2a3976` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 804 passed (suite completa, incluidos los tests nuevos con marcador `SDD: 014`) |
| backend | ratchet ruff: `node …/lint-ratchet.mjs backend` (raíz del repo) | ✅ | Sin violaciones nuevas respecto a `main` (exit 0). Los 6 E501 de la iteración 1 están corregidos. |
| frontend | `npm test` (`frontend`) | ✅ | 494 passed en 42 archivos |
| frontend | `npm run lint` (`frontend`) | ✅ | 0 errores. 2 warnings previos fuera del diff (`src/components/ui/button.tsx:64`, `src/components/ui/form.tsx:159`) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto. Aviso de chunk mayor de 500 kB (no bloquea) |

Los comandos `typecheck` y `build` del ámbito `backend` están a `null` en la config y no se listan.

## 2. Trazabilidad
Los 55 AC de `spec.md` aparecen en al menos un marcador `SDD: 014` de un test, y la suite completa pasa.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2 | T-010, T-011, T-015, T-030, T-031, T-033 | `test_credential_rules.py`, `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-002 | AC-002.1, AC-002.2, AC-002.3 | T-011, T-016, T-031, T-033 | `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-003 | AC-003.1, AC-003.2, AC-003.3 | T-012, T-017, T-031, T-034 | `test_password_reset_service.py`, `test_password_reset_routes.py` | ✅ |
| REQ-004 | AC-004.1, AC-004.2 | T-011, T-031, T-033 | `test_auth_service.py` | ✅ |
| REQ-005 | AC-005.1, AC-005.2 | T-015, T-016, T-031, T-033 | `test_auth_routes.py` | ✅ |
| REQ-005 | AC-005.3, AC-005.4 | T-014, T-036 | `test_lowercase_emails_migration.py` | ✅ |
| REQ-006 | AC-006.1 … AC-006.10 | T-010, T-011, T-015, T-030, T-033 | `test_credential_rules.py`, `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-007 | AC-007.1 … AC-007.4 | T-010, T-011, T-015, T-030, T-033 | `test_credential_rules.py`, `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-008 | AC-008.1 … AC-008.6 | T-019, T-037 | `RegisterForm.test.tsx` | ✅ |
| REQ-009 | AC-009.1 … AC-009.5 | T-011, T-016, T-030, T-033 | `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-010 | AC-010.1, AC-010.2, AC-010.3 | T-018, T-032, T-034 | `test_password_reset_routes.py` | ✅ |
| REQ-010 | AC-010.4 | T-017, T-032, T-034 | `test_password_reset_routes.py` | ✅ |
| REQ-011 | AC-011.1 … AC-011.5 | T-020, T-038 | `LoginForm.test.tsx` | ✅ |
| REQ-012 | AC-012.1 … AC-012.6 | T-013, T-017, T-035 | `test_email_sender.py`, `test_password_reset_routes.py` | ✅ |
| NFR-001 | AC-N001.1 | T-017, T-033, T-034 | `test_password_reset_routes.py` (marcador NFR-001) | ✅ |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: —
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno (escaneo del diff `main` en `backend` y `frontend`; sin `unittest.mock` ni `monkeypatch` en los tests nuevos)
- Integridad de los tests tras la red check: los hashes SHA-256 de los 9 archivos de test coinciden con `tests_snapshot` de `state.json`, salvo `LoginForm.test.tsx`, cuyo blob en git (`ba93e2f` y `HEAD`) sí coincide con el snapshot; la diferencia de hash en el disco se debe solo a los fines de línea CRLF de la copia de trabajo, y `git status` no lo marca como modificado.
- Cambios de test tras la red check (`ba93e2f` → `HEAD`): solo docstrings (corrección E501 de la iteración 1). Sin cambios de aserciones.

## 3. Criterios de aceptación manuales
- Ninguno. Los AC de UX del aviso de `/login` (AC-011.1 a AC-011.5) tienen test automatizado.

## 4. Fallos (si los hay)
Ninguno. El fallo 1 de la iteración 1 (6 E501 nuevos en tests del ratchet de ruff backend) queda resuelto.

## Comentarios del usuario

a, excepción como en la 012
