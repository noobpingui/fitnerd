# Verify report 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-18T05:45:39.024Z · **Rama:** `feat/017-frontend-polish` @ `1ba5cdd` · **Base:** `main`
- **Resultado:** FAIL

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npm test` (`frontend`) | ✅ | 52 archivos de test y 739 tests, todos pasan (Test Files 52 passed, Tests 739 passed). |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni warnings (salida vacía, código de salida 0). Desaparecen los `only-export-components` de `button.tsx` y `form.tsx`. |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores de tipos (código de salida 0). |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto en 553 ms. Chunk de entrada `dist/assets/index-Bj3eTrgl.js` de 384.07 kB (gzip 122.75 kB), por debajo de 500 kB. Aviso de tamaño de Vite: no aparece. |
| backend | — | — | No aplica: el ámbito `backend` no está tocado (`scopes_touched` = `frontend`). |

Notas:
- `lint_ratchet` no aplica al ámbito `frontend` (su `lint_ratchet` es `null`); se ejecuta `npm run lint`.
- Las guardas de la iteración de red siguen en verde dentro de `npm test`.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-013, T-034 | `features/profile/pages/ProfilePage.test.tsx` | ✅ |
| REQ-001 | AC-001.2 | T-013, T-034 | `features/profile/pages/ProfilePage.test.tsx` | ✅ |
| REQ-001 | AC-001.3 | T-014, T-034 | `features/profile/pages/ProfilePage.test.tsx` | ✅ |
| REQ-001 | AC-001.4 | T-014, T-034 | `features/profile/pages/ProfilePage.test.tsx` | ✅ |
| REQ-001 | AC-001.5 | T-011, T-012, T-033 | `features/onboarding/schemas.test.ts`, `features/profile/schemas.test.ts` | ✅ |
| REQ-001 | AC-001.6 | T-015, T-033 | `features/onboarding/pages/OnboardingPage.test.tsx` | ✅ |
| REQ-002 | AC-002.1 | T-016, T-017, T-027, T-037 a T-039 | `app/lazyNamed.test.ts`, `app/RouteSuspense.test.tsx` | ✅ |
| REQ-002 | AC-002.2 | T-018, T-039 | `app/lazyRoutes.test.tsx` | ✅ |
| REQ-002 | AC-002.3 | T-019, T-039 | `app/lazyRoutes.test.tsx` | ✅ |
| REQ-002 | AC-002.4 | T-019, T-039 | `app/lazyRoutes.test.tsx` | ✅ |
| REQ-003 | AC-003.1 | T-017, T-038 | `app/RouteSuspense.test.tsx` | ✅ |
| REQ-003 | AC-003.2 | T-016, T-017, T-037, T-038 | `app/lazyNamed.test.ts`, `app/RouteSuspense.test.tsx` | ✅ (la recarga real del navegador, ver sección 3) |
| NFR-001 | AC-N001.1 | T-010, T-030 | `lib/inRange.test.ts` | ✅ |
| NFR-001 | AC-N001.2 | T-010, T-030 | `lib/inRange.test.ts` | ✅ |
| NFR-001 | AC-N001.3 | T-020, T-031, T-032 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-001 | AC-N001.4 | T-020, T-032 | `app/sourceCleanup017.test.ts` y suites existentes de esquemas y páginas | ✅ |
| NFR-002 | AC-N002.1 | T-021, T-035, T-036 | `app/sourceCleanup017.test.ts` y `npm run lint` | ✅ |
| NFR-002 | AC-N002.2 | T-021, T-035, T-036 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-002 | AC-N002.3 | T-021 | `app/sourceCleanup017.test.ts` y suites de formularios | ✅ |
| NFR-002 | AC-N002.4 | T-021, T-035, T-036 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-003 | AC-N003.1 | T-023, T-024, T-025 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-003 | AC-N003.2 | T-023, T-024, T-025 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-004 | AC-N004.1 | T-026 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-004 | AC-N004.2 | T-026 | `app/sourceCleanup017.test.ts` | ✅ |
| NFR-004 | AC-N004.3 | T-026 | Ninguno: ningún marcador `SDD:` menciona `AC-N004.3` | ❌ sin marcador (ver sección 4) |
| NFR-005 | AC-N005.1 | T-022, T-039 | `app/sourceCleanup017.test.ts` y `npm run build` (384.07 kB) | ✅ |
| NFR-005 | AC-N005.2 | T-022, T-039 | `app/sourceCleanup017.test.ts` | ✅ |

- AC sin test: AC-N004.3 (sin marcador `SDD:`; el archivo `OnboardingPage.test.tsx` sí pasa completo).
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (las 32 tareas, T-001 a T-039, están marcadas).
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (ninguno; se escanea `git diff main...HEAD -- frontend`).
- Textos de `LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx` (AC-N003.1): sin palabras prohibidas. Recuentos: 14 y 8 tests (AC-N003.2).
- Tests duplicados de fecha en `OnboardingPage.test.tsx` (AC-N004.1): los marcadores quedan en las líneas 196 (AC-009.1 · 015 AC-007.5) y 258 (AC-009.4 · 015 AC-007.5); no hay duplicados.

## 3. Criterios de aceptación manuales
- AC-003.2 (recarga real): los tests sustituyen `window.location.reload` por un doble. Para confirmar que «Recargar» recarga la página en el navegador, hace falta una prueba manual: forzar un fallo de descarga de chunk (p. ej. tras un despliegue con la pestaña abierta) y pulsar «Recargar».
- AC-002.1 (aviso «Cargando…» visible): cubierto por tests; una revisión visual en el navegador es opcional.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | AC-N004.3 no aparece en ningún marcador `SDD:` de los tests. Art. B4.3 exige que cada AC esté cubierto por un test con marcador; la justificación de plan.md (sección 5 y la fila de la matriz) no sirve para un DEBE. | `grep "AC-N004.3"` sobre `frontend/src` sin coincidencias; todos los demás AC de la spec aparecen. El test del archivo sí pasa (739 de 739). | test-author (añadir `AC-N004.3` a un marcador `SDD:` de `OnboardingPage.test.tsx` o de `sourceCleanup017.test.ts`) |

Sin fallos de comandos: `npm test`, `npm run lint`, `npx tsc -b` y `npm run build` pasan.

## Veredicto de la etapa verify
FAIL por una sola trazabilidad incompleta (AC-N004.3 sin marcador). Todas las comprobaciones ejecutables están en verde.
