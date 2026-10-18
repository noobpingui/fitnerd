# Review 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...feat/017-frontend-polish` @ `507950a` (+ cambios sin commitear solo en `specs/017-frontend-polish/backlog.md`, `state.json` y `verify-report.md`, artefactos del orquestador y del verifier)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio, solo de frontend, hace cuatro cosas. El perfil distingue el mensaje de pulgadas («Entre 0 y 11 in») del de pies. `inRange` pasa a `src/lib/inRange.ts`. Se suprimen, justificados, los dos warnings de `only-export-components`. Y cada pantalla se carga bajo demanda con `React.lazy` y un `RouteSuspense` propio, con el chunk de entrada en 384 kB. La implementación es pequeña, sigue el plan al pie de la letra y está bien cubierta por tests. Solo quedan detalles menores: dos tildes que faltan en un test de autenticación, un escaneo que no incluye el test del feedback y el formato de `router.tsx`.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `frontend/src/features/onboarding/schemas.ts:67-73` (`heightMessage`), `:144-147`; `frontend/src/features/profile/components/PhysicalDataForm.tsx:79-81` (`feetOk`), `:241` (pies con `!feetOk`), `:248` (pulgadas con `!heightOk`); test «5 ft con 12 in muestra 'Entre 0 y 11 in', marca solo las pulgadas…» en `ProfilePage.test.tsx` |
| AC-001.2 | Sí | La misma lógica: `inRange` rechaza «2.5» y «-1» con `integer=true`, rango 0–11; `it.each(["2.5", "-1"])` en `ProfilePage.test.tsx` |
| AC-001.3 | Sí | Pulgadas vacías cuentan como 0 (`schemas.ts:80-82`); `it.each(["11", ""])` comprueba el mensaje, los dos `aria-invalid` y «Guardar» habilitado |
| AC-001.4 | Sí | `heightMessage` devuelve `heightRangeMessage` si fallan los pies (`schemas.ts:72`); `feetOk` es falso → los dos campos quedan marcados; `it.each` con 2/9, 9/12, 5.5/9 y 5.5/12 |
| AC-001.5 | Sí | `onboarding/schemas.test.ts` (5/12, 5/2.5 → in; 9/12 y 5.5/vacías → ft) y `profile/schemas.test.ts` (5/12) |
| AC-001.6 | Sí | `OnboardingPage.tsx` no pinta `errors.height` y no ha cambiado; el test 017 de `OnboardingPage.test.tsx` lo fija |
| AC-002.1 | Sí | `frontend/src/app/RouteSuspense.tsx:44-56` (`Suspense` con `ProfileLoading`); `RouteSuspense.test.tsx` con promesa diferida; primer test de `lazyRoutes.test.tsx` con el router real |
| AC-002.2 | Sí | `frontend/src/app/router.tsx:62-113`; `lazyRoutes.test.tsx` (seis rutas sin sesión, `pathname` sin cambiar) |
| AC-002.3 | Sí | `router.tsx:126-165` (pantallas dentro del `Outlet` de `AppLayout`); `lazyRoutes.test.tsx` comprueba `h1` y `navigation` |
| AC-002.4 | Sí | `router.tsx:121-125`; `lazyRoutes.test.tsx` comprueba la primera pregunta «¿Cuál es tu género?» |
| AC-003.1 | Sí | `RouteSuspense.tsx:26-41` (`getDerivedStateFromError` → `PageLoadError`) y `:9-20`; `RouteSuspense.test.tsx` con rechazo |
| AC-003.2 | Sí (falta la prueba manual) | `lazyNamed.ts:12-16` (`reloadPage` → `location.reload()`), `RouteSuspense.tsx:36` (valor por defecto); tests de `lazyNamed.test.ts` y `RouteSuspense.test.tsx`. La recarga real en el navegador está pendiente de prueba manual (verify-report, sección 3) |
| AC-N001.1 / AC-N001.2 | Sí | `frontend/src/lib/inRange.ts:1-11`: el mismo cuerpo que la versión anterior; `inRange.test.ts` |
| AC-N001.3 | Sí | `onboarding/schemas.ts:10`, `profile/schemas.ts:14`, `body-metrics/schemas.ts:3`; ya no hay definición ni reexport en el esquema del onboarding; escaneo de `sourceCleanup017.test.ts` |
| AC-N001.4 | Sí | En las suites de esquemas y páginas solo cambian los casos que modifica REQ-001 (diff de `onboarding/schemas.test.ts` y `ProfilePage.test.tsx`); 240 tests verdes al relanzar `src/app`, `profile` y `onboarding` |
| AC-N002.1 | Sí | `npm run lint` relanzado: salida limpia, sin warnings |
| AC-N002.2 | Sí | Los exports no cambian (`button.tsx:67`, bloque de `form.tsx:158-170`); test de import en `sourceCleanup017.test.ts` |
| AC-N002.3 | Sí | Las suites de los formularios pasan (verify: 740/740). El escaneo no incluye el test del feedback (F2) |
| AC-N002.4 | Sí | Una supresión comentada en cada archivo: `components/ui/button.tsx:64-66` y `components/ui/form.tsx:159-161`; `.oxlintrc.json` no cambia |
| AC-N003.1 | Sí | Ninguna de las formas listadas en el AC aparece en los dos archivos. Quedan dos palabras sin tilde que no están en la lista (F1) |
| AC-N003.2 | Sí | 14 y 8 tests, con los marcadores sin cambios (escaneo de `sourceCleanup017.test.ts:206-240`) |
| AC-N004.1 / AC-N004.2 | Sí | Se borraron los dos duplicados de la 015; los marcadores dobles están en `OnboardingPage.test.tsx:196` y `:258` |
| AC-N004.3 | Sí | `OnboardingPage.test.tsx` en verde. El marcador está en un test de escaneo (F4) |
| AC-N005.1 | Sí | Build de 384.07 kB (verify-report); `vite.config.ts` no cambia |
| AC-N005.2 | Sí | `router.tsx:1-38`: solo hay `import()` dinámicos de las pantallas |

## 3. Cumplimiento del plan
- No hay desviaciones de diseño: las firmas de `lazyNamed`, `reloadPage`, `RouteSuspense`, `PageErrorBoundary`, `PageLoadError`, `heightMessage`, `isHeightFeetValid` e `INCHES_RANGE_MESSAGE` coinciden con la sección 3.2. Se reutilizan `ProfileLoading` y `Button`, y no se tocan `vite.config.ts`, `.oxlintrc.json`, `package.json`, `OnboardingRoute.tsx`, `OnboardingGuard.tsx` ni `AppLayout.tsx`.
- `setup.ts` sube `asyncUtilTimeout` a 3000 ms, como prevé el plan (sección 5).
- La sección 5 («Pasan ya en verde») no lista AC-001.5 ni AC-N002.4, que el usuario aceptó como guardas en el red check (lo recogen «Comentarios del usuario» del plan y el backlog). Es un desfase del registro, no del comportamiento.
- Sigue pendiente la mitigación de riesgo del plan: «revisión manual de login ↔ registro en `npm run dev` antes de la review» (F5).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da idéntico. El commit de implement (`1ba5cdd`) no toca tests. La única corrección de test posterior (`507950a`, marcador de AC-N004.3) está autorizada en `history` (`rework` de tests y `snapshot` después).
- [x] B4: los marcadores `SDD:` son coherentes con los AC que prueban y llevan el número de spec 017 (P1.1).
- [x] B5: no se debilita ningún test. Se retiran dos casos de la 015 porque REQ-001 cambia ese comportamiento, y quedan cubiertos por los tests 017, que llevan también el marcador de la 015. Los dos duplicados se borran por NFR-004. No hay `skip` ni `.only`, ni llamadas reales a servicios externos. Todos los esqueletos están sustituidos.
- [x] B5.7: `npm run lint` limpio; `npx tsc -b` correcto (verify).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: los tests van junto a su archivo, con `globals: false`, nombres en español y la red simulada en los `api.ts` (`lazyRoutes.test.tsx:14-38`).
- [x] P1.5: los esqueletos se hicieron con `not implemented` (red check PASS).
- [x] P2.1 frontend: se mantiene la organización por feature; el enrutado va en `src/app` y la utilidad pura en `src/lib`.
- [x] P2.2 / P2.3: sin llamadas HTTP nuevas; los formularios siguen con react-hook-form y zod.
- [x] P2.4: se reutiliza `Button` de `components/ui`, con el alias `@/`.
- [x] P2.5: lint sin errores, y además sin warnings.
- [x] P2 General: los comentarios nuevos están en español correcto. Quedan dos palabras sin tilde en `LoginForm.test.tsx` (F1), y los comentarios previos sin tilde de `router.tsx` siguen en el backlog.
- [x] P3: sin endpoints ni input externo nuevo; la validación zod no cambia.
- [x] P4: sin cambios de modelo ni pasos manuales en producción (Vercel despliega solo).

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `frontend/src/features/auth/components/LoginForm.test.tsx:6`, `:133` | NFR-003 pide «español correcto, con tildes», pero quedan «todavia» (→ «todavía») y «COMO se llamó» (interrogativa indirecta → «CÓMO»). No rompe AC-N003.1 porque esas formas no están en su lista. | test-author |
| F2 | MENOR | `frontend/src/app/sourceCleanup017.test.ts:122-134` | AC-N002.3 (y el plan, sección 5) incluyen el formulario de feedback, pero el escaneo solo comprueba los cuatro tests de autenticación. En la práctica lo cubre `npm test`, pero la guarda no está completa. | test-author |
| F3 | NIT | `frontend/src/app/router.tsx:104-165` | La indentación de los `element={…}` de las rutas legales, de onboarding y protegidas es incoherente: la etiqueta de apertura está en la línea de `<Route`, los hijos van 16 espacios a la derecha y el cierre `} />` desalineado. Las rutas de autenticación usan otro formato. Conviene unificarlo con el de `/login`. | implementer |
| F4 | NIT | `frontend/src/app/sourceCleanup017.test.ts:286-291` | El marcador de AC-N004.3 («cuando se ejecuta, todos sus tests pasan») está en un test que solo busca texto en el archivo; quien lo cubre de verdad es la ejecución de `OnboardingPage.test.tsx` en la suite. Ya anotado en el backlog. | test-author |
| F5 | MENOR | `specs/017-frontend-polish/plan.md` (riesgo 4, sección 6) | No consta la revisión manual de la transición login ↔ registro con `AnimatePresence mode="wait"` + `Suspense` que el plan pedía antes de la review. Tampoco la prueba manual de «Recargar» tras un fallo real de descarga (AC-003.2). Las debe hacer el usuario en `npm run dev` antes del cierre. | implementer |
| F6 | NIT | `frontend/src/app/RouteSuspense.tsx:15`, `frontend/src/features/profile/components/ProfileLoadState.tsx:3` | Dentro de `AppLayout`, el aviso «Cargando…» y el de error usan `min-h-dvh`, así que ocupan una pantalla entera bajo el navbar. Además, la primera visita a una ruta protegida encadena hasta tres «Cargando…» (guard, layout y pantalla, consecuencia (−) del ADR-0026). Es cosmético; se podría pasar `className` o precargar el layout. | implementer |
| F7 | NIT | `docs/sdd/decisions/ADR-0026-carga-de-pantallas-bajo-demanda.md:3` | El ADR sigue «Propuesta», pendiente de que el usuario lo acepte en este gate. Tras la aprobación hay que pasarlo a «Aceptada» en el ADR y en `docs/sdd/decisions/README.md`. | planner |

## 6. Decisión
APPROVED: no quedan hallazgos BLOQUEANTES ni MAYORES. Todos los AC están implementados como se especificaron, los tests no cambiaron durante implement (snapshot idéntico) y lint, tipos, build y tests pasan. Los hallazgos MENORES (F1, F2, F5) y los NIT se pueden diferir al backlog con la aprobación del usuario. F5 es una prueba manual que conviene hacer antes del cierre.

## Comentarios del usuario

## Comentarios del usuario

- Gate de review: «Vamos a corregir todos, desde F1 a F7,»
