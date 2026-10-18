# Tareas 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-18)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden:
    1. tareas (scaffold): las ejecuta el implementer en modo scaffold (solo firmas que lanzan "not implemented");
    2. tareas (test): las ejecuta el test-author;
    3. tareas impl, migration y config, en orden de dependencia: las ejecuta el implementer.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [NFR-001, AC-N001.1] (scaffold) Crear `inRange(value, _limits, _integer = false): boolean` en el módulo compartido, con cuerpo que lanza `not implemented` — `frontend/src/lib/inRange.ts`
- [x] T-002 [REQ-001, AC-001.5] (scaffold) Añadir `INCHES_RANGE_MESSAGE` (valor real "Entre 0 y 11 in", construido desde `LIMITS.heightIn`), `isHeightFeetValid(_a)` y `heightMessage(_a)` (estas dos lanzan `not implemented`) — `frontend/src/features/onboarding/schemas.ts`
- [x] T-003 [REQ-002, REQ-003, AC-002.1, AC-003.2] (scaffold) Crear `lazyNamed(_load, _name)` y `reloadPage(_location = window.location)`, que lanzan `not implemented` — `frontend/src/app/lazyNamed.ts`
- [x] T-004 [REQ-002, REQ-003, AC-002.1, AC-003.1] (scaffold) Crear `PAGE_LOAD_ERROR_MESSAGE`, `PageLoadError`, `PageErrorBoundary` (con `state = { failed: false }`, `getDerivedStateFromError` y `render` que lanzan `not implemented`) y `RouteSuspense`, con las firmas del plan — `frontend/src/app/RouteSuspense.tsx`

## Fase A — Tests (test-author)
- [x] T-010 [NFR-001, AC-N001.1, AC-N001.2] (test) Valores exactos de `inRange` (3–8: «3», «8», «5.5» verdadero; «», «   », «2.9», «8.1», «abc» falso; solo enteros: «5» verdadero, «5.5» falso) — `frontend/src/lib/inRange.test.ts`
- [x] T-011 [REQ-001, AC-001.5] (test) Mensaje de altura del esquema compartido: 5 ft/12 in y 5 ft/2.5 in dan «Entre 0 y 11 in»; 9 ft/12 in y 5.5 ft/vacías dan «Entre 3 y 8 ft»; actualizar los casos `["5","12"]` y `["5","2.5"]` de la spec 015 — `frontend/src/features/onboarding/schemas.test.ts`
- [x] T-012 [REQ-001, AC-001.5] (test) Esquema del perfil: 5 ft/12 in da «Entre 0 y 11 in» y 5.5 ft con pulgadas vacías sigue dando «Entre 3 y 8 ft» — `frontend/src/features/profile/schemas.test.ts`
- [x] T-013 [REQ-001, AC-001.1, AC-001.2] (test) Perfil ft/lb con 5 ft: 12, 2.5 y -1 in muestran «Entre 0 y 11 in», no «Entre 3 y 8 ft», solo pulgadas con `aria-invalid="true"` y «Guardar» deshabilitado; retirar de los `it.each` de la 015 los casos cubiertos — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [x] T-014 [REQ-001, AC-001.3, AC-001.4] (test) Perfil: de 12 in a 11 o vacío desaparece el mensaje y «Guardar» se habilita; 2, 9 y 5.5 ft con 9 o 12 in muestran «Entre 3 y 8 ft», sin «Entre 0 y 11 in», con los dos campos marcados — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [x] T-015 [REQ-001, AC-001.6] (test) Onboarding con 5 ft y 12 in: «Siguiente» deshabilitado y ningún mensaje que empiece por «Entre» — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [x] T-016 [REQ-002, REQ-003, AC-002.1, AC-003.2] (test) `lazyNamed` resuelve el export con nombre dentro de `Suspense` y `reloadPage({ reload })` llama a `reload` una vez — `frontend/src/app/lazyNamed.test.ts`
- [x] T-017 [REQ-002, REQ-003, AC-002.1, AC-003.1, AC-003.2] (test) `RouteSuspense`: «Cargando…» mientras la promesa está pendiente y luego la pantalla; con rechazo, «No se pudo cargar la página.» y «Recargar» sin «Cargando…»; pulsar «Recargar» llama al `onReload` — `frontend/src/app/RouteSuspense.test.tsx`
- [x] T-018 [REQ-002, AC-002.2] (test) Sin sesión, /login, /register, /forgot-password, /reset-password, /privacy y /terms terminan mostrando su pantalla sin redirigir — `frontend/src/app/lazyRoutes.test.tsx`
- [x] T-019 [REQ-002, AC-002.3, AC-002.4] (test) Con sesión y onboarding completo, /home, /macros, /body-metrics, /coach, /store y /profile muestran su pantalla dentro de la navegación; con onboarding pendiente, /onboarding muestra la primera pregunta — `frontend/src/app/lazyRoutes.test.tsx`
- [x] T-020 [NFR-001, AC-N001.3, AC-N001.4] (test) Escaneo: `onboarding/schemas.ts` no define ni reexporta `inRange`, nadie la importa de ahí, los tres esquemas la importan de `@/lib/inRange`, y los tests existentes de esquemas y páginas siguen presentes — `frontend/src/app/sourceCleanup017.test.ts`
- [x] T-021 [NFR-002, AC-N002.1, AC-N002.2, AC-N002.3, AC-N002.4] (test) Exports de `button` y `form` conservados; como mucho una supresión comentada de `only-export-components` en cada archivo; `.oxlintrc.json` no desactiva la regla; siguen los tests de los formularios afectados — `frontend/src/app/sourceCleanup017.test.ts`
- [x] T-022 [NFR-005, AC-N005.1, AC-N005.2] (test) `vite.config.ts` sin `chunkSizeWarningLimit` ni `manualChunks`; `router.tsx` sin imports estáticos de `features/*/pages/` — `frontend/src/app/sourceCleanup017.test.ts`
- [x] T-023 [NFR-003, AC-N003.1, AC-N003.2] (test) Escaneo de palabras prohibidas y de recuentos (14 y 8 tests) y marcadores en los dos archivos de autenticación — `frontend/src/app/sourceCleanup017.test.ts`
- [x] T-024 [NFR-003, AC-N003.1, AC-N003.2] (test) Corregir tildes y regionalismos en comentarios y nombres de test de `LoginForm.test.tsx` sin tocar aserciones ni marcadores — `frontend/src/features/auth/components/LoginForm.test.tsx`
- [x] T-025 [NFR-003, AC-N003.1, AC-N003.2] (test) Corregir tildes y regionalismos en comentarios y nombres de test de `ForgotPasswordForm.test.tsx` sin tocar aserciones ni marcadores — `frontend/src/features/auth/components/ForgotPasswordForm.test.tsx`
- [x] T-026 [NFR-004, AC-N004.1, AC-N004.2, AC-N004.3] (test) Borrar los dos tests duplicados de fecha prerrellenada de la 015 y poner a los de la 006 los marcadores `REQ-009 AC-009.1 · 015 REQ-007 AC-007.5` y `REQ-009 AC-009.4 · 015 REQ-007 AC-007.5` — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [x] T-027 [REQ-002, AC-002.1] (test) Configurar `asyncUtilTimeout: 3000` de `@testing-library/react` para esperar las importaciones dinámicas — `frontend/src/test/setup.ts`

## Fase B — Implementación (implementer)
- [ ] T-030 [NFR-001, AC-N001.1, AC-N001.2] (impl) Implementar `inRange` moviendo el cuerpo actual sin cambios y con el comentario neutro — `frontend/src/lib/inRange.ts`
- [ ] T-031 [NFR-001, AC-N001.3] (impl) Importar `inRange` de `@/lib/inRange` en los esquemas del perfil y de métricas corporales — `frontend/src/features/profile/schemas.ts`, `frontend/src/features/body-metrics/schemas.ts`
- [ ] T-032 [NFR-001, AC-N001.3, AC-N001.4] (impl) Quitar la definición de `inRange` del esquema del onboarding e importarla de `@/lib/inRange` — `frontend/src/features/onboarding/schemas.ts`
- [ ] T-033 [REQ-001, AC-001.5, AC-001.6] (impl) Implementar `isHeightFeetValid` y `heightMessage` y usar `heightMessage` en `addPhysicalDataIssues` — `frontend/src/features/onboarding/schemas.ts`
- [ ] T-034 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (impl) Marcar el campo de pies solo cuando fallan los pies (`feetOk`) — `frontend/src/features/profile/components/PhysicalDataForm.tsx`
- [ ] T-035 [NFR-002, AC-N002.1, AC-N002.4] (config) Suprimir `only-export-components` en la línea del export de `buttonVariants` con comentario del motivo — `frontend/src/components/ui/button.tsx`
- [ ] T-036 [NFR-002, AC-N002.1, AC-N002.4] (config) Suprimir `only-export-components` en la línea del export de `useFormField` con comentario del motivo — `frontend/src/components/ui/form.tsx`
- [ ] T-037 [REQ-002, REQ-003, AC-002.1, AC-003.2] (impl) Implementar `lazyNamed` y `reloadPage` — `frontend/src/app/lazyNamed.ts`
- [ ] T-038 [REQ-002, REQ-003, AC-002.1, AC-003.1, AC-003.2] (impl) Implementar `PageLoadError`, `PageErrorBoundary` y `RouteSuspense` con `ProfileLoading` como fallback — `frontend/src/app/RouteSuspense.tsx`
- [ ] T-039 [REQ-002, REQ-003, NFR-005, AC-002.2, AC-002.3, AC-002.4, AC-N005.1, AC-N005.2] (impl) Cargar bajo demanda las 12 pantallas, `OnboardingRoute`, `OnboardingGuard` y `AppLayout` con `lazyNamed`, envolviendo cada elemento en `RouteSuspense` — `frontend/src/app/router.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-013 | T-033, T-034 |
| REQ-001 | AC-001.2 | T-013 | T-033, T-034 |
| REQ-001 | AC-001.3 | T-014 | T-033, T-034 |
| REQ-001 | AC-001.4 | T-014 | T-033, T-034 |
| REQ-001 | AC-001.5 | T-011, T-012 | T-033 |
| REQ-001 | AC-001.6 | T-015 | T-033 |
| REQ-002 | AC-002.1 | T-016, T-017, T-027 | T-037, T-038, T-039 |
| REQ-002 | AC-002.2 | T-018 | T-039 |
| REQ-002 | AC-002.3 | T-019 | T-039 |
| REQ-002 | AC-002.4 | T-019 | T-039 |
| REQ-003 | AC-003.1 | T-017 | T-038 |
| REQ-003 | AC-003.2 | T-016, T-017 | T-037, T-038 |
| NFR-001 | AC-N001.1 | T-010 | T-030 |
| NFR-001 | AC-N001.2 | T-010 | T-030 |
| NFR-001 | AC-N001.3 | T-020 | T-031, T-032 |
| NFR-001 | AC-N001.4 | T-020 | T-032 |
| NFR-002 | AC-N002.1 | T-021 | T-035, T-036 |
| NFR-002 | AC-N002.2 | T-021 | T-035, T-036 |
| NFR-002 | AC-N002.3 | T-021 | T-035, T-036 |
| NFR-002 | AC-N002.4 | T-021 | T-035, T-036 |
| NFR-003 | AC-N003.1 | T-023, T-024, T-025 | T-024, T-025 (cambios de test) |
| NFR-003 | AC-N003.2 | T-023, T-024, T-025 | T-024, T-025 (cambios de test) |
| NFR-004 | AC-N004.1 | T-026 | T-026 (cambio de test) |
| NFR-004 | AC-N004.2 | T-026 | T-026 (cambio de test) |
| NFR-004 | AC-N004.3 | T-026 | T-026 (cambio de test) |
| NFR-005 | AC-N005.1 | T-022 | T-039 |
| NFR-005 | AC-N005.2 | T-022 | T-039 |
