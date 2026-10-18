# Review 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Iteración:** 2 de 3
- **Diff revisado:** `git diff main...feat/017-frontend-polish` @ `35abc83` (+ cambios sin commitear en `docs/sdd/decisions/ADR-0026-carga-de-pantallas-bajo-demanda.md`, `docs/sdd/decisions/README.md`, `specs/017-frontend-polish/state.json` y `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen
Esta segunda pasada revisa las correcciones de F1 a F7 que pidió el usuario en el gate de review: `cc5aeb6` (tests: F1, F2 y F4), `35abc83` (implementación: F3 y F6) y el cambio sin commitear del ADR-0026 (F7). F1, F3 y F4 están resueltos. F2, F6 y F7 están resueltos en lo esencial, con un resto menor anotado. F5 es una prueba manual que solo puede hacer el usuario. No hay regresiones: `snapshot --check` da idéntico, el commit de implement no toca tests y `src/app` (73 tests), `npm run lint` y `npx tsc -b` pasan al relanzarlos.

## 2. Cumplimiento de la spec
Las correcciones no cambian el comportamiento de ningún AC. La tabla de la iteración 1 sigue siendo válida; solo cambian las filas afectadas.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.6 | Sí (sin cambios) | `onboarding/schemas.ts`, `PhysicalDataForm.tsx`; tests 017 de `ProfilePage.test.tsx`, `schemas.test.ts` y `OnboardingPage.test.tsx` |
| AC-002.1 | Sí | `frontend/src/app/RouteSuspense.tsx:53-68`: el `Suspense` sigue mostrando `ProfileLoading` («Cargando…»); ahora recibe `className` (F6). Sin `className` mantiene `min-h-dvh` (`ProfileLoadState.tsx:3`) |
| AC-002.2 a AC-002.4 | Sí | `frontend/src/app/router.tsx:104-200`: solo se reformatea y se pasa `className="min-h-[50vh]"` a las seis pantallas de `AppLayout`; la estructura de rutas no cambia. `lazyRoutes.test.tsx` en verde |
| AC-003.1 / AC-003.2 | Sí (falta la prueba manual de la recarga real, F5) | `RouteSuspense.tsx:9-23` (`PageLoadError` con `className` por defecto `min-h-dvh`) y `:39-49` (el boundary le pasa su `className`); `RouteSuspense.test.tsx` y `lazyNamed.test.ts` en verde |
| AC-N001.1 a AC-N001.4 | Sí (sin cambios) | `frontend/src/lib/inRange.ts`; `inRange.test.ts`; `sourceCleanup017.test.ts` |
| AC-N002.1 / AC-N002.2 / AC-N002.4 | Sí (sin cambios) | `npm run lint` relanzado: sin warnings |
| AC-N002.3 | Sí | `sourceCleanup017.test.ts:122-134` (tests de los cuatro formularios de autenticación) y `:136-144` (nuevo: el formulario de feedback sigue existiendo y usa `components/ui/form` y `components/ui/button`). El feedback no tiene tests existentes, así que el AC se cumple sin nada que ejecutar (ver F9) |
| AC-N003.1 / AC-N003.2 | Sí | `LoginForm.test.tsx:6` («todavía») y `:133` («CÓMO») corregidos (F1) |
| AC-N004.1 a AC-N004.3 | Sí | `sourceCleanup017.test.ts:296-298`: el comentario aclara que es una guarda de existencia y que la ejecución la cubre la suite (F4) |
| AC-N005.1 / AC-N005.2 | Sí | Build de 384.30 kB (verify-report @ `35abc83`); `router.tsx` sigue con solo `import()` dinámicos de las pantallas |

## 3. Cumplimiento del plan
- Sin desviaciones nuevas. La prop `className` de `RouteSuspense`, `PageErrorBoundary` y `PageLoadError` es un añadido opcional, compatible con las firmas de la sección 3.2 del plan, y sigue el patrón que ya usan `ProfileLoading` y `ProfileLoadError` en `ProfileLoadState.tsx`.
- F6 se resolvió solo con `className`, sin precargar el layout. Los «Cargando…» encadenados en la primera visita a una ruta protegida siguen ahí: es una consecuencia (−) aceptada del ADR-0026, y está anotada en el backlog de la feature.
- Sigue pendiente la revisión manual de login ↔ registro que el plan pedía antes de la review (F5).
- La sección 5 de `plan.md` sigue sin listar AC-001.5 ni AC-N002.4 entre los verdes justificados. Ya está en el backlog, y es un desfase del registro, no del comportamiento.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` da idéntico respecto al snapshot de `05:58:19` (12 archivos). La corrección de tests `cc5aeb6` está autorizada en `history` (`rework` de tests por petición del usuario, `done` y `snapshot` posterior). `git diff cc5aeb6 HEAD` no toca ningún archivo de test: el implementer (`35abc83`) solo modificó `RouteSuspense.tsx` y `router.tsx`.
- [x] B4: los marcadores nuevos (`// SDD: 017 NFR-002 AC-N002.3` en `sourceCleanup017.test.ts:138`) llevan el número de spec y corresponden a su AC.
- [x] B5: no se borra, salta ni debilita ningún test. Se añade un caso y se corrigen dos comentarios.
- [x] B5.7: `npm run lint` sin errores ni warnings y `npx tsc -b` correcto, relanzados en esta revisión.
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: el caso nuevo va en el test de escaneo existente, con nombre en español y `globals: false`.
- [x] P2.1 / P2.4 frontend: sin cambios de organización; se reutiliza el patrón `className` de `ProfileLoadState.tsx`.
- [x] P2.5: lint limpio.
- [x] P2 General: el comentario nuevo de `RouteSuspense.tsx:60` está en español correcto. Los comentarios previos de `router.tsx` siguen sin tildes y con voseo («aca», «matchee»), fuera de alcance y ya anotados en el backlog.
- [x] P3: sin input externo ni endpoints nuevos.
- [x] P4: sin cambios de modelo ni pasos manuales en producción.

## 5. Hallazgos
### Estado de los hallazgos de la iteración 1
| # | Estado | Evidencia |
|---|---|---|
| F1 | Resuelto | `frontend/src/features/auth/components/LoginForm.test.tsx:6`, `:133` |
| F2 | Resuelto (guarda de escaneo; ver F9) | `frontend/src/app/sourceCleanup017.test.ts:136-144` |
| F3 | Resuelto | `frontend/src/app/router.tsx:104-200`: todas las rutas siguen el formato de `/login` (`<Route` en su línea, `path` y `element` indentados, `/>` alineado) |
| F4 | Resuelto (aclarado con un comentario) | `frontend/src/app/sourceCleanup017.test.ts:296-298` |
| F5 | Abierto: prueba manual del usuario | Sin constancia en `verify-report.md` ni en el backlog de que se haya hecho |
| F6 | Resuelto en parte | `frontend/src/app/RouteSuspense.tsx:9-23`, `:53-68`; `router.tsx` pasa `min-h-[50vh]` a las seis pantallas de `AppLayout`. Los «Cargando…» encadenados quedan en el backlog |
| F7 | Resuelto en parte (sin commitear) | `docs/sdd/decisions/ADR-0026-carga-de-pantallas-bajo-demanda.md:3` y `docs/sdd/decisions/README.md:32` dicen «Aceptada»; queda F8 |

### Hallazgos de esta iteración
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F5 | MENOR | `specs/017-frontend-polish/plan.md` (riesgo 4, sección 6) | Sigue sin constar la prueba manual en `npm run dev` de la transición login ↔ registro (`AnimatePresence mode="wait"` + `Suspense`) ni la de «Recargar» tras un fallo real de descarga de un chunk (AC-003.2). Ningún agente puede hacerla: le toca al usuario antes del cierre. | implementer |
| F8 | NIT | `docs/sdd/decisions/ADR-0026-carga-de-pantallas-bajo-demanda.md:4` | El estado pasa a «Aceptada», pero la línea «Decidido por» sigue diciendo «el `planner`, pendiente de revisión en el gate de `review`». Debería decir quién lo aceptó y cuándo (p. ej. «propuesto por el `planner`; aceptado por el usuario en el gate de `review`, 2026-10-18»). Además, el cambio sigue sin commitear. | planner |
| F9 | NIT | `frontend/src/app/sourceCleanup017.test.ts:136-144` | La guarda de feedback solo comprueba que `FeedbackForm.tsx` importa `components/ui/form` y `components/ui/button`: no ejecuta el formulario. Es correcto según la letra de AC-N002.3, porque el feedback no tiene tests existentes. Si se quiere cubrirlo de verdad, hace falta un test de comportamiento de `FeedbackForm` (ya está en el backlog del test-author). | test-author |
| F10 | NIT | `frontend/src/app/router.tsx:149-195` | `className="min-h-[50vh]"` se repite seis veces. Una constante (p. ej. `const IN_LAYOUT = "min-h-[50vh]"`) evitaría que una ruta nueva se olvide de ella. Tailwind detecta igual la clase si está escrita literal en la constante. | implementer |

## 6. Decisión
APPROVED: no hay hallazgos BLOQUEANTES ni MAYORES. Las correcciones de F1 a F7 están aplicadas sin regresiones: el snapshot de tests es idéntico, el implementer no tocó tests, y tests, lint y tipos pasan. Queda F5, una prueba manual que debe hacer el usuario antes del cierre, y tres NIT (F8 a F10) que se pueden diferir al backlog.

## Comentarios del usuario

## Comentarios del usuario

- Gate de review: «Vamos a corregir todos, desde F1 a F7,»

- Gate de review (2ª pasada): «Aprobada. Corrige F9 Y 10»
