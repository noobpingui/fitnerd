# Tareas 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Plan:** [plan.md](plan.md) (aprobado el 2026-11-02)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos.
- Formato OBLIGATORIO:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold, test, impl.
- La casilla la marca [x] el agente responsable al completar la tarea.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)

El backend no tiene símbolos nuevos (el rojo llega por comportamiento), así que el andamiaje es solo del frontend.

- [x] T-001 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4] (scaffold) Crear en `features/auth/schemas.ts` las constantes `MAX_FIRST_NAME_CHARS`, `FIRST_NAME_REQUIRED_MESSAGE` y `FIRST_NAME_TOO_LONG_MESSAGE` con su valor final, `firstNameMessage(_value: string): string | null` que lance `not implemented` y `firstNameSchema` (`z.string().superRefine` que delega en `firstNameMessage`) — `frontend/src/features/auth/schemas.ts`
- [x] T-002 [REQ-009, AC-009.1, AC-009.2, AC-009.3] (scaffold) Crear `homeGreeting(_firstName: string | null | undefined): string` que lance `not implemented` — `frontend/src/features/home/greeting.ts`
- [x] T-003 [REQ-007, AC-007.3, AC-007.4] (scaffold) Añadir `payloadFromProfileForm(_values: PhysicalDataFormValues): SaveProfilePayload` que lance `not implemented` — `frontend/src/features/profile/mappers.ts`
- [x] T-004 [REQ-004, REQ-007, AC-004.1, AC-007.1] (scaffold) Añadir los tipos `first_name` en `ProfileResponse` y `SaveProfilePayload` (opcional) y `firstName` en `PhysicalDataFormValues`, y `"firstName"` en `ProfileFormErrorKey` — `frontend/src/features/profile/types.ts`

## Fase A — Tests (test-author)

### Backend
- [x] T-010 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) `POST /api/auth/register` sin fecha, con fecha válida y con fechas no válidas o fuera de rango (`"2001-02-30"`, `"abc"`, `123`, `null`, mañana) responde 201 y el perfil tiene `date_of_birth: null` y `onboarding_completed: false`; sin nombre ni fecha, 400 «El nombre es obligatorio» sin crear cuenta; sustituye los tests 018 de fecha y adapta `register_payload` y `REGISTER_FIELD_ERRORS` — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-011 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) `AuthService.register` con 4 argumentos y `register_from_body` con `date_of_birth` no válido ignoran la fecha (`date_of_birth is None`); adapta el helper `register` y retira los tests de fecha — `backend/tests/test_services/test_auth_service.py`
- [x] T-012 [REQ-001, AC-001.3] (test) Adapta los dos tests `020 REQ-005 AC-005.4` de edad en el registro para afirmar 201 y `date_of_birth: null` — `backend/tests/test_routes/test_fixed_clock_routes.py`
- [x] T-013 [REQ-004, AC-004.1, AC-004.2, AC-004.3] (test) `GET` y `PUT /api/profile` devuelven `first_name` (con valor y `null`); adapta `NO_PROFILE` y los tests 001.4 y 002.7 que dependían de la fecha del registro — `backend/tests/test_routes/test_profile_routes.py`
- [x] T-014 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4] (test) `PUT /api/profile` guarda el nombre recortado, lo conserva si la clave falta (con nombre y sin nombre) y acepta 100 caracteres rodeados de espacios — `backend/tests/test_routes/test_profile_routes.py`
- [x] T-015 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4] (test) `PUT /api/profile` con `first_name` `""`, `"   "`, `null`, `123`, 101 y 300 caracteres responde 400 con el mensaje exacto sin modificar nada; el nombre se valida antes que un dato físico no válido — `backend/tests/test_routes/test_profile_routes.py`
- [x] T-016 [REQ-005, REQ-006, AC-005.1, AC-005.2, AC-006.1, AC-006.3] (test) Unitarios de `ProfileService`: clave ausente no toca el nombre, clave presente se guarda recortada, nombre validado antes que la fecha y un 400 no hace commit — `backend/tests/test_services/test_profile_service.py`

### Frontend
- [x] T-020 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4] (test) `firstNameMessage` y `firstNameSchema` con «  Ana  », vacío, solo espacios, 100 y 101 caracteres con espacios y 100 y 101 emojis — `frontend/src/features/auth/schemas.test.ts`
- [x] T-021 [REQ-002, REQ-008, AC-002.1, AC-002.2, AC-008.5, AC-008.6] (test) El registro no muestra «Fecha de nacimiento», envía solo las 4 claves, rechaza nombre «   » o de 101 caracteres y muestra los dos mensajes con nombre y apellido vacíos; los helpers dejan de rellenar la fecha — `frontend/src/features/auth/components/RegisterForm.test.tsx`
- [x] T-022 [REQ-003, AC-003.1] (test) Con `date_of_birth: null` el onboarding muestra la fecha vacía y no avanza sin una fecha válida — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [x] T-023 [REQ-004, REQ-007, REQ-008, AC-004.1, AC-004.2, AC-007.5, AC-007.6, AC-008.2, AC-008.3] (test) `profileResponseSchema` conserva `first_name` y lo pone a `null` si falta, `saveProfilePayloadSchema` lo acepta opcional y `makeProfileFormSchema` da error `firstName` con nombre vacío o de 101 caracteres; los valores válidos añaden `firstName` — `frontend/src/features/profile/schemas.test.ts`
- [x] T-024 [REQ-007, AC-007.3, AC-007.4] (test) `payloadFromProfileForm` recorta `first_name` y conserva el resto de `payloadFromAnswers` — `frontend/src/features/profile/mappers.test.ts`
- [x] T-025 [REQ-004, REQ-007, AC-004.1, AC-004.2] (test) Fixtures: `makeProfileResponse` con `first_name: "Ana"` y `makePendingResponse` con `first_name: null` — `frontend/src/test/profileFixtures.ts`
- [x] T-026 [REQ-007, AC-007.3, AC-009.4] (test) El servidor falso de métricas conserva `first_name` en `saveProfile` (lo actualiza si llega y no lo mete en `profile`) — `frontend/src/test/fakeMetricsServer.ts`
- [x] T-027 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-007.7, AC-007.8] (test) `/profile` muestra «Nombre» precargado o vacío con aviso, lo guarda recortado sin registrar medición, desactiva «Guardar cambios» con nombre vacío o de 101 caracteres, «Descartar» lo revierte, el `h2` es «Datos personales» y «Nombre» va antes que «Género»; los `toEqual` del `PUT` añaden `first_name` — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [x] T-028 [REQ-007, AC-007.3] (test) Adapta los tests de refresco de `PhysicalDataForm` cuyo payload del `PUT` se compara exacto para incluir `first_name` — `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx` (sin cambios necesarios: los tests de PhysicalDataForm.refresh no comparan el payload del PUT con toEqual exacto)
- [x] T-029 [REQ-009, AC-009.1, AC-009.2, AC-009.3] (test) `homeGreeting("Ana")`, `homeGreeting(null)`, `homeGreeting(undefined)` y `homeGreeting("   ")` — `frontend/src/features/home/greeting.test.ts`
- [x] T-030 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (test) El encabezado de nivel 1 de `/home` dice «Hola de nuevo, Ana», «Hola de nuevo» sin nombre o con espacios, y «Hola de nuevo, Beatriz» tras guardar el nombre en `/profile` con el mismo `QueryClient` — `frontend/src/features/home/pages/HomePage.test.tsx`
- [x] T-031 [REQ-009, AC-009.1] (test) Adapta el `h1` de «Hola de nuevo» a «Hola de nuevo, Ana» — `frontend/src/app/router.test.tsx`
- [x] T-032 [REQ-009, AC-009.1] (test) Adapta el `h1` de «Hola de nuevo» a «Hola de nuevo, Ana» — `frontend/src/app/diaryRoute.test.tsx`
- [x] T-033 [REQ-009, AC-009.1] (test) Adapta el `h1` de «Hola de nuevo» a «Hola de nuevo, Ana» — `frontend/src/app/lazyRoutes.test.tsx`

## Fase B — Implementación (implementer)

### Backend (datos → servicios → rutas)
- [x] T-040 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (impl) `AuthService.register` sin `date_of_birth` (se quita `parse_date_of_birth`, el `User` se crea sin fecha) y `register_from_body` deja de leerla — `backend/services/auth_service.py`
- [x] T-041 [REQ-005, REQ-006, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-006.1, AC-006.2, AC-006.3, AC-006.4] (impl) `_validate` valida `first_name` primero solo si la clave está (con `validate_first_name`) y `save_profile` lo guarda en `user.first_name` antes del bucle del perfil — `backend/services/profile_service.py`
- [x] T-042 [REQ-004, AC-004.1, AC-004.2, AC-004.3] (impl) `_serialize` añade `first_name` a `GET` y `PUT /api/profile` — `backend/routes/profile_routes.py`

### Frontend (regla compartida → registro → perfil → home)
- [x] T-050 [REQ-008, REQ-002, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6] (impl) Implementar `firstNameMessage` y `firstNameSchema` (recorte y cuenta por puntos de código); `registerSchema` sin `date_of_birth` y con `first_name: firstNameSchema` — `frontend/src/features/auth/schemas.ts`
- [x] T-051 [REQ-002, AC-002.1, AC-002.2] (impl) `RegisterPayload` sin `date_of_birth` y `RegisterForm` sin el campo «Fecha de nacimiento» ni su valor por defecto — `frontend/src/features/auth/types.ts`, `frontend/src/features/auth/components/RegisterForm.tsx`
- [x] T-052 [REQ-004, REQ-007, AC-004.1, AC-004.2, AC-007.4, AC-007.5, AC-007.6] (impl) `profileResponseSchema` con `first_name` por defecto `null`, `saveProfilePayloadSchema` con `first_name` opcional, `firstName` en `makeProfileFormSchema` y en `fieldMessages`, e implementar `payloadFromProfileForm` — `frontend/src/features/profile/schemas.ts`, `frontend/src/features/profile/mappers.ts`
- [x] T-053 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-007.7, AC-007.8] (impl) Campo «Nombre» primero en `PhysicalDataForm` (prop `initialFirstName`, recorte en `onSave`) y sección «Datos personales» con `initialFirstName={profile.first_name ?? ""}` en `ProfilePage` — `frontend/src/features/profile/components/PhysicalDataForm.tsx`, `frontend/src/features/profile/pages/ProfilePage.tsx`
- [x] T-054 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (impl) Implementar `homeGreeting` y usarlo en el `h1` de `HomePage` — `frontend/src/features/home/greeting.ts`, `frontend/src/features/home/pages/HomePage.tsx`

## Matriz de cobertura

REQ-003 no necesita código nuevo: `OnboardingPage` ya muestra la fecha vacía cuando la cuenta no la tiene y `makePhysicalDataSchema` la exige; solo se añade el test.

| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-011 | T-040 |
| REQ-001 | AC-001.2 | T-010, T-011 | T-040 |
| REQ-001 | AC-001.3 | T-010, T-011, T-012 | T-040 |
| REQ-001 | AC-001.4 | T-010 | T-040 |
| REQ-002 | AC-002.1 | T-021 | T-051 |
| REQ-002 | AC-002.2 | T-021 | T-050, T-051 |
| REQ-003 | AC-003.1 | T-022 | sin cambios de código (ya cumplido) |
| REQ-004 | AC-004.1 | T-013, T-023, T-025 | T-042, T-052 |
| REQ-004 | AC-004.2 | T-013, T-023, T-025 | T-042, T-052 |
| REQ-004 | AC-004.3 | T-013 | T-042 |
| REQ-005 | AC-005.1 | T-014, T-016 | T-041 |
| REQ-005 | AC-005.2 | T-014, T-016 | T-041 |
| REQ-005 | AC-005.3 | T-014 | T-041 |
| REQ-005 | AC-005.4 | T-014 | T-041 |
| REQ-006 | AC-006.1 | T-015, T-016 | T-041 |
| REQ-006 | AC-006.2 | T-015 | T-041 |
| REQ-006 | AC-006.3 | T-015, T-016 | T-041 |
| REQ-006 | AC-006.4 | T-015 | T-041 |
| REQ-007 | AC-007.1 | T-027 | T-053 |
| REQ-007 | AC-007.2 | T-027 | T-053 |
| REQ-007 | AC-007.3 | T-024, T-026, T-027, T-028 | T-053 |
| REQ-007 | AC-007.4 | T-024, T-027 | T-052, T-053 |
| REQ-007 | AC-007.5 | T-023, T-027 | T-052, T-053 |
| REQ-007 | AC-007.6 | T-023, T-027 | T-052, T-053 |
| REQ-007 | AC-007.7 | T-027 | T-053 |
| REQ-007 | AC-007.8 | T-027 | T-053 |
| REQ-008 | AC-008.1 | T-020 | T-050 |
| REQ-008 | AC-008.2 | T-020, T-023 | T-050 |
| REQ-008 | AC-008.3 | T-020, T-023 | T-050 |
| REQ-008 | AC-008.4 | T-020 | T-050 |
| REQ-008 | AC-008.5 | T-021 | T-050 |
| REQ-008 | AC-008.6 | T-021 | T-050 |
| REQ-009 | AC-009.1 | T-029, T-030, T-031, T-032, T-033 | T-054 |
| REQ-009 | AC-009.2 | T-029, T-030 | T-054 |
| REQ-009 | AC-009.3 | T-029, T-030 | T-054 |
| REQ-009 | AC-009.4 | T-026, T-030 | T-054 |

## Comentarios del usuario

- Excepción al Art. B5.2 para F-5 (`frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`, AC-003.1): "sí, opción 1" (se conserva como guarda de regresión; pasa en rojo por diseño).
- Red check tras reabrir la spec solo por formato (F2), con el código ya implementado: "Opción 1" — se reaprueba con el red check PASS del commit `e9db40a` (anterior a implementar), registrado por el verifier citando ese commit. Los tests no han cambiado de comportamiento desde entonces (solo líneas largas, fixtures y comentarios; el snapshot lo confirma).
- F4: "sí a F4" — el test-author quita `clock=FakeClock(NOW)` de `make_service` en `backend/tests/test_services/test_auth_service.py`; después el implementer retira `clock` de `AuthService` y de las dos llamadas de `backend/routes/auth_routes.py`.
- F6: "Aprobado y si para F6" — el test-author marca T-028 como hecha con la nota «sin cambios necesarios» (no hizo falta adaptar `PhysicalDataForm.refresh.test.tsx`; AC-007.3 lo cubren T-024, T-026 y T-027).
