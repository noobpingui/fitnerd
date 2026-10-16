# Verify report 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Modo:** red (tras la etapa tests), iteración 2 del ciclo de review
- **Fecha:** 2026-10-16T03:05:04.606Z · **Rama:** `feat/014-auth-hardening` @ `ead2cfb` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -v --tb=line tests/test_services/test_password_reset_service.py tests/test_services/test_email_sender.py tests/test_routes/test_password_reset_routes.py` (`backend`) | ⚠️ | 103 passed, 3 failed. Los 3 fallos son rojos legítimos (ver sección 4). Los 103 en verde incluyen las guardas exentas y los tests con cambios solo de tildes. |
| frontend | `npx vitest run src/features/auth/components/ForgotPasswordForm.test.tsx src/features/auth/components/LoginForm.test.tsx src/features/auth/components/RegisterForm.test.tsx src/features/auth/schemas.test.ts` (`frontend`) | ⚠️ | 33 passed, 3 failed. Los 3 fallos están en `schemas.test.ts` (AC-013.1, AC-013.2, AC-013.3) y son rojos legítimos. |
| backend | ratchet ruff | — | No aplica en modo red. |
| frontend | `npx tsc -b`, `npm run build`, `npm run lint` | — | No aplica en modo red. |

Los comandos `typecheck` y `build` del ámbito `backend` están a `null` en la config y no se listan.

Alcance: tests nuevos o cambiados desde `e2a3976` (T-021 a T-029). Según la excepción del usuario ("Comentarios del usuario"), pueden estar en verde: la guarda de `corta` sin bloqueo (`test_reset_password_with_short_password_does_not_lock_nor_consume_the_link`), AC-013.4 y AC-013.5 (`schemas.test.ts` y `RegisterForm.test.tsx`), los tests de formulario de AC-013.1 a AC-013.3 (`RegisterForm.test.tsx`, `LoginForm.test.tsx`, `ForgotPasswordForm.test.tsx`) y los tests con cambios solo de tildes (F2). Todos ellos pasan, como se esperaba.

Tests nuevos o cambiados que no están exentos y que deben fallar: 6. Los 6 fallan de forma legítima.

Esqueletos `(scaffold)`: en este ciclo no hay tareas scaffold nuevas (T-001 a T-004 ya están implementados desde `f5f152c`); no se comprueban.

Escaneo del diff de tests desde `e2a3976`: ningún `skip`, `xfail`, `.only` ni `.skip` nuevo. No hay `unittest.mock` ni `monkeypatch` nuevos.

## 2. Trazabilidad
Solo se evalúan los AC de este ciclo en modo red. El resto de la trazabilidad se comprueba en la etapa verify.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-010 | AC-010.1 | T-018, T-021, T-022 | `test_password_reset_routes.py::test_two_simultaneous_resets_with_the_same_link_only_one_wins` (cambio solo de tildes; exento) · `test_password_reset_service.py::test_reset_password_reads_without_lock_before_rereading_with_lock` | ✅ exento / ❌ rojo legítimo |
| REQ-010 | AC-010.2 | T-021, T-022 | `test_password_reset_service.py::test_reset_password_lost_race_gives_invalid_link_and_rolls_back_without_commit` | ❌ rojo legítimo |
| REQ-010 | AC-010.3 | T-021, T-022 | `test_password_reset_service.py::test_reset_password_with_short_password_does_not_lock_nor_consume_the_link` (exento) · `test_password_reset_routes.py::test_invalid_password_in_a_simultaneous_reset_does_not_consume_the_link` | ✅ exento / ❌ rojo legítimo |
| REQ-013 | AC-013.1 | T-027, T-042 | `RegisterForm.test.tsx` (exento) · `schemas.test.ts` | ✅ exento / ❌ rojo legítimo |
| REQ-013 | AC-013.2 | T-028, T-042 | `LoginForm.test.tsx` (exento) · `schemas.test.ts` | ✅ exento / ❌ rojo legítimo |
| REQ-013 | AC-013.3 | T-029, T-042 | `ForgotPasswordForm.test.tsx` (exento) · `schemas.test.ts` | ✅ exento / ❌ rojo legítimo |
| REQ-013 | AC-013.4 | T-027, T-042 | `RegisterForm.test.tsx` (exento) · `schemas.test.ts` | ✅ exento |
| REQ-013 | AC-013.5 | T-027, T-042 | `RegisterForm.test.tsx` (exento) · `schemas.test.ts` | ✅ exento |

- AC sin test: — (en este ciclo, todos los AC de REQ-010 y REQ-013 tienen test)
- REQ sin tarea: — (no evaluado en modo red)
- Tareas sin marcar `[x]`: — (no evaluado en modo red)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno

## 3. Criterios de aceptación manuales
- Ninguno en este ciclo.

## 4. Fallos (si los hay)
Ningún test nuevo o cambiado no exento pasa sin implementación. Los 6 rojos se clasifican así:

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | `test_reset_password_lost_race_gives_invalid_link_and_rolls_back_without_commit` (AC-010.2, F1) | `DID NOT RAISE ValidationError`. Rojo legítimo: la carrera perdida no se detecta todavía. | implementer (T-039, T-040) |
| 2 | `test_reset_password_reads_without_lock_before_rereading_with_lock` (AC-010.1, F1) | `ValueError: 'get_by_token_hash_for_update' is not in list`. Rojo legítimo: la relectura con bloqueo no existe todavía. El error viene de la aserción `index`, no de un fallo del fake. | implementer (T-039, T-040) |
| 3 | `test_invalid_password_in_a_simultaneous_reset_does_not_consume_the_link` (AC-010.3, F1/F4) | `AssertionError: las peticiones no llegaron a esperar el bloqueo de la fila`. Rojo legítimo: la aserción de precondición de `concurrent_resets` falla porque la petición con `corta` toma el bloqueo antes de validar; la petición de `corta` no completa sin bloquear. Se marca con reserva: el fallo sale de la precondición del helper y no de la aserción de AC-010.3; el orquestador puede confirmarlo. | implementer (T-039, T-040) |
| 4 | `schemas.test.ts` › el registro recorta el correo y conserva sus mayúsculas (AC-013.1) | `expected false to be true`. `emailSchema` aún no recorta. | implementer (T-042) |
| 5 | `schemas.test.ts` › el login recorta el correo (AC-013.2) | `expected false to be true`. | implementer (T-042) |
| 6 | `schemas.test.ts` › la solicitud de restablecimiento recorta el correo (AC-013.3) | `expected false to be true`. | implementer (T-042) |

Observación: `test_two_simultaneous_resets_with_the_same_link_only_one_wins` pasa. Su helper `concurrent_resets` gana una aserción de precondición (T-022), pero el test solo cambia sus tildes, así que queda dentro de la excepción de tildes. Con la implementación actual, el comportamiento de AC-010.1 ya se cumple.

## Comentarios del usuario

a, excepción como en la 012
