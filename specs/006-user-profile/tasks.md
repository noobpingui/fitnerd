# Tareas 006 — Perfil de usuario persistido en el backend

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-12)

## Fase A0 — Andamiaje (implementer, modo scaffold)
Los tests importan símbolos nuevos; cada uno se crea con su firma y lanza "not implemented". Los tests comparan los mensajes de error con el texto literal de la spec, no con constantes del servicio. Las rutas HTTP nuevas, el modelo, el repositorio y la migración no necesitan andamiaje (un 404 ya es rojo legítimo).

- [ ] T-001 [REQ-001, REQ-002, REQ-003, REQ-004] (scaffold) Crear `ProfileService` (`__init__(user_repository, user_profile_repository, unit_of_work, clock)`, `get_profile`, `save_profile`) y el dataclass `ProfileState`; los métodos lanzan "not implemented" — `backend/services/profile_service.py`
- [ ] T-002 [REQ-009, REQ-012] (scaffold) Crear `ageFromIsoDate(isoDate, today?)` exportada, que lanza "not implemented" — `frontend/src/lib/age.ts`
- [ ] T-003 [REQ-001, REQ-008, REQ-010] (scaffold) Crear los tipos `ServerProfile`, `ProfileResponse` y `SaveProfilePayload` (solo tipos) — `frontend/src/features/profile/types.ts`
- [ ] T-004 [REQ-001, REQ-002] (scaffold) Crear `getProfile()` y `saveProfile(payload)` exportadas, que lanzan "not implemented" — `frontend/src/features/profile/api.ts`
- [ ] T-005 [REQ-008, REQ-010] (scaffold) Crear `answersFromProfile` y `payloadFromAnswers` exportadas, que lanzan "not implemented" — `frontend/src/features/profile/mappers.ts`
- [ ] T-006 [REQ-009, REQ-011] (scaffold) Añadir `dateOfBirthError` e `isDateOfBirthValid` exportadas, que lanzan "not implemented" — `frontend/src/features/onboarding/validation.ts`
- [ ] T-007 [REQ-007] (scaffold) Crear el componente `OnboardingRoute` exportado, que lanza "not implemented" — `frontend/src/app/OnboardingRoute.tsx`

## Fase A — Tests (test-author)

### Backend · servicio
- [ ] T-010 [REQ-001, AC-001.2, AC-001.3, AC-001.4] (test) `get_profile` sin perfil devuelve `profile=None`, onboarding pendiente y la fecha de nacimiento de la cuenta (o `None`); incluye los fakes `FakeUserRepository` y `FakeUserProfileRepository` definidos en el archivo — `backend/tests/test_services/test_profile_service.py`
- [ ] T-011 [REQ-002, AC-002.1, AC-002.2, AC-002.7, AC-002.8] (test) `save_profile` crea el perfil, lo reemplaza por completo y actualiza `date_of_birth` de la cuenta (con y sin fecha previa) — `backend/tests/test_services/test_profile_service.py`
- [ ] T-012 [REQ-002, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.9] (test) Unidades conservadas (ft/in/lb y cm), redondeo a un decimal, campos de la otra unidad ignorados como `None`, `age` ignorada — `backend/tests/test_services/test_profile_service.py`
- [ ] T-013 [REQ-003, AC-003.1, AC-003.2, NFR-001, AC-N001.2] (test) Primer guardado fija `onboarding_completed_at = clock()`, el segundo (tras `clock.advance`) no lo cambia; `user_id` del cuerpo se ignora y solo cambia el usuario del parámetro — `backend/tests/test_services/test_profile_service.py`
- [ ] T-014 [REQ-003, REQ-004, AC-003.3, AC-004.14] (test) Ante un `ValidationError` no se llama a `get_by_id_for_update` ni a `create`, no hay commit y fecha, perfil y onboarding del usuario quedan iguales — `backend/tests/test_services/test_profile_service.py`
- [ ] T-015 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.13] (test) Validación parametrizada de cuerpo, género y fecha de nacimiento (formato, fecha inexistente, futura, edad 13 y 101) con los mensajes exactos — `backend/tests/test_services/test_profile_service.py`
- [ ] T-016 [REQ-004, AC-004.5, AC-004.6, AC-004.7] (test) Validación parametrizada de unidad de altura, `height_cm`, `height_ft`, `height_in` (incluye `bool`, texto, no entero) y `height_in` ausente = 0 — `backend/tests/test_services/test_profile_service.py`
- [ ] T-017 [REQ-004, AC-004.8, AC-004.9, AC-004.10, AC-004.11, AC-004.12] (test) Validación parametrizada de unidad de peso, peso en kg y lb (incluye `NaN` y texto), nivel de actividad y meta — `backend/tests/test_services/test_profile_service.py`
- [ ] T-018 [REQ-004, AC-004.15, AC-004.16] (test) Valores límite aceptados con `FakeClock` en 2026-10-11 y rechazo de quien cumple 14 mañana — `backend/tests/test_services/test_profile_service.py`

### Backend · rutas
- [ ] T-020 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) `GET /api/profile`: tras un `PUT`, usuario de Google sin fecha ni perfil (cuerpo exacto) y usuario registrado con `1995-05-20` sin perfil — `backend/tests/test_routes/test_profile_routes.py`
- [ ] T-021 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.7, AC-002.8, AC-002.9] (test) `PUT /api/profile` seguido de `GET`: cm, ft/lb, cambio de fecha en cuenta de email, fecha nueva en cuenta sin fecha, sin clave `age` — `backend/tests/test_routes/test_profile_routes.py`
- [ ] T-022 [REQ-003, REQ-004, AC-003.1, AC-003.2, AC-003.3, AC-004.14] (test) `onboarding_completed_at` estable entre guardados y `PUT` inválido que devuelve `400` sin cambiar lo anterior — `backend/tests/test_routes/test_profile_routes.py`
- [ ] T-023 [REQ-004, AC-004.1, AC-004.2, AC-004.9, AC-004.13] (test) Mensajes de validación como `{"error": …}` con `400`, y cuerpo ausente, JSON inválido y lista — `backend/tests/test_routes/test_profile_routes.py`
- [ ] T-024 [REQ-005, AC-005.1, AC-005.2] (test) `GET` y `PUT` sin token y con token inválido devuelven `401` y no cambian perfil ni fecha — `backend/tests/test_routes/test_profile_routes.py`
- [ ] T-025 [NFR-001, AC-N001.1, AC-N001.2] (test) Aislamiento entre dos usuarios y `user_id` de otro en el cuerpo — `backend/tests/test_routes/test_profile_routes.py`

### Frontend · funciones puras
- [ ] T-030 [REQ-012, AC-012.4] (test) `ageFromIsoDate`: cumpleaños hoy, mañana y 29 de febrero — `frontend/src/lib/age.test.ts`
- [ ] T-031 [REQ-009, REQ-011, AC-009.2, AC-009.3, AC-009.4, AC-011.4] (test) `dateOfBirthError`: vacía sin mensaje visible, futura, menor de 14, mayor de 100 y límites — `frontend/src/features/onboarding/validation.test.ts`
- [ ] T-032 [REQ-008, REQ-010, AC-008.1, AC-010.1] (test) `payloadFromAnswers` (ft/in o lb, `date_of_birth`, sin `age`, `heightIn` vacío = 0) y `answersFromProfile` — `frontend/src/features/profile/mappers.test.ts`
- [ ] T-033 [REQ-012, AC-012.4] (test) `calculateMacros` da cifras de 27 años el 2026-10-11 y de 28 el 2026-10-12 para `1998-10-12` — `frontend/src/features/macros/calculations.test.ts`

### Frontend · rutas y control de acceso
- [ ] T-034 [REQ-006, REQ-013, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-013.1] (test) `OnboardingGuard`: redirección, pantalla visible, indicador de carga, error con "Reintentar", reintento y datos simulados en `localStorage` ignorados — `frontend/src/app/OnboardingGuard.test.tsx`
- [ ] T-035 [REQ-007, AC-007.1, AC-007.2] (test) `OnboardingRoute` redirige a `/home` si está completado y muestra la primera pregunta si está pendiente — `frontend/src/app/OnboardingRoute.test.tsx`

### Frontend · onboarding
- [ ] T-036 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4] (test) Terminar el onboarding: payload enviado, llegada a `/home`, botón "Guardando…" y un solo envío, error con respuestas intactas — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-037 [REQ-009, REQ-013, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-013.2] (test) Pregunta de fecha de nacimiento (prerrellenada, vacía, futura, fuera de rango, cambiada), ninguna pregunta de edad y `localStorage` sin respuestas — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`

### Frontend · perfil
- [ ] T-038 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) Formulario precargado con los datos del servidor, sin datos de otro usuario y sin campo "Edad" — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-039 [REQ-011, AC-011.1, AC-011.2, AC-011.3, AC-011.4] (test) Guardar solo la meta, el peso (con medición en kg) y la fecha de nacimiento; validación de fecha con "Guardar cambios" deshabilitado — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-040 [REQ-011, AC-011.5, AC-011.6, AC-011.7] (test) Fallo del guardado, fallo de la medición y cifras nuevas en `/macros` y `/home` sin recargar — `frontend/src/features/profile/pages/ProfilePage.test.tsx`

### Frontend · home, Macros y Métricas
- [ ] T-041 [REQ-012, AC-012.1] (test) Home muestra "Meta: Perder peso", "160 lb" y el objetivo calórico del perfil del servidor — `frontend/src/features/home/pages/HomePage.test.tsx`
- [ ] T-042 [REQ-012, AC-012.2, AC-012.4] (test) Macros muestra objetivo y gramos del perfil, con 27 y 28 años según la fecha actual — `frontend/src/features/macros/pages/MacrosPage.test.tsx`
- [ ] T-043 [REQ-012, AC-012.3] (test) Métricas muestra pesos en lb y ritmo según la meta del perfil — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`

### Frontend · cambio de cuenta
- [ ] T-044 [NFR-002, AC-N002.1] (test) Cerrar sesión de A e iniciar la de B en el mismo navegador sin recargar lleva a `/onboarding` con la fecha vacía — `frontend/src/app/accountSwitch.test.tsx`

## Fase B — Implementación (implementer)

### Backend (models → migration → repositories → services → routes)
- [ ] T-100 [REQ-001, REQ-003] (impl) Añadir la columna `onboarding_completed_at` (`DateTime`, nullable) al modelo `User` — `backend/models/user.py`
- [ ] T-101 [REQ-001, REQ-002] (impl) Crear el modelo `UserProfile` (PK `user_id`, nueve columnas, `created_at`, `updated_at`) y registrarlo — `backend/models/user_profile.py`, `backend/models/__init__.py`
- [ ] T-102 [REQ-001, REQ-002, REQ-003] (migration) Migración `c6a1f0d2e9b4` (`down_revision = 'b7c1d9e4a2f3'`): añade `users.onboarding_completed_at` y crea `public.user_profiles`, con `downgrade`; generada con `FLASK_ENV=development` y revisada a mano — `backend/migrations/versions/c6a1f0d2e9b4_add_user_profiles_and_onboarding_.py`
- [ ] T-103 [REQ-003] (impl) Añadir `get_by_id_for_update` (`select … with_for_update()`) — `backend/repositories/user_repository.py`
- [ ] T-104 [REQ-001, REQ-002] (impl) Crear `UserProfileRepository` con `get_by_user_id` — `backend/repositories/user_profile_repository.py`
- [ ] T-105 [REQ-004] (impl) Implementar `_validate` pura y `age_on` en el servicio, con los mensajes exactos, el orden fijo de validación, el regex de fecha, rechazo de `bool`, texto y no finitos, y redondeo `ROUND_HALF_UP` — `backend/services/profile_service.py`
- [ ] T-106 [REQ-001, REQ-002, REQ-003] (impl) Implementar `get_profile` y `save_profile` (validar, bloquear usuario, actualizar fecha, crear o reemplazar perfil, fijar `onboarding_completed_at` una vez, commit o rollback) — `backend/services/profile_service.py`
- [ ] T-107 [REQ-001, REQ-002, REQ-005, NFR-001] (impl) Blueprint `profile_bp` con `GET` y `PUT /api/profile`, `@require_auth`, `_build_profile_service()`, `_serialize` y registro del blueprint — `backend/routes/profile_routes.py`, `backend/routes/__init__.py`

### Frontend (types → schemas → api → hooks → components → pages)
- [ ] T-110 [REQ-009, REQ-013] (impl) Sustituir `age` por `dateOfBirth` en `OnboardingAnswers` y en `EMPTY_ANSWERS` — `frontend/src/features/onboarding/types.ts`, `frontend/src/features/onboarding/constants.ts`
- [ ] T-111 [REQ-001, REQ-002, REQ-004] (impl) Esquemas zod `profileResponseSchema` y `saveProfilePayloadSchema` (`.strict()`, mismos rangos) — `frontend/src/features/profile/schemas.ts`
- [ ] T-112 [REQ-001, REQ-002, REQ-008] (impl) Implementar `getProfile` y `saveProfile` con `apiFetch` y validación zod — `frontend/src/features/profile/api.ts`
- [ ] T-113 [REQ-006, REQ-008, REQ-011] (impl) `profileKeys`, `useProfile` y `useSaveProfile` (con `setQueryData` en `onSuccess`) — `frontend/src/features/profile/hooks.ts`
- [ ] T-114 [REQ-009, REQ-012] (impl) Implementar `ageFromIsoDate` con fecha local — `frontend/src/lib/age.ts`
- [ ] T-115 [REQ-009, REQ-011] (impl) Implementar `dateOfBirthError` e `isDateOfBirthValid` y eliminar `isAgeValid` — `frontend/src/features/onboarding/validation.ts`
- [ ] T-116 [REQ-008, REQ-010] (impl) Implementar `answersFromProfile` y `payloadFromAnswers` — `frontend/src/features/profile/mappers.ts`
- [ ] T-117 [REQ-006] (impl) Componentes `ProfileLoading` y `ProfileLoadError` — `frontend/src/features/profile/components/ProfileLoadState.tsx`
- [ ] T-118 [REQ-012] (impl) `calculateMacros(a, today)` calcula la edad con `ageFromIsoDate` — `frontend/src/features/macros/calculations.ts`
- [ ] T-119 [NFR-002] (impl) `useLogout` y `queryClient.clear()` antes de `setToken` en `useLogin`, `useGoogleLogin` y `useRegister` — `frontend/src/features/auth/hooks.ts`
- [ ] T-120 [NFR-002] (impl) `UserMenu` y `ProfilePage` usan `useLogout` en lugar de su `handleLogout` local — `frontend/src/components/layout/UserMenu.tsx`
- [ ] T-121 [REQ-006, REQ-013] (impl) `OnboardingGuard` decide según `useProfile` (carga, error con reintento, redirección, `Outlet`) — `frontend/src/app/OnboardingGuard.tsx`
- [ ] T-122 [REQ-007] (impl) Implementar `OnboardingRoute` y usarlo en el router — `frontend/src/app/OnboardingRoute.tsx`, `frontend/src/app/router.tsx`
- [ ] T-123 [REQ-008, REQ-009, REQ-013] (impl) `OnboardingPage`: paso de fecha de nacimiento prerrellenada, guardado con `useSaveProfile`, protección contra doble envío, "Guardando…" y mensaje de error — `frontend/src/features/onboarding/pages/OnboardingPage.tsx`
- [ ] T-124 [REQ-010, REQ-011] (impl) `PhysicalDataForm`: campo "Fecha de nacimiento" con error, secuencia `PUT` perfil → `POST` medición y mensajes de error — `frontend/src/features/profile/components/PhysicalDataForm.tsx`
- [ ] T-125 [REQ-010, REQ-013, NFR-002] (impl) `ProfilePage` con `useProfile` y `answersFromProfile`, y `useLogout` — `frontend/src/features/profile/pages/ProfilePage.tsx`
- [ ] T-126 [REQ-012] (impl) `HomePage` usa `useProfile` — `frontend/src/features/home/pages/HomePage.tsx`
- [ ] T-127 [REQ-012] (impl) `MacrosPage` usa `useProfile` — `frontend/src/features/macros/pages/MacrosPage.tsx`
- [ ] T-128 [REQ-012] (impl) `BodyMetricsPage` usa `useProfile` para unidad, altura y meta — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-129 [REQ-013] (impl) Eliminar `storage.ts` y sus imports restantes — `frontend/src/features/onboarding/storage.ts`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-020 | T-100, T-101, T-102, T-104, T-106, T-107 |
| REQ-001 | AC-001.2 | T-010, T-020 | T-100, T-101, T-102, T-104, T-106, T-107 |
| REQ-001 | AC-001.3 | T-010, T-020 | T-100, T-102, T-106, T-107 |
| REQ-001 | AC-001.4 | T-010, T-020 | T-106, T-107 |
| REQ-002 | AC-002.1 | T-011, T-021 | T-101, T-104, T-106, T-107 |
| REQ-002 | AC-002.2 | T-011, T-021 | T-106, T-107 |
| REQ-002 | AC-002.3 | T-012, T-021 | T-105, T-106, T-107 |
| REQ-002 | AC-002.4 | T-012, T-021 | T-105, T-106, T-107 |
| REQ-002 | AC-002.5 | T-012 | T-105 |
| REQ-002 | AC-002.6 | T-012 | T-105, T-106 |
| REQ-002 | AC-002.7 | T-011, T-021 | T-106, T-107 |
| REQ-002 | AC-002.8 | T-011, T-021 | T-106, T-107 |
| REQ-002 | AC-002.9 | T-012, T-021 | T-105, T-107 |
| REQ-003 | AC-003.1 | T-013, T-022 | T-100, T-102, T-106 |
| REQ-003 | AC-003.2 | T-013, T-022 | T-106 |
| REQ-003 | AC-003.3 | T-014, T-022 | T-103, T-105, T-106 |
| REQ-004 | AC-004.1 | T-015, T-023 | T-105 |
| REQ-004 | AC-004.2 | T-015, T-023 | T-105 |
| REQ-004 | AC-004.3 | T-015 | T-105 |
| REQ-004 | AC-004.4 | T-015 | T-105 |
| REQ-004 | AC-004.5 | T-016 | T-105 |
| REQ-004 | AC-004.6 | T-016 | T-105 |
| REQ-004 | AC-004.7 | T-016 | T-105 |
| REQ-004 | AC-004.8 | T-017 | T-105 |
| REQ-004 | AC-004.9 | T-017, T-023 | T-105 |
| REQ-004 | AC-004.10 | T-017 | T-105 |
| REQ-004 | AC-004.11 | T-017 | T-105 |
| REQ-004 | AC-004.12 | T-017 | T-105 |
| REQ-004 | AC-004.13 | T-015, T-023 | T-105, T-107 |
| REQ-004 | AC-004.14 | T-014, T-022 | T-105, T-106 |
| REQ-004 | AC-004.15 | T-018 | T-105 |
| REQ-004 | AC-004.16 | T-018 | T-105 |
| REQ-005 | AC-005.1 | T-024 | T-107 |
| REQ-005 | AC-005.2 | T-024 | T-107 |
| REQ-006 | AC-006.1 | T-034 | T-113, T-117, T-121 |
| REQ-006 | AC-006.2 | T-034 | T-113, T-121 |
| REQ-006 | AC-006.3 | T-034 | T-117, T-121 |
| REQ-006 | AC-006.4 | T-034 | T-117, T-121 |
| REQ-006 | AC-006.5 | T-034 | T-117, T-121 |
| REQ-007 | AC-007.1 | T-035 | T-122 |
| REQ-007 | AC-007.2 | T-035 | T-122 |
| REQ-008 | AC-008.1 | T-032, T-036 | T-111, T-112, T-116, T-123 |
| REQ-008 | AC-008.2 | T-036 | T-113, T-123 |
| REQ-008 | AC-008.3 | T-036 | T-123 |
| REQ-008 | AC-008.4 | T-036 | T-123 |
| REQ-009 | AC-009.1 | T-037 | T-110, T-114, T-122, T-123 |
| REQ-009 | AC-009.2 | T-031, T-037 | T-115, T-123 |
| REQ-009 | AC-009.3 | T-031, T-037 | T-115, T-123 |
| REQ-009 | AC-009.4 | T-031, T-037 | T-114, T-115, T-123 |
| REQ-009 | AC-009.5 | T-037 | T-116, T-123 |
| REQ-009 | AC-009.6 | T-037 | T-110, T-123 |
| REQ-010 | AC-010.1 | T-032, T-038 | T-116, T-124, T-125 |
| REQ-010 | AC-010.2 | T-038 | T-113, T-125 |
| REQ-010 | AC-010.3 | T-038 | T-124 |
| REQ-011 | AC-011.1 | T-039 | T-113, T-124 |
| REQ-011 | AC-011.2 | T-039 | T-124 |
| REQ-011 | AC-011.3 | T-039 | T-124 |
| REQ-011 | AC-011.4 | T-031, T-039 | T-115, T-124 |
| REQ-011 | AC-011.5 | T-040 | T-124 |
| REQ-011 | AC-011.6 | T-040 | T-124 |
| REQ-011 | AC-011.7 | T-040 | T-113, T-126, T-127 |
| REQ-012 | AC-012.1 | T-041 | T-126 |
| REQ-012 | AC-012.2 | T-042 | T-118, T-127 |
| REQ-012 | AC-012.3 | T-043 | T-128 |
| REQ-012 | AC-012.4 | T-030, T-033, T-042 | T-114, T-118, T-127 |
| REQ-013 | AC-013.1 | T-034 | T-121, T-129 |
| REQ-013 | AC-013.2 | T-037 | T-123, T-129 |
| NFR-001 | AC-N001.1 | T-025 | T-107 |
| NFR-001 | AC-N001.2 | T-013, T-025 | T-106, T-107 |
| NFR-002 | AC-N002.1 | T-044 | T-119, T-120, T-125 |
