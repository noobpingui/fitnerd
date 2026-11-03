# Verify report 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Modo:** full (etapa verify, 2.ª pasada tras las correcciones de review F1 a F5)
- **Fecha:** 2026-11-03T02:29:02.079Z · **Rama:** `feat/033-profile-first-name` @ `1324074` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2899 passed, 0 failed |
| backend | ratchet: `node …/lint-ratchet.mjs backend` (raíz del repo) | ✅ | 16 archivos revisados, sin violaciones nuevas respecto a main (previas toleradas: auth_routes 1, auth_service 3, conftest 1) |
| frontend | `npm test` (`frontend`) | ✅ | Reejecución aislada: 94/94 archivos y 1910/1910 tests passed. Ver nota de intermitencia en la sección 4 |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores (exit 0) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto (exit 0) |

Comandos a `null` en la config (no listados): `typecheck` y `build` del backend, `lint` y `lint_ratchet` del frontend según `.sdd/config.json`.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2, AC-001.3, AC-001.4 | T-010, T-011, T-012, T-040 | `backend/tests/test_routes/test_auth_routes.py` (L676, 691, 701, 713, 724, 789, 802); `backend/tests/test_services/test_auth_service.py` (L328, 340, 444); `backend/tests/test_routes/test_fixed_clock_routes.py` (L181, 192) | ✅ |
| REQ-002 | AC-002.1, AC-002.2 | T-021, T-050, T-051 | `frontend/src/features/auth/components/RegisterForm.test.tsx` (L209, 220); `frontend/src/features/auth/schemas.test.ts` (L67) | ✅ |
| REQ-003 | AC-003.1 | T-022 | `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx` (L226; guarda de regresión, excepción B5.2 aprobada) | ✅ |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3 | T-013, T-023, T-025, T-042, T-052 | `backend/tests/test_routes/test_profile_routes.py` (L495, 508, 516); `frontend/src/features/profile/schemas.test.ts` (L154, 160, 165) | ✅ |
| REQ-005 | AC-005.1, AC-005.2, AC-005.3, AC-005.4 | T-014, T-016, T-041 | `backend/tests/test_routes/test_profile_routes.py` (L527, 539, 553, 565); `backend/tests/test_services/test_profile_service.py` (L422, 439) | ✅ |
| REQ-006 | AC-006.1, AC-006.2, AC-006.3, AC-006.4 | T-015, T-016, T-041 | `backend/tests/test_routes/test_profile_routes.py` (L584, 598, 610, 622); `backend/tests/test_services/test_profile_service.py` (L450, 470) | ✅ |
| REQ-007 | AC-007.1 … AC-007.8 | T-024, T-026, T-027, T-052, T-053 (T-028 sin marcar, ver observaciones) | `frontend/src/features/profile/pages/ProfilePage.test.tsx` (L1176, 1183, 1195, 1221, 1233, 1246, 1256, 1267); `frontend/src/features/profile/mappers.test.ts` (L84, 94); `frontend/src/features/profile/schemas.test.ts` (L115, 123, 132, 145, 184) | ✅ |
| REQ-008 | AC-008.1 … AC-008.6 | T-020, T-021, T-023, T-050 | `frontend/src/features/auth/schemas.test.ts` (L15, 23, 34, 54); `frontend/src/features/auth/components/RegisterForm.test.tsx` (L238, 248, 260); `frontend/src/features/profile/schemas.test.ts` (L132) | ✅ |
| REQ-009 | AC-009.1 … AC-009.4 | T-026, T-029 … T-033, T-054 | `frontend/src/features/home/greeting.test.ts` (L5, 10, 15, 20); `frontend/src/features/home/pages/HomePage.test.tsx` (L110, 120, 137); `frontend/src/app/diaryRoute.test.tsx` (L92); `frontend/src/app/lazyRoutes.test.tsx` (L127); `frontend/src/app/router.test.tsx` (L144); `frontend/src/features/profile/pages/ProfilePage.test.tsx` (L1285, AC-009.4) | ✅ |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-028 (`frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx`). Observación, no FAIL: el AC-007.3 que cubre T-028 lo prueban T-024, T-026 y T-027, con marcador en `ProfilePage.test.tsx` (L1195), `mappers.test.ts` (L94) y `schemas.test.ts` (L184), y esos tests pasan.
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff (`git diff main -- backend frontend`): —
- Los 36 AC tienen al menos un marcador `SDD: 033` y todos sus tests pasan en las ejecuciones de esta etapa.
- NFR: la spec no define NFR.

## 3. Criterios de aceptación manuales
Los AC que dependen de la vista real del navegador no se comprueban de forma automática. Conviene que el usuario los revise:
- AC-007.1 y AC-007.8: aspecto visual del campo «Nombre» como primer campo de «Datos personales» en `/profile`.
- AC-009.4: tras guardar un nombre en `/profile` y navegar a `/home` sin recargar, el saludo se actualiza en la app real.
- AC-003.1: una cuenta nueva ve la fecha vacía en `/onboarding` y no avanza sin fecha válida (el test pasa en jsdom; falta la comprobación en navegador).

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno que bloquee. Observación de intermitencia en la primera ejecución de `npm test` (ver nota) | Primera ejecución, lanzada en paralelo con pytest y el ratchet: `Test Files 2 failed \| 92 passed (94)`, `Tests 2 failed \| 1908 passed (1910)`. Uno de los dos fallos es `src/app/router.test.tsx:170`: `findByRole("heading", { level: 1, name })` no encontró el encabezado a tiempo. El segundo no quedó capturado en la salida recortada. | entorno (intermitente; ya en el backlog del proyecto) |

Nota: en la reejecución aislada de `npm test` no hubo ningún fallo (94/94 archivos, 1910/1910 tests). La intermitencia se atribuye a la carga de la máquina durante la ejecución en paralelo y no a la implementación de la 033. Los tres tests intermitentes conocidos (router, lazyRoutes, accountSwitch) ya están en el backlog.

## Observaciones (no bloquean)
- T-028 sigue sin marcar, según la decisión del orquestador. Su AC-007.3 queda cubierto por otras tareas (ver sección 2).
