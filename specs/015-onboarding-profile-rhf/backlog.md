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
- [ ] Los warnings "incompatible-library" de react-hook-form watch() (se podría usar useWatch).
- [ ] Eliminar updateBody redundante en PhysicalDataForm.
