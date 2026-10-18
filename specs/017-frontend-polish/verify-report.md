# Verify report 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Modo:** red (tras la etapa tests, iteración 3 de 3; el usuario aceptó como guardas los dos tests verdes pendientes)
- **Fecha:** 2026-10-18T05:40:03.720Z · **Rama:** `feat/017-frontend-polish` @ `a046390` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run {files}` sobre los 11 archivos de test nuevos o cambiados con marcador `SDD:` (`frontend`) | ✅ | 213 tests: 27 fallan y 186 pasan. Los 27 fallos son por comportamiento ausente (`Error: not implemented`, texto o role ausente, o aserción de escaneo). Ningún error de sintaxis, configuración, fixture, import ni `TypeError`. Los 27 nuevos verdes están justificados (ver sección 2). |
| frontend | `npm run lint` | — | No se ejecuta en modo red. |
| frontend | `npx tsc -b` | — | No se ejecuta en modo red. |
| frontend | `npm run build` | — | No se ejecuta en modo red. |

Notas:
- Solo se ejecutaron los tests nuevos o modificados con marcador `SDD:` (`test_files`), como indica el modo red. `lint_ratchet` del backend no aplica (solo se tocó `frontend`).
- Archivos incluidos: `src/lib/inRange.test.ts`, `src/app/lazyNamed.test.ts`, `src/app/RouteSuspense.test.tsx`, `src/app/lazyRoutes.test.tsx`, `src/app/sourceCleanup017.test.ts`, `src/features/onboarding/schemas.test.ts`, `src/features/profile/schemas.test.ts`, `src/features/profile/pages/ProfilePage.test.tsx`, `src/features/onboarding/pages/OnboardingPage.test.tsx`, `src/features/auth/components/LoginForm.test.tsx` y `src/features/auth/components/ForgotPasswordForm.test.tsx`.
- Esqueletos (scaffold, Art. B5.6): `inRange.ts`, `lazyNamed.ts`, `RouteSuspense.tsx` y las funciones `isHeightFeetValid` y `heightMessage` de `onboarding/schemas.ts` lanzan solo `Error("not implemented")`, con parámetros prefijados con `_`. `INCHES_RANGE_MESSAGE` es una constante con su valor real, como indica T-002. ✅ Cumplen.
- Grep de `.skip`, `.only`, `xit`, `xdescribe`, `xtest`, `it.todo`, `test.todo`, `.fixme` y `it.fails` en los tests nuevos y cambiados: sin coincidencias. ✅
- Corrección respecto al informe de la iteración 3: el recuento de tests verdes nuevos era erróneo (decía 18). Son 27, enumerados abajo.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| NFR-001 | AC-N001.1, AC-N001.2 | T-010, T-030 | `src/lib/inRange.test.ts` (3 tests) | ❌ rojo legítimo (`not implemented`) |
| NFR-001 | AC-N001.3 | T-020, T-031, T-032 | `src/app/sourceCleanup017.test.ts` (3 escaneos) | ❌ rojo legítimo (aserción: `inRange` aún definido en el esquema del onboarding) |
| NFR-001 | AC-N001.4 | T-020 | `src/app/sourceCleanup017.test.ts` (1 test) | ✅ pasa, justificado en plan.md (guarda de regresión, sección 5) |
| REQ-001 | AC-001.1 | T-013, T-033, T-034 | `ProfilePage.test.tsx` (5 ft con 12 in) | ❌ rojo legítimo (texto «Entre 0 y 11 in» ausente) |
| REQ-001 | AC-001.2 | T-013, T-033, T-034 | `ProfilePage.test.tsx` (5 ft con 2.5 y -1 in) | ❌ rojo legítimo (texto ausente) |
| REQ-001 | AC-001.3 | T-014, T-033, T-034 | `ProfilePage.test.tsx` (12 a 11 y a vacío) | ❌ rojo legítimo (texto ausente en la precondición) |
| REQ-001 | AC-001.4 | T-014, T-033, T-034 | `ProfilePage.test.tsx` (2/9, 9/12, 5.5/9, 5.5/12) | ❌ rojo legítimo (texto ausente en la precondición) |
| REQ-001 | AC-001.5 | T-011, T-012, T-033 | `onboarding/schemas.test.ts` (2 casos de 5 ft y pulgadas), `profile/schemas.test.ts` (1 caso) | ❌ rojo legítimo en 5 ft/12 in y 5 ft/2.5 in (aserción: se recibe `Entre 3 y 8 ft`). ✅ El caso «con pies no válidos manda 'Entre 3 y 8 ft'…» pasa; guarda aceptada por el usuario (ver sección 4, nota A) |
| REQ-001 | AC-001.6 | T-015, T-033 | `OnboardingPage.test.tsx` (5 ft con 12 in) | ✅ pasa, justificado en plan.md (guarda de regresión, sección 5) |
| REQ-002 | AC-002.1 | T-016, T-017, T-027, T-037–T-039 | `lazyNamed.test.ts`, `RouteSuspense.test.tsx`, `lazyRoutes.test.tsx` | ❌ rojo legítimo (`not implemented`; en `lazyRoutes` no hay «Cargando…» con role `status`) |
| REQ-002 | AC-002.2 | T-018, T-039 | `lazyRoutes.test.tsx` (6 casos sin sesión) | ✅ pasa, justificado en plan.md (guarda de regresión, sección 5) |
| REQ-002 | AC-002.3 | T-019, T-039 | `lazyRoutes.test.tsx` (6 casos con sesión) | ✅ pasa, justificado en plan.md (guarda de regresión, sección 5) |
| REQ-002 | AC-002.4 | T-019, T-039 | `lazyRoutes.test.tsx` (1 caso) | ✅ pasa, justificado en plan.md (guarda de regresión, sección 5) |
| REQ-003 | AC-003.1 | T-017, T-038 | `RouteSuspense.test.tsx` | ❌ rojo legítimo (`not implemented`) |
| REQ-003 | AC-003.2 | T-016, T-017, T-037, T-038 | `lazyNamed.test.ts`, `RouteSuspense.test.tsx` | ❌ rojo legítimo (`not implemented`) |
| NFR-002 | AC-N002.1, AC-N002.4 | T-021, T-035, T-036 | `sourceCleanup017.test.ts` (2 casos de supresión en `button.tsx` y `form.tsx`) | ❌ rojo legítimo (aserción: 0 supresiones, se esperaba 1). ✅ El caso «la configuración de lint no desactiva la regla» (AC-N002.4) pasa; guarda aceptada por el usuario (ver sección 4, nota A) |
| NFR-002 | AC-N002.2, AC-N002.3 | T-021 | `sourceCleanup017.test.ts` (2 casos) | ✅ pasa, justificado en plan.md (guarda de exports y de tests existentes) |
| NFR-003 | AC-N003.1 | T-023, T-024, T-025 | `sourceCleanup017.test.ts` (2 casos) | ✅ pasa, justificado en plan.md (el cambio es el propio texto de los tests) |
| NFR-003 | AC-N003.2 | T-023, T-024, T-025 | `sourceCleanup017.test.ts` (2 casos: 14 y 8 tests) | ✅ pasa, justificado en plan.md (recuento y marcadores) |
| NFR-004 | AC-N004.1, AC-N004.2 | T-026 | `sourceCleanup017.test.ts` (3 casos) | ✅ pasa, justificado en plan.md (el cambio es el propio test) |
| NFR-004 | AC-N004.3 | T-026 | `OnboardingPage.test.tsx` (todos los tests) | ✅ pasa, justificado en plan.md |
| NFR-005 | AC-N005.1 | T-022, T-039 | `sourceCleanup017.test.ts` (vite.config, 1 caso) | ✅ pasa, justificado en plan.md (parte de configuración) |
| NFR-005 | AC-N005.2 | T-022, T-039 | `sourceCleanup017.test.ts` (router.tsx) | ❌ rojo legítimo (aserción: imports estáticos de `features/*/pages/` en `router.tsx`) |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-030 a T-039 (tareas impl y config pendientes, esperado en modo red).
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (ninguno).

### Tests nuevos que pasan sin implementación (27)
- **25 justificados en `plan.md`, sección 5 («Pasan ya en verde»):** AC-001.6 (1), AC-002.2 a AC-002.4 (13 casos de `lazyRoutes`), AC-N001.4 (1), AC-N002.2 y AC-N002.3 (2), AC-N003.1 y AC-N003.2 (4), AC-N004.1 a AC-N004.3 (3) y la parte de configuración de AC-N005.1 (1).
- **2 aceptados por el usuario** como guardas de regresión (respuesta «a» en «Comentarios del usuario» de `plan.md`): AC-001.5 («con pies no válidos manda Entre 3 y 8 ft», `onboarding/schemas.test.ts`) y AC-N002.4 («la configuración de lint no desactiva la regla», `sourceCleanup017.test.ts`).

## 3. Criterios de aceptación manuales
- AC-N001.4, AC-N002.3 y AC-N004.3: se comprueban con los tests existentes; no requieren revisión manual.
- Ninguno en esta etapa. En verify se revisarán los AC de carga bajo demanda (AC-002.1 y AC-003.1) en el navegador, si el usuario lo pide.

## 4. Fallos (si los hay)
Ninguno. Los 27 tests rojos fallan por comportamiento ausente:

| # | Qué falla | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | `inRange.test.ts` (3) | `Error: not implemented` | rojo legítimo (esperado) |
| — | `lazyNamed.test.ts` (2), `RouteSuspense.test.tsx` (3) | `Error: not implemented` | rojo legítimo (esperado) |
| — | `lazyRoutes.test.tsx`, AC-002.1 (1) | `Unable to find an accessible element with the role "status"` | rojo legítimo (esperado: no hay «Cargando…») |
| — | `ProfilePage.test.tsx` (9: AC-001.1 con 1 caso, AC-001.2 con 2, AC-001.3 con 2 y AC-001.4 con 4) | `Unable to find an element with the text: Entre 0 y 11 in` | rojo legítimo (esperado) |
| — | `onboarding/schemas.test.ts` (2) y `profile/schemas.test.ts` (1) | `expected 'Entre 3 y 8 ft' to be 'Entre 0 y 11 in'` | rojo legítimo (esperado) |
| — | `sourceCleanup017.test.ts` (6: AC-N001.3 con 3, AC-N002.1 con 2 y AC-N005.2 con 1) | `AssertionError` de los escaneos | rojo legítimo (esperado) |

Nota A (aceptada por el usuario): los dos tests verdes sin justificar de la iteración 3 (AC-001.5 y AC-N002.4) están en el registro como guardas de regresión. `plan.md`, sección 5, todavía no los lista en «Pasan ya en verde»; conviene añadirlos para que el registro coincida con este veredicto (ver backlog).

Sin errores de sintaxis, configuración, fixture ni imports fuera del plan. Los scaffolds cumplen Art. B5.6.

## Veredicto de la etapa red
PASS. Todos los tests nuevos fallan por comportamiento ausente salvo los 27 verdes justificados (25 en `plan.md` y 2 aceptados por el usuario). Ningún test se salta ni se debilita.
