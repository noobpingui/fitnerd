# Verify report 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-18T06:00:03.517Z · **Rama:** `feat/017-frontend-polish` @ `35abc83` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npm test` (`frontend`) | ✅ | Test Files 52 passed (52), Tests 741 passed (741). |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni warnings (salida vacía, código de salida 0). |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores de tipos (código de salida 0). |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto (561 ms). Chunk de entrada `dist/assets/index-B0fokMc3.js` de 384.30 kB (gzip 122.78 kB), por debajo de 500 kB. El chunk de pantalla más grande es `BodyMetricsPage` con 364.06 kB (no bloquea, Q6). |

Notas:
- El ámbito `backend` no está tocado (`scopes_touched` = `frontend`); no se ejecuta nada de backend.
- `lint_ratchet` es `null` en `frontend`, así que se ejecuta `npm run lint`.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD: 017` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-013, T-034 | `features/profile/pages/ProfilePage.test.tsx:644` | ✅ |
| REQ-001 | AC-001.2 | T-013, T-034 | `features/profile/pages/ProfilePage.test.tsx:660` | ✅ |
| REQ-001 | AC-001.3 | T-014, T-034 | `features/profile/pages/ProfilePage.test.tsx:677` | ✅ |
| REQ-001 | AC-001.4 | T-014, T-034 | `features/profile/pages/ProfilePage.test.tsx:697` | ✅ |
| REQ-001 | AC-001.5 | T-011, T-012, T-033 | `features/onboarding/schemas.test.ts:162,169,176`; `features/profile/schemas.test.ts:89` | ✅ |
| REQ-001 | AC-001.6 | T-015, T-033 | `features/onboarding/pages/OnboardingPage.test.tsx:483` | ✅ |
| REQ-002 | AC-002.1 | T-016, T-017, T-027, T-037 a T-039 | `app/lazyNamed.test.ts:8`; `app/RouteSuspense.test.tsx:31` | ✅ |
| REQ-002 | AC-002.2 | T-018, T-039 | `app/lazyRoutes.test.tsx:77,92` | ✅ |
| REQ-002 | AC-002.3 | T-019, T-039 | `app/lazyRoutes.test.tsx:125` | ✅ |
| REQ-002 | AC-002.4 | T-019, T-039 | `app/lazyRoutes.test.tsx:150` | ✅ |
| REQ-003 | AC-003.1 | T-017, T-038 | `app/RouteSuspense.test.tsx:53` | ✅ |
| REQ-003 | AC-003.2 | T-016, T-017, T-037, T-038 | `app/lazyNamed.test.ts:27`; `app/RouteSuspense.test.tsx:73` | ✅ (la recarga real del navegador, sección 3) |
| NFR-001 | AC-N001.1 | T-010, T-030 | `lib/inRange.test.ts:8,15` | ✅ |
| NFR-001 | AC-N001.2 | T-010, T-030 | `lib/inRange.test.ts:22` | ✅ |
| NFR-001 | AC-N001.3 | T-020, T-031, T-032 | `app/sourceCleanup017.test.ts:48,58,72` | ✅ |
| NFR-001 | AC-N001.4 | T-020, T-032 | `app/sourceCleanup017.test.ts:82` y suites existentes | ✅ |
| NFR-002 | AC-N002.1 | T-021, T-035, T-036 | `app/sourceCleanup017.test.ts:146` y `npm run lint` | ✅ |
| NFR-002 | AC-N002.2 | T-021, T-035, T-036 | `app/sourceCleanup017.test.ts:100` | ✅ |
| NFR-002 | AC-N002.3 | T-021 | `app/sourceCleanup017.test.ts:122,138` | ✅ |
| NFR-002 | AC-N002.4 | T-021, T-035, T-036 | `app/sourceCleanup017.test.ts:146,163` | ✅ |
| NFR-003 | AC-N003.1 | T-023, T-024, T-025 | `app/sourceCleanup017.test.ts:201` | ✅ |
| NFR-003 | AC-N003.2 | T-023, T-024, T-025 | `app/sourceCleanup017.test.ts:216,235` | ✅ |
| NFR-004 | AC-N004.1 | T-026 | `app/sourceCleanup017.test.ts:259,271` | ✅ |
| NFR-004 | AC-N004.2 | T-026 | `app/sourceCleanup017.test.ts:281` | ✅ |
| NFR-004 | AC-N004.3 | T-026 | `app/sourceCleanup017.test.ts:298` y `OnboardingPage.test.tsx` en verde | ✅ |
| NFR-005 | AC-N005.1 | T-022, T-039 | `app/sourceCleanup017.test.ts:307` y `npm run build` (384.30 kB) | ✅ |
| NFR-005 | AC-N005.2 | T-022, T-039 | `app/sourceCleanup017.test.ts:316` | ✅ |

Comprobaciones adicionales:
- AC sin test: —
- REQ/NFR sin tarea: —
- Tareas sin marcar `[x]`: — (32 de 32 marcadas, T-001 a T-039).
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff (`git diff main...HEAD -- frontend`): — (ninguno; las únicas coincidencias son dos supresiones `oxlint-disable-next-line react/only-export-components` previstas en AC-N002.4, una por archivo, con comentario de motivo).
- `frontend/.oxlintrc.json` sin cambios en el diff; `vite.config.ts` sin `chunkSizeWarningLimit` ni `manualChunks`.

## 3. Criterios de aceptación manuales
- AC-003.2 (recarga real): los tests sustituyen `window.location.reload` por un doble. Para confirmar que «Recargar» recarga la página en el navegador, hace falta una prueba manual: forzar un fallo de descarga de chunk (p. ej. tras un despliegue con la pestaña abierta) y pulsar «Recargar».
- AC-002.1 (aviso «Cargando…» visible en el navegador): cubierto por tests; una revisión visual es opcional.

## 4. Fallos (si los hay)
Ninguno. Todas las comprobaciones ejecutables están en verde.
