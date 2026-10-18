# Verify report 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-18T05:48:38.485Z · **Rama:** `feat/017-frontend-polish` @ `507950a` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npm test` (`frontend`) | ✅ | 52 archivos de test y 740 tests, todos pasan (Test Files 52 passed, Tests 740 passed). |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni warnings (salida vacía, código de salida 0). |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores de tipos (código de salida 0). |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto (553 ms). Chunk de entrada `dist/assets/index-Bj3eTrgl.js` de 384.07 kB (gzip 122.75 kB), por debajo de 500 kB. Ningún aviso de tamaño de chunk. El chunk más grande de pantalla es `BodyMetricsPage` con 364.06 kB. |

Notas:
- El ámbito `backend` no está tocado (`scopes_touched` = `frontend`); no se ejecuta nada de backend.
- `lint_ratchet` es `null` en `frontend`, así que se ejecuta `npm run lint`.

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
| NFR-004 | AC-N004.3 | T-026 | `app/sourceCleanup017.test.ts` (`// SDD: 017 NFR-004 AC-N004.3`, corregido en la iteración 3) y el propio `OnboardingPage.test.tsx` en verde | ✅ |
| NFR-005 | AC-N005.1 | T-022, T-039 | `app/sourceCleanup017.test.ts` y `npm run build` (384.07 kB) | ✅ |
| NFR-005 | AC-N005.2 | T-022, T-039 | `app/sourceCleanup017.test.ts` | ✅ |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (las 32 tareas, T-001 a T-039, están marcadas).
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (ninguno; se escanea `git diff main...HEAD -- frontend`).
- AC-N003.1 y AC-N003.2: `LoginForm.test.tsx` tiene 14 tests y `ForgotPasswordForm.test.tsx` tiene 8; no hay palabras prohibidas en ninguno de los dos.
- AC-N004.1: 1995-05-20 se comprueba una vez (línea 196, marcador `AC-009.1 · 015 REQ-007 AC-007.5`) y 1900-01-01 una vez (línea 258, marcador `AC-009.4 · 015 REQ-007 AC-007.5`).
- AC-N002.4: `button.tsx` y `form.tsx` tienen una supresión `oxlint-disable-next-line react/only-export-components` cada uno, con comentario; `.oxlintrc.json` mantiene la regla.
- AC-N005.1: `vite.config.ts` no contiene `chunkSizeWarningLimit` ni `manualChunks`; `router.tsx` no importa de forma estática ninguna página de `features/*/pages/`.

## 3. Criterios de aceptación manuales
- AC-003.2 (recarga real): los tests sustituyen `window.location.reload` por un doble. Para confirmar que «Recargar» recarga la página en el navegador, hace falta una prueba manual: forzar un fallo de descarga de chunk (p. ej. tras un despliegue con la pestaña abierta) y pulsar «Recargar».
- AC-002.1 (aviso «Cargando…» visible): cubierto por tests; una revisión visual en el navegador es opcional.

## 4. Fallos (si los hay)
Ninguno. Todas las comprobaciones ejecutables están en verde.
