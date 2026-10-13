# Plan 006 — Perfil de usuario persistido en el backend

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-12)

## 1. Resumen de la solución

Se añade una tabla `user_profiles` (1:1 con `users`, clave primaria `user_id`) con los datos físicos tal como los escribe el usuario (en su unidad), y una columna `users.onboarding_completed_at`. La fecha de nacimiento sigue siendo `users.date_of_birth`, que el guardado del perfil actualiza. Un nuevo blueprint `profile_routes` expone `GET /api/profile` y `PUT /api/profile` con `@require_auth`; toda la validación y la regla de "primer guardado completa el onboarding" viven en `ProfileService`, que recibe los repositorios, la `UnitOfWork` y un reloj por constructor. En el frontend, `features/profile` gana `api.ts`, `hooks.ts`, `types.ts` y `schemas.ts`; una única query de TanStack (`["profile"]`) sustituye a `features/onboarding/storage.ts` (que se elimina) en el guard, el onboarding, el perfil, el home, Macros y Métricas. La edad pasa a calcularse a partir de la fecha de nacimiento (`src/lib/age.ts`). La caché de TanStack Query se vacía al cerrar sesión y al iniciarla, para no mezclar cuentas.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | `backend/models/user_profile.py` · `backend/migrations/versions/c6a1f0d2e9b4_add_user_profiles_and_onboarding_.py` | `backend/models/user.py` (columna `onboarding_completed_at`) · `backend/models/__init__.py` (registrar `UserProfile`) | Persistir perfil y estado del onboarding (REQ-001–003) |
| backend · repositories | `backend/repositories/user_profile_repository.py` | `backend/repositories/user_repository.py` (`get_by_id_for_update`) | Acceso al perfil por `user_id`; bloqueo de fila del usuario al guardar |
| backend · services | `backend/services/profile_service.py` | — | Validación (REQ-004), guardado atómico (REQ-002/003), lectura (REQ-001) |
| backend · routes | `backend/routes/profile_routes.py` | `backend/routes/__init__.py` (registrar `profile_bp`) | Contrato HTTP (sección 6 de la spec), `@require_auth` (REQ-005, NFR-001) |
| backend · tests | `backend/tests/test_services/test_profile_service.py` · `backend/tests/test_routes/test_profile_routes.py` | — | Ver §5 |
| frontend · features/profile | `api.ts` · `hooks.ts` · `types.ts` · `schemas.ts` · `mappers.ts` · `components/ProfileLoadState.tsx` · tests | `pages/ProfilePage.tsx` · `components/PhysicalDataForm.tsx` | Perfil del servidor; fecha de nacimiento en lugar de edad (REQ-010, REQ-011) |
| frontend · features/onboarding | — | `types.ts` (`age` → `dateOfBirth`) · `constants.ts` (`EMPTY_ANSWERS`) · `validation.ts` (`dateOfBirthError`, se elimina `isAgeValid`) · `pages/OnboardingPage.tsx` · **se elimina** `storage.ts` | REQ-008, REQ-009, REQ-013 |
| frontend · app | `src/app/OnboardingRoute.tsx` · tests | `src/app/OnboardingGuard.tsx` · `src/app/router.tsx` | Guard y ruta de onboarding según el servidor (REQ-006, REQ-007) |
| frontend · features/macros, home, body-metrics | tests de página | `macros/calculations.ts` (edad desde la fecha) · `macros/pages/MacrosPage.tsx` · `home/pages/HomePage.tsx` · `body-metrics/pages/BodyMetricsPage.tsx` | REQ-012 |
| frontend · features/auth y layout | — | `features/auth/hooks.ts` (`useLogout`, limpiar caché al iniciar sesión) · `components/layout/UserMenu.tsx` | NFR-002 |
| frontend · lib | `src/lib/age.ts` · `src/lib/age.test.ts` | — | Edad en años cumplidos (REQ-009, REQ-012) |
| docs | `docs/sdd/decisions/ADR-0019-perfil-de-usuario.md` | `docs/sdd/decisions/README.md` | Decisión de modelo de datos y de caché por sesión |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

**`users` (modificada):**

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `onboarding_completed_at` | `DateTime` (sin zona, UTC, como `password_reset_requests`) | sí | `NULL` = onboarding pendiente. Se fija en el primer guardado válido y no vuelve a cambiar (REQ-003). |

`users.date_of_birth` (`Date`, nullable) ya existe y no cambia de tipo: es la fecha de nacimiento de la cuenta.

**`user_profiles` (nueva), modelo `UserProfile` en `backend/models/user_profile.py`, esquema `public`:**

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `user_id` | `Uuid`, PK, FK `public.users.id` | no | 1:1 con el usuario; la PK impide dos perfiles por usuario |
| `gender` | `String(8)` | no | `male` / `female` |
| `height_unit` | `String(2)` | no | `cm` / `ft` |
| `height_cm` | `Float` | sí | redondeado a 1 decimal; solo si `height_unit = cm` |
| `height_ft` | `Integer` | sí | solo si `height_unit = ft` |
| `height_in` | `Integer` | sí | solo si `height_unit = ft` (0 si no se envió) |
| `weight_unit` | `String(2)` | no | `kg` / `lb` |
| `weight` | `Float` | no | en la unidad de `weight_unit`, redondeado a 1 decimal |
| `activity_level` | `String(16)` | no | `low`, `moderate`, `high`, `very_high`, `athlete` |
| `goal` | `String(16)` | no | `lose`, `lose_slow`, `maintain`, `gain_slow`, `gain` |
| `created_at` | `DateTime`, `server_default=func.now()` | no | |
| `updated_at` | `DateTime`, `server_default=func.now()`, `onupdate=func.now()` | no | como en `users` |

- Los enumerados se guardan como `String` (no `Enum` de Postgres) para no crear tipos en la base; los valores los garantiza el servicio (Art. 7.3). No se añaden `CHECK` en la base.
- Se guarda **lo que el usuario escribió en su unidad** (Q1): no hay columnas convertidas a kg/cm.
- Sin `ondelete=CASCADE` (no hay borrado de usuarios ni de perfiles en el alcance; mismo criterio que `body_metrics`).

**Migración Alembic** `c6a1f0d2e9b4_add_user_profiles_and_onboarding_.py`, `down_revision = 'b7c1d9e4a2f3'` (head actual):
- `upgrade()`: `add_column('users', onboarding_completed_at DateTime nullable)` y `create_table('user_profiles', …, schema='public')` con la FK a `public.users.id`.
- `downgrade()`: `drop_table('user_profiles', schema='public')` y `drop_column('users', 'onboarding_completed_at')`.
- Se genera con `FLASK_ENV=development flask db migrate -m "add user_profiles and onboarding"` y **se revisa a mano**: el autogenerate de este proyecto ha arrastrado antes ruido de FKs (ver `a3828d880ae1`); debe quedar solo con estos dos cambios.
- **Datos existentes:** la columna nueva queda en `NULL` para todos → todos los usuarios empiezan con el onboarding pendiente y sin perfil (AC-001.3); su `date_of_birth` no se toca.
- **Despliegue:** la migración no se aplica sola (ADR-0016). Hay que ejecutar `docker compose -f docker-compose.prod.yml exec backend flask db upgrade` en EC2 justo después del despliegue del backend (ver riesgos).

### 3.2 Contratos de API

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/profile` | `@require_auth` (usuario del token) | — | `200` `{onboarding_completed, onboarding_completed_at, date_of_birth, profile}` (forma exacta de la sección 6 de la spec) | `401` sin token o token inválido · `404` `{"error": "Usuario no encontrado"}` si el `id` del token ya no existe (caso defensivo, igual que `/api/auth/me`) |
| PUT | `/api/profile` | `@require_auth` | objeto plano: `date_of_birth`, `gender`, `height_unit`, `height_cm` \| `height_ft` + `height_in`, `weight_unit`, `weight`, `activity_level`, `goal`. Cualquier otra clave se ignora (incluidas `age` y `user_id`). | `200` con la misma forma que el GET | `400` `{"error": <mensaje de la sección 6>}` · `401` · `404` (defensivo) |

Serialización (en `profile_routes._serialize(state)`):
- `onboarding_completed`: `user.onboarding_completed_at is not None`.
- `onboarding_completed_at`: `user.onboarding_completed_at.replace(tzinfo=timezone.utc).isoformat(timespec="seconds")` → `"2026-10-11T18:30:00+00:00"`, o `null`.
- `date_of_birth`: `user.date_of_birth.isoformat()` o `null` (siempre presente).
- `profile`: `null` o el diccionario con las nueve claves; las de la otra unidad de altura van como `null`. Nunca se incluye `age`.

La ruta solo hace `request.get_json(silent=True)` (sin `or {}`: el servicio necesita distinguir "no es un objeto"), toma `user_id = g.decoded_token["id"]`, llama al servicio y serializa. Ningún error se construye en la ruta (Art. 6.3).

### 3.3 Lógica de negocio

**`backend/services/profile_service.py`**

```text
class ProfileService:
    __init__(self, user_repository, user_profile_repository, unit_of_work, clock=utc_now)
    get_profile(user_id) -> ProfileState
    save_profile(user_id, data) -> ProfileState

@dataclass ProfileState: user, profile   # profile: UserProfile | None
```

- `clock` devuelve un `datetime` UTC sin zona (misma convención que `password_reset_service.utc_now`); la "fecha actual del servidor" es `clock().date()`. Se inyecta por constructor para probar límites con `FakeClock` sin `monkeypatch` (Art. 5.4).
- Constantes de mensajes exportadas (`INVALID_BODY_MESSAGE`, `INVALID_DOB_MESSAGE`, `FUTURE_DOB_MESSAGE`, `AGE_RANGE_MESSAGE`, `INVALID_GENDER_MESSAGE`, `INVALID_HEIGHT_UNIT_MESSAGE`, `HEIGHT_CM_MESSAGE`, `HEIGHT_FT_MESSAGE`, `INVALID_WEIGHT_UNIT_MESSAGE`, `WEIGHT_KG_MESSAGE`, `WEIGHT_LB_MESSAGE`, `INVALID_ACTIVITY_MESSAGE`, `INVALID_GOAL_MESSAGE`) con el texto exacto de la sección 6.
- `age_on(date_of_birth, today)`: `today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))` (quien cumple hoy ya tiene la edad nueva; un 29 de febrero cumple el 1 de marzo en años no bisiestos).

**`get_profile(user_id)`**: `user = user_repository.get_by_id(user_id)`; si es `None` → `ResourceNotFoundError("Usuario no encontrado")`; `profile = user_profile_repository.get_by_user_id(user.id)`; devuelve `ProfileState(user, profile)`.

**`save_profile(user_id, data)`** — orden estricto para que un `400` no modifique nada (REQ-004, AC-004.14, AC-003.3):
1. `cleaned = _validate(data, today=self.clock().date())` — función pura, sin tocar repositorios. Lanza `ValidationError` con el **primer** fallo, en este orden: cuerpo → `date_of_birth` → `gender` → `height_unit` → altura → `weight_unit` → `weight` → `activity_level` → `goal`.
   - Cuerpo: `isinstance(data, dict)`, si no → "Los datos del perfil no son válidos" (AC-004.13; cubre `None` por cuerpo ausente o JSON inválido, listas, números…).
   - `date_of_birth`: debe ser `str` que cumpla `^\d{4}-\d{2}-\d{2}$` **y** `date.fromisoformat` sin error. El regex es obligatorio: en Python 3.11+ `fromisoformat` acepta también `"20010101"` o `"2001-W01-1"`. Luego futura (`dob > today`) → "no puede ser futura"; luego `not 14 <= age_on(dob, today) <= 100` → "Debes tener entre 14 y 100 años".
   - Números: un valor numérico válido es `int` o `float`, **no** `bool` (en Python `True` es `int`), finito (`math.isfinite`, porque `json.loads` acepta `NaN`/`Infinity`). Los textos (`"28"`) no son válidos.
   - `height_unit = "cm"`: `height_cm` numérico en [100, 250] sobre el valor **sin redondear**; se guarda redondeado. `height_ft`/`height_in` se ignoran sin validarse y se guardan `NULL` (AC-002.6).
   - `height_unit = "ft"`: `height_ft` `int` (no `bool`) en [3, 8]; `height_in` ausente o `None` → 0; si está, `int` en [0, 11]. `height_cm` se ignora y se guarda `NULL`.
   - `weight`: numérico; rango según `weight_unit` (30–300 kg o 66–660 lb) sobre el valor sin redondear.
   - Redondeo a 1 decimal con `Decimal(str(x)).quantize(Decimal("0.1"), ROUND_HALF_UP)` convertido a `float` (resultado predecible en los casos `.x5`; AC-002.5: 72.46 → 72.5, 175.04 → 175.0).
   - Claves desconocidas (`age`, `user_id`, …) no se leen (AC-002.9, AC-N002.2).
2. `user = user_repository.get_by_id_for_update(user_id)` (`select(User).where(id).with_for_update()`): serializa dos guardados simultáneos del mismo usuario, de modo que solo uno crea la fila de `user_profiles` y fija `onboarding_completed_at`. Si es `None` → `ResourceNotFoundError`.
3. `user.date_of_birth = cleaned.date_of_birth`.
4. `profile = user_profile_repository.get_by_user_id(user.id)`; si no existe, `UserProfile(user_id=user.id)` + `create`; en ambos casos se **sobrescriben las nueve columnas** (reemplazo completo, AC-002.2).
5. `if user.onboarding_completed_at is None: user.onboarding_completed_at = self.clock()` (AC-003.1, AC-003.2).
6. `unit_of_work.commit()`; cualquier excepción en 2–6 → `unit_of_work.rollback()` y se relanza (patrón de `PasswordResetService`).
7. Devuelve `ProfileState(user, profile)`.

El `user_id` siempre sale del token (`g.decoded_token["id"]`), nunca del cuerpo (Art. 7.2, NFR-001). La fila nueva usa `user.id` (UUID ya cargado), no el texto del token.

**Repositorios**
- `UserProfileRepository(BaseRepository)` con `get_by_user_id(user_id)` (`session.get(UserProfile, user_id)` o `select … where user_id`). Hereda `create`.
- `UserRepository.get_by_id_for_update(user_id)`.

**Ruta** `backend/routes/profile_routes.py`: `profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")`, `_build_profile_service()` (repositorios sobre `db.session`, `UnitOfWork(db.session)`, reloj por defecto), `GET ""` y `PUT ""` con `@require_auth`. Se registra en `routes/__init__.py`.

### 3.4 Frontend

**Tipos y contrato (`src/features/profile/types.ts`)**
```ts
type ServerProfile = { gender: Gender; height_unit: HeightUnit; height_cm: number | null;
  height_ft: number | null; height_in: number | null; weight_unit: WeightUnit; weight: number;
  activity_level: ActivityLevel; goal: Goal }
type ProfileResponse = { onboarding_completed: boolean; onboarding_completed_at: string | null;
  date_of_birth: string | null; profile: ServerProfile | null }
type SaveProfilePayload = { date_of_birth: string } & ServerProfile   // sin age
```

**`schemas.ts` (zod, Art. 7.3):**
- `profileResponseSchema`: valida la respuesta del servidor en `api.ts` (`schema.parse(await apiFetch(...))`).
- `saveProfilePayloadSchema`: valida el payload antes del `PUT` (fecha `z.iso.date()`, enumerados con `z.enum`, números con los mismos rangos de `LIMITS`; ft/in enteros). Rechaza claves extra con `.strict()` para garantizar que nunca sale `age`.

**`api.ts`:** `getProfile()` → `apiFetch<unknown>("/api/profile")` + `profileResponseSchema.parse`; `saveProfile(payload)` → `saveProfilePayloadSchema.parse(payload)` y `apiFetch("/api/profile", { method: "PUT", body })` + parse de la respuesta.

**`hooks.ts`:**
- `export const profileKeys = { detail: ["profile"] as const }`.
- `useProfile()` → `useQuery({ queryKey: profileKeys.detail, queryFn: getProfile })`. No fija `retry` (hereda del `QueryClient`; los tests lo crean con `retry: false`).
- `useSaveProfile()` → `useMutation({ mutationFn: saveProfile, onSuccess: (data) => queryClient.setQueryData(profileKeys.detail, data) })`. Escribir la caché (en lugar de invalidar) hace que el guard vea `onboarding_completed: true` antes de navegar a `/home` (AC-008.2) y que home y Macros muestren los datos nuevos sin recargar (AC-011.7). El `onSuccess` del hook se ejecuta antes que el de `mutate`, así que el orden "actualizar caché → navegar" está garantizado.

**`mappers.ts`:**
- `answersFromProfile(resp: ProfileResponse): OnboardingAnswers` — números a texto; `dateOfBirth: resp.date_of_birth ?? ""`; si `profile` es `null` devuelve `EMPTY_ANSWERS` con la fecha prerrellenada.
- `payloadFromAnswers(a: OnboardingAnswers): SaveProfilePayload` — texto a número; solo los campos de la unidad elegida (los otros a `null`); `heightIn` vacío → 0; incluye `date_of_birth: a.dateOfBirth`; nunca `age` (AC-008.1).

**Edad (`src/lib/age.ts`):** `ageFromIsoDate(isoDate: string, today = new Date()): number` en años cumplidos con la fecha **local** del dispositivo (parte el `"YYYY-MM-DD"` a mano, como `parseLocalDate`, para no desplazar el día por la zona horaria).

**Onboarding (`features/onboarding`)**
- `types.ts`: `OnboardingAnswers.age` → `dateOfBirth: string` (`""` o `"YYYY-MM-DD"`). `constants.ts`: `EMPTY_ANSWERS.dateOfBirth = ""`; `LIMITS.age` se mantiene (14–100) y se aplica a la edad calculada.
- `validation.ts`: se elimina `isAgeValid`; se añade `dateOfBirthError(a, today = new Date()): string | null` que devuelve `null` si es válida, `"La fecha de nacimiento no puede ser futura"`, `"Debes tener entre 14 y 100 años"`, o un marcador de "vacía/incompleta" (`""` → no válida pero **sin mensaje visible**, AC-009.2), e `isDateOfBirthValid(a)`.
- `pages/OnboardingPage.tsx`:
  - Recibe `initialDateOfBirth: string | null`; estado inicial `{ ...EMPTY_ANSWERS, dateOfBirth: initialDateOfBirth ?? "" }`.
  - El paso 2 pasa a `id: "date-of-birth"`, título "¿Cuál es tu fecha de nacimiento?", con `<Input type="date" aria-label="Fecha de nacimiento" max={hoy}>` (componente shadcn existente) y el mensaje de error debajo cuando lo hay (AC-009.3, AC-009.4, también para una fecha prerrellenada).
  - "Comenzar": `useSaveProfile().mutate(payloadFromAnswers(answers), { onSuccess: () => navigate("/home", { replace: true }) })`. Un `useRef` `submitting` (como `advancing`) impide un segundo envío antes de que `isPending` se refleje (AC-008.3). Mientras guarda, el botón está deshabilitado y dice "Guardando…". Si falla, `role="alert"` "No se pudo guardar tu perfil. Inténtalo de nuevo." y el usuario sigue en el último paso con sus respuestas (AC-008.4).
- `storage.ts` **se elimina** junto con todos sus imports (REQ-013). La clave antigua `fitnerd_onboarding_mock` simplemente deja de leerse.

**Rutas (`src/app`)**
- `features/profile/components/ProfileLoadState.tsx`: `ProfileLoading` (indicador con `role="status"`, texto "Cargando…") y `ProfileLoadError({ onRetry })` (texto "No se pudo cargar tu perfil." y botón "Reintentar").
- `OnboardingGuard.tsx`: `const { data, isPending, isError, refetch } = useProfile()`. `isPending` → `ProfileLoading`; `isError` → `ProfileLoadError` con `onRetry={() => refetch()}`, sin redirigir; `!data.onboarding_completed` → `<Navigate to="/onboarding" replace />`; si no → `<Outlet />` (AC-006.1–006.5). Se usa `isPending` (no `isFetching`): un refetch en segundo plano con datos en caché no vuelve a mostrar el indicador.
- `OnboardingRoute.tsx` (sale de `router.tsx`): mismos estados de carga y error; completado → `<Navigate to="/home" replace />`; pendiente → `<OnboardingPage initialDateOfBirth={data.date_of_birth} />` (AC-007.1, AC-007.2, AC-009.1, AC-009.2).

**Perfil (`features/profile`)**
- `ProfilePage.tsx`: `useProfile()` en lugar de `getOnboardingAnswers()`; `initial = answersFromProfile(data)`; el formulario se monta cuando hay `data` y el historial de métricas terminó de cargar (como hoy).
- `PhysicalDataForm.tsx`:
  - El campo "Edad" se sustituye por "Fecha de nacimiento" (`<Input type="date" id="profile-dob">` asociado a su `Label`), con el error de `dateOfBirthError` debajo (AC-010.3, AC-011.4).
  - Guardado con `useSaveProfile().mutateAsync` y `useCreateBodyMetric().mutateAsync`:
    1. `reset()` de ambas mutaciones;
    2. `PUT` del perfil completo (siempre que el formulario esté sucio y sea válido); si falla → "No se pudieron guardar los cambios. Inténtalo de nuevo." y no se toca `saved`;
    3. si `measurementChanged`, `POST /api/body-metrics` como hoy; si falla → "No se pudo guardar la medición. Inténtalo de nuevo.", **sin** actualizar `saved` (así un reintento vuelve a detectar el cambio y registra la medición; repetir el `PUT` es idempotente);
    4. si todo va bien → `commit()` (actualiza `saved`/`savedBody` y muestra "Cambios guardados").
  - El botón muestra "Guardando…" mientras cualquiera de las dos está en curso.

**Home, Macros y Métricas**
- `macros/calculations.ts`: `calculateMacros(a, today = new Date())` usa `ageFromIsoDate(a.dateOfBirth, today)` en lugar de `Number(a.age)`. Fórmulas sin cambios.
- `HomePage.tsx` y `MacrosPage.tsx`: `useProfile()` + `answersFromProfile(data)`; `null` mientras no hay perfil (el guard ya garantiza que existe). La edad se calcula en cada render con la fecha actual (AC-012.4).
- `BodyMetricsPage.tsx`: `useProfile()` sustituye a `getOnboardingAnswers()` para `weightUnit`, altura en cm y `goal`.

**Cambio de cuenta (NFR-002)**
- `features/auth/hooks.ts`: nuevo `useLogout()` → `clearToken()`, `queryClient.clear()`, `navigate("/login", { replace: true })`. Lo usan `UserMenu.tsx` y `ProfilePage.tsx` en lugar de su `handleLogout` local.
- `useLogin`, `useGoogleLogin` y `useRegister`: `queryClient.clear()` justo antes de `setToken`, por defensa en profundidad (también si la sesión anterior terminó sin pasar por `useLogout`, por ejemplo al caducar el token).
- Así la query `["profile"]` (y `["auth","me"]`) de la cuenta A nunca se muestra a la cuenta B sin recargar la página (AC-N002.1).

**Claves de query:** `["profile"]` (nueva). Sin cambios en `["body-metrics"]` ni `["auth","me"]`.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `ProfileService.get_profile` · `profile_routes` `GET` + `_serialize` · `users.onboarding_completed_at` nula para usuarios existentes (migración) |
| REQ-002 | `ProfileService.save_profile` (pasos 2–7: reemplazo completo, unidades originales, redondeo, `users.date_of_birth`) · tabla `user_profiles` · `profile_routes` `PUT` |
| REQ-003 | `save_profile` paso 5 (solo si `onboarding_completed_at` es `NULL`) · validación antes de cualquier escritura · bloqueo `get_by_id_for_update` |
| REQ-004 | `_validate` (función pura, mensajes exactos, orden fijo, regex de fecha, `bool`/texto/no finitos rechazados, edad con `age_on` y `clock`) · rollback sin commit |
| REQ-005 | `@require_auth` en ambos endpoints (`AuthenticationError` → 401 antes de llegar al servicio) |
| REQ-006 | `OnboardingGuard` con `useProfile` · `ProfileLoading` · `ProfileLoadError` + `refetch` |
| REQ-007 | `src/app/OnboardingRoute.tsx` |
| REQ-008 | `OnboardingPage` + `useSaveProfile` (`setQueryData`) + `payloadFromAnswers` + guarda `submitting` |
| REQ-009 | Paso "date-of-birth" en `OnboardingPage` · `dateOfBirthError` · `ageFromIsoDate` · `initialDateOfBirth` desde `OnboardingRoute` |
| REQ-010 | `ProfilePage` + `answersFromProfile` · campo "Fecha de nacimiento" en `PhysicalDataForm` |
| REQ-011 | `PhysicalDataForm` (secuencia `PUT` → `POST` medición, mensajes de error, `saved` intacto ante fallo) · `useSaveProfile` actualiza la caché |
| REQ-012 | `calculateMacros(a, today)` con `ageFromIsoDate` · `HomePage`, `MacrosPage` y `BodyMetricsPage` con `useProfile` |
| REQ-013 | Eliminación de `features/onboarding/storage.ts` y de todos sus usos |
| NFR-001 | `user_id` siempre de `g.decoded_token["id"]`; el servicio no lee claves de usuario del cuerpo; `UserProfile` con PK `user_id` |
| NFR-002 | `useLogout` + `queryClient.clear()` al cerrar e iniciar sesión · sin estado de perfil en `localStorage` |

## 5. Estrategia de pruebas

Todas las pruebas llevan `# SDD: …` / `// SDD: …` en la línea anterior a cada `def test_…` / `it(…)`.

### 5.1 Backend · unitarios de servicio (`backend/tests/test_services/test_profile_service.py`)

Fakes **nuevos, definidos en el propio archivo** (cada repositorio tiene una forma distinta, como en `test_weekly_plan_service.py`):
- `FakeUserRepository(users)`: `get_by_id`, `get_by_id_for_update` (registra que se llamó), sobre `SimpleNamespace(id, date_of_birth, onboarding_completed_at)`.
- `FakeUserProfileRepository`: `get_by_user_id`, `create` (guarda en un dict por `user_id`).

Reutilizados de `tests/fakes.py`: `FakeUnitOfWork` (comprobar `committed` / `rolled_back`) y `FakeClock` (fecha "hoy" fija, por ejemplo `datetime(2026, 10, 11, 12, 0)`).

| AC | Qué se comprueba |
|---|---|
| AC-001.2, AC-001.3, AC-001.4 | `get_profile` de un usuario sin perfil devuelve `profile=None`, `onboarding_completed_at=None` y la `date_of_birth` de la cuenta (o `None`) |
| AC-002.1, AC-002.2 | crear y reemplazar por completo: el segundo guardado sobrescribe todas las columnas |
| AC-002.3, AC-002.4, AC-002.6 | ft/in conserva `5`/`9`/`lb 160` con `height_cm=None`; cm conserva `175.5` con ft/in `None`; los campos de la otra unidad se ignoran aunque traigan valores (incluso fuera de rango) |
| AC-002.5 | 72.46 → 72.5 y 175.04 → 175.0 |
| AC-002.7, AC-002.8 | `user.date_of_birth` pasa a la fecha enviada |
| AC-002.9, AC-N002.2 | `age` y `user_id` del cuerpo se ignoran; solo cambia el usuario del parámetro |
| AC-003.1, AC-003.2 | primer guardado fija `onboarding_completed_at = clock()`; tras `clock.advance(days=1)` un segundo guardado no lo cambia |
| AC-003.3, AC-004.14 | ante cualquier `ValidationError`: no se llama a `get_by_id_for_update` ni a `create`, `committed` es `False` y fecha/perfil/onboarding del usuario siguen iguales |
| AC-004.1–AC-004.13 | un test parametrizado por mensaje: `gender` ausente/`"other"`; fecha ausente, `None`, `19950520` (número), `"20010101"`, `"2001-W01-1"`, `"2001-02-30"`; fecha futura; edad 13 y 101; `height_unit` ausente/`"m"`; `height_cm` ausente, `"175"`, `99.9`, `250.1`, `True`; `height_ft` `2`, `9`, `5.5`, `"5"`; `height_in` `12`, `-1`, `3.5`; `weight_unit` ausente/`"st"`; `weight` kg `29.9`/`300.1`/`"70"`/`float("nan")`; lb `65.9`/`660.1`; `activity_level` y `goal` ausentes o desconocidos; cuerpo `None`, `[]`, `"x"` |
| AC-004.7 (parte válida) | `height_unit: "ft"` sin `height_in` → se guarda `height_in = 0` |
| AC-004.15 | límites aceptados con `FakeClock` en 2026-10-11: nacido 2012-10-11 (14 años hoy), 1925-10-12 (100 años, aún no 101), 100/250 cm, 3 ft 0 in, 8 ft 11 in, 30/300 kg, 66/660 lb |
| AC-004.16 | nacido 2012-10-12 (cumple 14 mañana) → "Debes tener entre 14 y 100 años" |

### 5.2 Backend · integración de rutas (`backend/tests/test_routes/test_profile_routes.py`, requiere Postgres)

Se usan `client` y `registered_user` (registro con `date_of_birth: "2000-01-01"`). Para un usuario "de Google" sin fecha y para un segundo usuario se crea un `User` directamente con `db.session` dentro de `app.app_context()` y se firma su token con `extensions.jwt_manager.generate_token({"id": str(user.id), "user_role": "user"}, 30)` (como `admin_headers`). Las fechas válidas se calculan lejos de los límites (por ejemplo, 30 años) para no depender de la hora UTC de la ejecución; los límites exactos se prueban en los unitarios.

| AC | Qué se comprueba |
|---|---|
| AC-001.1 | tras un `PUT`, el `GET` devuelve `onboarding_completed: true`, `onboarding_completed_at` parseable con `datetime.fromisoformat` y con zona, `date_of_birth` y `profile` idénticos |
| AC-001.2 | usuario sin fecha ni perfil → cuerpo exacto `{"onboarding_completed": false, "onboarding_completed_at": null, "date_of_birth": null, "profile": null}` |
| AC-001.3, AC-001.4 | usuario registrado con `1995-05-20` sin perfil → pendiente, `profile: null`, `date_of_birth: "1995-05-20"` |
| AC-002.1–AC-002.4, AC-002.7, AC-002.8 | `PUT` + `GET` posterior (cm y ft/lb; cambio de fecha de una cuenta de email; fecha nueva en cuenta sin fecha) |
| AC-002.9 | la respuesta no contiene la clave `age` (ni dentro de `profile`) |
| AC-003.1, AC-003.2 | primer `PUT` → `onboarding_completed_at` no nulo; segundo `PUT` → mismo valor |
| AC-003.3, AC-004.14 | `PUT` inválido (por ejemplo, solo la fecha futura) → `400` y el `GET` posterior devuelve lo anterior |
| AC-004.13 | `PUT` sin cuerpo, con `data="no-json"` y `content_type="application/json"`, y con `json=[1, 2]` → `400` "Los datos del perfil no son válidos" |
| AC-004.x (muestra) | dos o tres mensajes de validación por HTTP para comprobar que salen como `{"error": …}` con `400` |
| AC-005.1, AC-005.2 | `GET` y `PUT` sin token y con `Bearer basura` → `401`; el perfil y la fecha del usuario existente no cambian |
| AC-N001.1, AC-N001.2 | dos usuarios: A lee solo lo suyo; A envía `user_id` de B en el cuerpo → cambia A y B queda igual |

### 5.3 Frontend · Vitest + RTL

La red se simula con `vi.mock("@/features/profile/api")` (y `@/features/body-metrics/api` y `@/features/auth/api` donde haga falta), como en `CoachPage.test.tsx`. `QueryClient` con `defaultOptions: { queries: { retry: false }, mutations: { retry: false } }`. Las rutas se montan con `MemoryRouter` + `Routes` mínimas (o `AppRouter` con `window.history.pushState`, como `router.test.tsx`). Para fijar "hoy" se usa `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(...)` (solo `Date`, para no congelar los temporizadores de RTL), o se pasa `today` explícito en los tests de funciones puras.

| Archivo de test (nuevo) | AC |
|---|---|
| `src/lib/age.test.ts` | edad en años cumplidos (cumpleaños hoy, mañana, 29-feb) — apoyo de AC-009.4, AC-012.4 |
| `src/features/onboarding/validation.test.ts` | `dateOfBirthError`: vacía sin mensaje, futura, < 14, > 100, límites — apoyo de AC-009.2–AC-009.4, AC-011.4 |
| `src/features/profile/mappers.test.ts` | AC-008.1 (payload con ft/in o lb, `date_of_birth`, sin `age`, `heightIn` vacío → 0), AC-010.1 (respuesta → respuestas del formulario) |
| `src/features/macros/calculations.test.ts` | AC-012.4 (mismas cifras que con 27 años el 2026-10-11 y con 28 el 2026-10-12 para `1998-10-12`) |
| `src/app/OnboardingGuard.test.tsx` | AC-006.1, AC-006.2, AC-006.3 (promesa pendiente → indicador, ni redirección ni contenido), AC-006.4, AC-006.5 (primer `getProfile` rechaza, el segundo resuelve completado → pantalla visible), AC-013.1 (`localStorage` con `fitnerd_onboarding_mock` + servidor pendiente → `/onboarding`) |
| `src/app/OnboardingRoute.test.tsx` | AC-007.1, AC-007.2 |
| `src/features/onboarding/pages/OnboardingPage.test.tsx` | AC-008.1 (argumentos de `saveProfile`), AC-008.2 (llega a `/home`, ruta de prueba renderiza "Home" y el guard no redirige de nuevo), AC-008.3 (promesa pendiente: botón deshabilitado con "Guardando…"; dos clics → una llamada), AC-008.4 (rechazo: mensaje, sigue en la pregunta de la meta, la meta sigue seleccionada, botón "Comenzar" habilitado), AC-009.1–AC-009.6, AC-013.2 (tras terminar, `localStorage` no contiene las respuestas; solo puede contener el token) |
| `src/features/profile/pages/ProfilePage.test.tsx` | AC-010.1 (valores precargados: fecha `1998-04-03`, 5 ft 9 in, 160 lb, "Alto", "Perder peso lentamente", género), AC-010.2 (dos renders con respuestas distintas del mock; sin datos del primero), AC-010.3, AC-011.1–AC-011.6 (comprobando argumentos de `saveProfile` y si se llamó o no `createBodyMetric` con el peso en kg), AC-011.7 (en el mismo `QueryClient` y router: guardar en `/profile`, navegar a `/macros` y `/home` y ver las cifras nuevas con `getProfile` llamado una sola vez) |
| `src/features/home/pages/HomePage.test.tsx` | AC-012.1 ("Meta: Perder peso", "160 lb", objetivo calórico igual al de `calculateMacros` con esos datos) |
| `src/features/macros/pages/MacrosPage.test.tsx` | AC-012.2, AC-012.4 (con `vi.setSystemTime` a 2026-10-11 y 2026-10-12) |
| `src/features/body-metrics/pages/BodyMetricsPage.test.tsx` | AC-012.3 (pesos en lb y texto de ritmo según la meta del perfil) |
| `src/app/accountSwitch.test.tsx` | AC-N002.1: `AppRouter` en `/profile` con token de A (completado, fecha A); clic en "Cerrar sesión"; login de B con `login` mockeado; `getProfile` devuelve B pendiente con `date_of_birth: null` → `/onboarding`, y en la pregunta de la fecha el campo está vacío |

Los tests existentes que dependan de `storage.ts` (ninguno hoy) o de `isAgeValid` deben ajustarse dentro de las tareas; `router.test.tsx` no cambia.

### 5.4 Fakes y utilidades nuevas
- Backend: `FakeUserRepository` y `FakeUserProfileRepository` en `test_profile_service.py`. No hace falta tocar `tests/fakes.py` (`FakeUnitOfWork` y `FakeClock` ya existen).
- Frontend: helpers locales en cada test (`renderWithClient`, fábrica `makeProfileResponse(overrides)`); si se repiten en tres o más archivos, se pueden mover a `src/test/profileFixtures.ts`.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Frontend desplegado en Vercel antes de aplicar la migración en producción: `GET /api/profile` da 500 y toda la app muestra "No se pudo cargar tu perfil." | Media | Alto | Aplicar `flask db upgrade` en EC2 nada más termine el job `deploy`; dejarlo como paso explícito en la etapa `docs`/cierre. El estado de error con "Reintentar" evita, al menos, que se sobrescriba el onboarding. |
| Migración olvidada o con ruido del autogenerate (los tests usan `create_all()`) | Media | Alto | Migración revisada a mano con solo los dos cambios; `down_revision = 'b7c1d9e4a2f3'`; el `reviewer` la comprueba (Art. 6.4); generar siempre con `FLASK_ENV=development`. |
| Caché de TanStack Query con el perfil de otra cuenta tras cambiar de sesión sin recargar | Media | Alto (privacidad) | `queryClient.clear()` en `useLogout` y al iniciar sesión; test AC-N002.1. |
| `date.fromisoformat` acepta formatos no `AAAA-MM-DD` (`20010101`, semanas ISO) | Alta si no se controla | Medio | Regex `^\d{4}-\d{2}-\d{2}$` antes de parsear; tests unitarios con esos casos. |
| Dos guardados simultáneos del primer perfil (doble clic o dos dispositivos) chocan con la PK | Baja | Medio (500) | `get_by_id_for_update` serializa por usuario; el botón se bloquea con `submitting`. |
| Diferencia de "hoy" entre el dispositivo y UTC en el día de un cumpleaños límite | Baja | Bajo | Aceptado por la spec (§6): el servidor rechaza y la app muestra el error genérico de guardado. |
| Todos los usuarios existentes vuelven a pasar por el onboarding tras el despliegue | Segura | Bajo | Comportamiento pedido por la spec (Q4); la fecha de la cuenta aparece prerrellenada. |
| La rama base es `chore/frontend-redesign`, no `main` | Media | Medio | La feature se integra sobre esa rama; el merge a `main` (y por tanto el despliegue) se hace cuando el rediseño completo esté listo. |

## 7. Cumplimiento de la constitución

- **Art. 4 (trazabilidad):** cada AC de la spec aparece en §5 con su archivo de test; los marcadores `SDD:` son obligatorios.
- **Art. 5.4:** unitarios con fakes escritos a mano e inyectados por constructor; el reloj se inyecta (`clock`), sin `monkeypatch` ni `unittest.mock`. Ningún test toca servicios externos.
- **Art. 5.5:** tests junto al archivo que prueban, `globals: false`, red simulada en `api.ts` con `vi.mock`.
- **Art. 6.1–6.3:** capas `routes → services → repositories → models`; solo `UnitOfWork` hace `commit`/`rollback`; `_build_profile_service()`; errores con `ValidationError`, `ResourceNotFoundError` y `AuthenticationError`.
- **Art. 6.4:** migración Alembic incluida y revisada a mano (§3.1).
- **Art. 6.5 / 6.10:** sin violaciones nuevas de ruff ni de oxlint; `tsc -b` limpio.
- **Art. 6.6–6.7:** `features/profile` completa `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`; todo HTTP por `apiFetch`. `mappers.ts` y `src/lib/age.ts` son módulos de apoyo, como ya lo son `units.ts` y `clamp.ts`.
- **Art. 6.8 (formularios con react-hook-form y zod) — desviación justificada:** el asistente del onboarding y `PhysicalDataForm` se construyeron en la fase de diseño con estado local (`useState`) y conversiones de unidad acopladas a ese estado. Esta feature solo sustituye su fuente de datos y el campo de edad; migrarlos a react-hook-form sería un refactor de UI ajeno al alcance que multiplicaría el riesgo de regresión en pantallas sin tests previos. Se cumple el objetivo del artículo en lo que toca a esta feature: el estado de servidor va por TanStack Query y la validación del payload y de la respuesta se hace con zod (`schemas.ts`). Se deja anotado como deuda para una feature posterior.
- **Art. 6.11:** textos nuevos en español, sin voseo, copiados de la sección 6 de la spec.
- **Art. 7.2:** ambos endpoints con `@require_auth`; `user_id` solo del token.
- **Art. 7.3:** validación en el servicio (`ValidationError`) y con zod en el frontend.
- **Art. 7.5:** solo ORM (`select`, `with_for_update`), sin SQL concatenado.
- **Art. 7.1:** no hay variables de entorno nuevas.

## 8. ADRs

- [ADR-0019](../../docs/sdd/decisions/ADR-0019-perfil-de-usuario.md) — Perfil de usuario en `user_profiles` (1:1, en la unidad del usuario), estado del onboarding en `users.onboarding_completed_at`, edad derivada de `users.date_of_birth`, y vaciado de la caché de TanStack Query al cambiar de sesión. (Propuesta)
