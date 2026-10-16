# Backlog · 015-onboarding-profile-rhf

## spec · spec-writer
- [ ] Mensaje específico para las pulgadas fuera de rango en el perfil (p. ej. "Entre 0 y 11 in").
- [ ] Mejorar el mensaje de altura en ft/in cuando lo que falla son las pulgadas (hoy dice "Entre 3 y 8 ft").

## plan · planner
- [ ] Mejorar el mensaje de altura en ft/in cuando fallan las pulgadas (sigue diciendo "Entre 3 y 8 ft"; ya está fuera de alcance en la spec).
- [ ] Valorar un test de escaneo del código (como `sourceCleanup013`) que impida reintroducir `validation.ts` o `useState` en estos formularios.
- [ ] Si más formularios necesitan errores visibles desde la carga, documentar el patrón de `fieldMessages` síncrono en un ADR.

## tasks · task-breaker
- [ ] Mejorar el mensaje de altura en ft/in cuando fallan las pulgadas (hoy dice "Entre 3 y 8 ft"). La spec lo deja fuera de alcance.
- [ ] Mediciones con fecha pasada desde el perfil (fuera de alcance de la spec).

## tests · test-author
- [ ] Los tests nuevos de `OnboardingPage.test.tsx` repiten algunas pruebas de fecha que ya existen con el marcador 006 (por ejemplo, la fecha prerrellenada de 1900). Se pueden simplificar cuando se cierre la feature.
- [ ] Los tests de fecha de `ProfilePage.test.tsx` (reglas de validación de la 015) comprueban 14 y 100 años con `fireEvent.change` sobre el `input type=date`. Un test de integración con un navegador real sería más fiel, pero queda fuera de Vitest.

## implement · implementer
- [x] Los warnings "incompatible-library" de react-hook-form watch() (se podría usar useWatch).
- [x] Eliminar updateBody redundante en PhysicalDataForm.

## verify · verifier
- [x] Revisar los dos warnings `incompatible-library` por `form.watch()` en OnboardingPage.tsx:62 y PhysicalDataForm.tsx:64 (nuevos en 015).
- [ ] Mensaje de altura ft/in que no distingue cuando fallan las pulgadas ("Entre 3 y 8 ft"): fuera de alcance de 015, ya anotado en la spec.
- [ ] Warnings previos `only-export-components` en components/ui/form.tsx:159 y components/ui/button.tsx:64 (no tocados por la feature).

## review · reviewer
- [x] F3: dos warnings nuevos de oxlint `incompatible-library` por `form.watch()` en `OnboardingPage.tsx:62` y `PhysicalDataForm.tsx:64`; se evitan con `useWatch`.
- [x] F4: `optionalInRange` en `profile/schemas.ts` duplica la lógica de rango de `body-metrics/schemas.ts:22` y de `onboarding/schemas.ts:56`; conviene una utilidad compartida.
- [x] F5: eliminar `updateBody`, que es redundante, en `PhysicalDataForm.tsx:88-90`.
- [x] F6: quitar los alias locales de los enums (`const gender = genderSchema`…) en `profile/schemas.ts`.
- [x] F7: `dirty` compara con `JSON.stringify` objetos cuyo orden de claves sale de dos fuentes distintas (`PhysicalDataForm.tsx:100-103`); es frágil y conviene comparar campo a campo.

## tests red (ciclo de review 1) · verifier
- [ ] Anotar en el backlog de la feature la entrada espuria "red FAIL: x" de `state.json.history` (08:43:28), que quedó por ser append-only. Corregida en `red_check` por `result red PASS`.
- [ ] Al cerrar el ciclo de review, `tests_snapshot.sha256` de `state.json` sigue con los hashes de la iteración anterior; los dos archivos de test cambiaron por F2. Lo decide el orquestador.
- [ ] La sección "Comentarios del usuario" de verify-report.md se conservó tal cual (`1. Si, confirmado. 2. A`). La plantilla del plugin no la incluye, así que se mantuvo por instrucción explícita.

## verify (ciclo de review 1) · verifier
- [x] Los 2 warnings `react(incompatible-library)` de react-hook-form (`watch`) en OnboardingPage.tsx:62 y PhysicalDataForm.tsx:64 son nuevos de esta feature; valorar en una tarea posterior sustituir `watch` por `useWatch` o valores derivados.
- [ ] Hay un archivo sin trackear `.claudecodeignore` en la raíz del repo que no creó esta feature; decidir si se versiona, se añade a .gitignore o se borra.

## review (iteración 2) · reviewer
- [x] F8: el literal "Elige una opción" de `onboarding/schemas.ts:128` debería ser una constante exportada, como los demás mensajes.

## review (iteración 3) · reviewer
- [x] Marcar como resueltos en specs/015-onboarding-profile-rhf/backlog.md los puntos F3-F8 (y los equivalentes de implement/verify sobre watch y updateBody), que siguen como [ ].
- [ ] Decidir qué hacer con .claudecodeignore, sin trackear en la raíz y ajeno a la feature.
- [ ] Valorar mover inRange a una utilidad compartida en src/lib (hoy body-metrics la importa de onboarding/schemas, que la documenta como regla del onboarding).
