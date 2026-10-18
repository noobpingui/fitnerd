# Review 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Iteración:** 3 de 3
- **Diff revisado:** `git diff main...feat/017-frontend-polish` @ `2836d0d` (+ cambios sin commitear en `specs/017-frontend-polish/state.json` y `verify-report.md`), con foco en `git diff 35abc83 2836d0d`
- **Veredicto:** APPROVED

## 1. Resumen
Esta tercera pasada revisa las correcciones de F9 y F10 que pidió el usuario al aprobar la segunda pasada: `2454e44` (tests: F9, nuevo `FeedbackForm.test.tsx`) y `2836d0d` (implementación: F10, constante `IN_LAYOUT` en `router.tsx`). Ambos están resueltos. El ADR-0026 ya está commiteado con la línea «Decidido por» corregida, así que F8 también queda resuelto. No hay regresiones: `snapshot --check` da idéntico (13 archivos), el commit de implement solo toca `router.tsx`, y los tests de `src/app` y `src/features/feedback` (75), `npm run lint` y `npx tsc -b` pasan al relanzarlos. Sigue abierto F5, una prueba manual que solo puede hacer el usuario.

## 2. Cumplimiento de la spec
Las correcciones no cambian el comportamiento de ningún AC. Solo cambian estas filas respecto a la iteración 2:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-002.2 a AC-002.4 | Sí | `frontend/src/app/router.tsx:40-42` define `IN_LAYOUT = "min-h-[50vh]"` y `:156-196` lo usan las seis pantallas de `AppLayout`. La clase está escrita literal, así que Tailwind la sigue generando. `lazyRoutes.test.tsx` en verde |
| AC-N002.3 | Sí | Además de la guarda de `sourceCleanup017.test.ts:136-144`, ahora `frontend/src/features/feedback/components/FeedbackForm.test.tsx:21-30` (render de campos y botón) y `:32-50` (validación con el formulario vacío: errores de `feedback/schemas.ts:10` y `:14`, sin `fetch` ni `onSuccess`) ejecutan el formulario |
| Resto de AC | Sí (sin cambios) | Ver la tabla de la iteración 2; el resto del diff no ha cambiado |

## 3. Cumplimiento del plan
- Sin desviaciones nuevas. La constante `IN_LAYOUT` es una refactorización local y el test nuevo sigue la convención de tests junto al componente.
- Siguen pendientes, ya en el backlog: la prueba manual de login ↔ registro y de «Recargar» (F5) y la sección 5 de `plan.md`, que no lista AC-001.5 ni AC-N002.4 entre los verdes justificados.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` da idéntico respecto al snapshot de `06:37:10` (13 archivos). El archivo nuevo `FeedbackForm.test.tsx` entró por una corrección autorizada en `history` (`rework` de tests por petición del usuario en el gate, `done` y `snapshot` posterior). `git diff 2454e44 HEAD` no toca ningún archivo de test: el implementer (`2836d0d`) solo modificó `router.tsx`.
- [x] B4: los dos casos nuevos llevan `// SDD: 017 NFR-002 AC-N002.3` y prueban ese AC.
- [x] B5: no se borra, salta ni debilita ningún test; se añaden dos.
- [x] B5.7: `npm run lint` y `npx tsc -b` correctos, relanzados en esta revisión.
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: test con Vitest y RTL junto al componente, nombres en español, `globals: false` (imports explícitos de `vitest`), `fetch` simulado con `vi.stubGlobal` y restaurado en `afterEach`.
- [x] P2.1 / P2.4 frontend: sin cambios de organización.
- [x] P2.5: lint limpio.
- [x] P2 General: el comentario nuevo de `router.tsx:40-41` está en español correcto.
- [x] P3 / P4: sin input externo, endpoints, modelos ni pasos de producción nuevos.

## 5. Hallazgos
### Estado de los hallazgos anteriores
| # | Estado | Evidencia |
|---|---|---|
| F1 a F4, F6, F7 | Resueltos (iteración 2) | Ver la review de la iteración 2 |
| F5 | Abierto: prueba manual del usuario | Sigue sin constar en `verify-report.md`; está en `specs/017-frontend-polish/backlog.md` |
| F8 | Resuelto | `docs/sdd/decisions/ADR-0026-carga-de-pantallas-bajo-demanda.md:3-4` (commiteado en `2836d0d`): «Aceptada · 2026-10-18» y «aceptada por el usuario en el gate de `review`» |
| F9 | Resuelto | `frontend/src/features/feedback/components/FeedbackForm.test.tsx:1-51`: dos tests de comportamiento; el envío correcto y el error del servidor quedan en el backlog del test-author |
| F10 | Resuelto | `frontend/src/app/router.tsx:40-42`, `:156-196` |

### Hallazgos de esta iteración
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F5 | MENOR | `specs/017-frontend-polish/plan.md` (riesgo 4, sección 6) | Sigue sin constar la prueba manual en `npm run dev` de la transición login ↔ registro (`AnimatePresence mode="wait"` + `Suspense`) y de «Recargar» tras un fallo real de descarga de un chunk (AC-003.2). Le toca al usuario antes del cierre. | implementer |
| F11 | NIT | `frontend/src/features/feedback/components/FeedbackForm.test.tsx:42-44` | El error de categoría se comprueba con `findAllByText("Elige una categoría").length > 1`, porque el placeholder del `Select` (`FeedbackForm.tsx:63`) y el mensaje de zod (`schemas.ts:10`) tienen el mismo texto. Funciona, pero es frágil: si Radix dejara de pintar el placeholder o lo duplicara, el test cambiaría de sentido. Sería más preciso localizar el `FormMessage` del campo (p. ej. por su `id` `…-form-item-message` o con `within` del `FormItem`). | test-author |

## 6. Decisión
APPROVED: no hay hallazgos BLOQUEANTES ni MAYORES. F8, F9 y F10 están resueltos sin regresiones: el snapshot de tests es idéntico, el implementer no tocó tests, y tests, lint y tipos pasan. Queda F5, una prueba manual que debe hacer el usuario antes del cierre, y un NIT (F11) que se puede diferir al backlog.

## Comentarios del usuario

## Comentarios del usuario

- Gate de review: «Vamos a corregir todos, desde F1 a F7,»

- Gate de review (2ª pasada): «Aprobada. Corrige F9 Y 10»
