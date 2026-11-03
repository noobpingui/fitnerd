# Verify report 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Modo:** full (etapa verify, 2.ª pasada)
- **Fecha:** 2026-11-03T01:22:18.809Z · **Rama:** `feat/033-profile-first-name` @ `b1e03ac` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2899 passed en 180 s, exit 0 |
| backend | lint: ratchet (`lint-ratchet.mjs backend`) | ✅ | sin violaciones nuevas respecto a `main` (exit 0); `auth_service.py` con 3 previas toleradas |
| frontend | `npm test` (`frontend`) | ✅ | 94 archivos, 1910 tests passed, exit 0 |
| frontend | `npm run lint` (oxlint) | ✅ | exit 0 |
| frontend | `npx tsc -b` (`frontend`) | ✅ | sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | build correcto, exit 0 |

Los comandos `typecheck` y `build` del ámbito backend están a `null` en la config y no se ejecutan.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD: 033` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.4 | T-010, T-011, T-012, T-040 | `test_auth_routes.py`, `test_auth_service.py`, `test_fixed_clock_routes.py` | ✅ |
| REQ-002 | AC-002.1, AC-002.2 | T-021, T-050, T-051 | `RegisterForm.test.tsx`, `auth/schemas.test.ts` | ✅ |
| REQ-003 | AC-003.1 | T-022 | `OnboardingPage.test.tsx` (guarda de regresión, excepción B5.2 aprobada) | ✅ |
| REQ-004 | AC-004.1 a AC-004.3 | T-013, T-023, T-025, T-042, T-052 | `test_profile_routes.py`, `profile/schemas.test.ts` | ✅ |
| REQ-005 | AC-005.1 a AC-005.4 | T-014, T-016, T-041 | `test_profile_routes.py`, `test_profile_service.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.4 | T-015, T-016, T-041 | `test_profile_routes.py`, `test_profile_service.py` | ✅ |
| REQ-007 | AC-007.1 a AC-007.8 | T-024, T-026, T-027, T-028, T-052, T-053 | `ProfilePage.test.tsx`, `mappers.test.ts`, `profile/schemas.test.ts`, `schemas.test.ts` | ✅ |
| REQ-008 | AC-008.1 a AC-008.6 | T-020, T-021, T-023, T-050 | `auth/schemas.test.ts`, `profile/schemas.test.ts`, `RegisterForm.test.tsx` | ✅ |
| REQ-009 | AC-009.1 a AC-009.4 | T-026, T-029 a T-033, T-054 | `greeting.test.ts`, `HomePage.test.tsx`, `ProfilePage.test.tsx`, `router.test.tsx`, `lazyRoutes.test.tsx`, `diaryRoute.test.tsx` | ✅ |

- AC sin test: ninguno. Los 36 AC de `spec.md` tienen al menos un marcador `SDD: 033` (67 marcadores en total) y los tests pasan.
- REQ sin tarea: ninguno. REQ-001 a REQ-009 aparecen en `tasks.md`.
- Tareas sin marcar `[x]`: ninguna. 33 de 33 marcadas.
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff (`main...HEAD`, backend y frontend): ninguno.

## 3. Criterios de aceptación manuales
Los AC de texto y estructura están cubiertos por tests automáticos. Conviene que el usuario compruebe en el navegador:
- AC-007.1 y AC-007.8: el aspecto visual del campo «Nombre» como primer campo de «Datos personales» en `/profile`.
- AC-009.4: que tras guardar un nombre en `/profile` y navegar a `/home` sin recargar, el saludo se actualiza en la app real.
- AC-003.1: que una cuenta nueva ve la fecha vacía en `/onboarding` y no avanza sin fecha válida (el test pasa en jsdom, pero no en navegador).

## 4. Fallos (si los hay)
Ninguno. La pasada anterior (FAIL por 3 E501 en tests) queda resuelta: el ratchet de backend pasa sin violaciones nuevas.

## Observaciones (no bloquean; van al backlog de la feature)
- `state.json` indica 37 AC y `spec.md` define 36 (4+2+1+3+4+4+8+6+4). Todos tienen test. Corregir el dato en el estado o en el backlog.
- `tasks.md` marca T-028 como hecha, pero `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx` no aparece en el diff de la feature. Revisar si el test ya pasa sin cambios o si la casilla es incorrecta.
- El marcador `SDD: 033` de AC-009.4 está en `ProfilePage.test.tsx` (la comprobación de `/home` tras guardar vive ahí). Cubierto, pero conviene revisarlo en review.

## Resultado de la etapa
PASS. Todas las comprobaciones objetivas están en verde: tests de backend (2899) y frontend (1910), ratchet de lint de backend sin violaciones nuevas, lint, typecheck y build de frontend, trazabilidad completa (36/36 AC, 9/9 REQ, 33/33 tareas) y sin skips nuevos.
