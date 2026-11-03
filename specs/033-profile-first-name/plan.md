# Plan 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Spec:** [spec.md](spec.md) (aprobada el 2026-11-02)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución

Cambio pequeño y transversal, sin migraciones ni variables nuevas, que reutiliza la regla del nombre de la spec 018 (`services/auth_input_rules.validate_first_name`):

- **Backend:** `AuthService.register` deja de recibir y validar `date_of_birth` (la cuenta se crea con `date_of_birth=None`). `ProfileService` valida `first_name` como primer campo del cuerpo **solo si la clave está presente** y lo guarda en `users.first_name` dentro de la misma transacción del perfil; la ruta lo serializa en `GET` y `PUT /api/profile`.
- **Frontend:** una única regla del nombre en `features/auth/schemas.ts` (`firstNameMessage` y `firstNameSchema`), usada por el registro y por el formulario del perfil. El registro pierde «Fecha de nacimiento». El formulario de `/profile` (`PhysicalDataForm`) gana el campo «Nombre» al principio y la sección pasa a «Datos personales». `/home` saluda con `homeGreeting(profile.first_name)`. El guardado del perfil ya escribe la respuesta del `PUT` en la caché de TanStack Query, así que `/home` ve el nombre nuevo sin recargar.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | services (auth) | — | `backend/services/auth_service.py` | `register(email, password, first_name, last_name)` sin fecha; `register_from_body` no la lee; se quita el import de `parse_date_of_birth` (REQ-001) |
| backend | services (perfil) | — | `backend/services/profile_service.py` | `_validate` valida `first_name` (si la clave está) antes que el resto; `save_profile` lo guarda en `user.first_name` (REQ-005, REQ-006) |
| backend | routes (perfil) | — | `backend/routes/profile_routes.py` | `_serialize` añade `"first_name": user.first_name` (REQ-004) |
| backend | tests | — | `backend/tests/test_routes/test_auth_routes.py`, `backend/tests/test_services/test_auth_service.py`, `backend/tests/test_routes/test_profile_routes.py`, `backend/tests/test_services/test_profile_service.py`, `backend/tests/test_routes/test_fixed_clock_routes.py` | Tests nuevos de la 033 y adaptación de los que la spec deja obsoletos (sección 5.3) |
| frontend | auth (esquemas) | — | `frontend/src/features/auth/schemas.ts` | Regla del nombre compartida (`firstNameMessage`, `firstNameSchema` y constantes); `registerSchema` sin `date_of_birth` y con `first_name: firstNameSchema` (REQ-002, REQ-008) |
| frontend | auth (tipos y formulario) | — | `frontend/src/features/auth/types.ts`, `frontend/src/features/auth/components/RegisterForm.tsx` | `RegisterPayload` sin `date_of_birth`; se quita el campo «Fecha de nacimiento» y su valor por defecto (REQ-002) |
| frontend | profile (tipos, esquemas, mapper, api) | — | `frontend/src/features/profile/types.ts`, `frontend/src/features/profile/schemas.ts`, `frontend/src/features/profile/mappers.ts` | `first_name` en la respuesta y opcional en el `PUT`; `firstName` en los valores del formulario y su validación; `payloadFromProfileForm` (REQ-004, REQ-007) |
| frontend | profile (UI) | — | `frontend/src/features/profile/components/PhysicalDataForm.tsx`, `frontend/src/features/profile/pages/ProfilePage.tsx` | Campo «Nombre» primero, guardado con el mismo botón; título «Datos personales» (REQ-007) |
| frontend | home | `frontend/src/features/home/greeting.ts` | `frontend/src/features/home/pages/HomePage.tsx` | Saludo con el nombre (REQ-009) |
| frontend | tests y utilidades de test | `frontend/src/features/home/greeting.test.ts` | `frontend/src/test/profileFixtures.ts`, `frontend/src/test/fakeMetricsServer.ts` y los tests listados en 5.3 | Tests de la 033 y adaptación de fixtures y aserciones afectadas |

`frontend/src/features/profile/api.ts`, `frontend/src/features/profile/hooks.ts`, `frontend/src/features/onboarding/**` y `frontend/src/app/OnboardingRoute.tsx` **no cambian**: el onboarding sigue enviando el `PUT` sin `first_name` (`payloadFromAnswers`) y ya muestra la fecha vacía cuando la cuenta no la tiene (`defaultValues: { ...EMPTY_ANSWERS, dateOfBirth: initialDateOfBirth ?? "" }`), así que REQ-003 solo necesita tests.

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. `users.first_name` ya existe (`String(250)`, nullable) y `users.date_of_birth` sigue siendo nullable (`backend/models/user.py`). No se toca ningún modelo, así que no hay migración (Art. P2.4). Los datos existentes no se modifican: las cuentas con fecha la conservan y un nombre antiguo de más de 100 caracteres se devuelve tal cual en `GET`.

### 3.2 Contratos e interfaces

**HTTP** (autorización sin cambios: `@require_auth` y `user_id` del token):

- `POST /api/auth/register`: usa `email`, `password`, `first_name` y `last_name`; cualquier `date_of_birth` del cuerpo se ignora sin validarlo. Orden de validación: correo, contraseña, nombre, apellido y correo duplicado. Respuesta 201 `{"token": …}` sin cambios. Desaparecen los 400 de fecha de nacimiento de este endpoint.
- `GET /api/profile`: añade `first_name: string | null` (valor guardado tal cual, sin recortar).
- `PUT /api/profile`: clave opcional `first_name`.
  - Clave ausente: el nombre no se toca.
  - Clave presente (aunque valga `null`): `validate_first_name`. Errores 400 `{"error": "El nombre es obligatorio"}` (no es texto o queda vacío al recortar) y `{"error": "El nombre no puede superar los 100 caracteres"}`.
  - Orden: cuerpo no objeto («Los datos del perfil no son válidos») → **nombre** → fecha de nacimiento → resto (sin cambios).
  - La respuesta 200 incluye `first_name` como en `GET`.

**Backend: firmas** (no hay símbolos nuevos; cambia una firma):

```python
# backend/services/auth_service.py
class AuthService:
    def register_from_body(self, body: object) -> str: ...      # sin cambios de firma; ya no lee date_of_birth
    def register(self, email, password, first_name, last_name): ...  # SE QUITA el parámetro date_of_birth

# backend/services/profile_service.py
def _validate(data, today) -> dict: ...  # el dict devuelto lleva "first_name" solo si la clave venía en `data`
class ProfileService:
    def save_profile(self, user_id, data): ...  # firma sin cambios
```

**Frontend: símbolos nuevos o cambiados** (los importarán los tests):

```ts
// frontend/src/features/auth/schemas.ts
export const MAX_FIRST_NAME_CHARS = 100
export const FIRST_NAME_REQUIRED_MESSAGE = "El nombre es obligatorio"
export const FIRST_NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres"
// null si el nombre es válido; si no, el mensaje. Recorta los extremos y cuenta
// caracteres (puntos de código, Array.from), no unidades UTF-16.
export function firstNameMessage(value: string): string | null
// z.string() que recorta y añade el issue de firstNameMessage; su salida es el nombre recortado.
export const firstNameSchema: z.ZodType<string, string>
// registerSchema: { email, password, first_name: firstNameSchema, last_name: z.string().min(1, "Campo obligatorio") }
// (sin date_of_birth). RegisterFormValues se deriva de él.

// frontend/src/features/auth/types.ts
export type RegisterPayload = { email: string; password: string; first_name: string; last_name: string }

// frontend/src/features/home/greeting.ts
// "Hola de nuevo, {nombre recortado}" o "Hola de nuevo" si es null, undefined o solo espacios.
export function homeGreeting(firstName: string | null | undefined): string

// frontend/src/features/profile/types.ts
export type PhysicalDataFormValues = OnboardingAnswers & BodyComposition & { firstName: string }
export type ProfileResponse = {
  onboarding_completed: boolean
  onboarding_completed_at: string | null
  date_of_birth: string | null
  first_name: string | null
  profile: ServerProfile | null
}
export type SaveProfilePayload = { date_of_birth: string; first_name?: string } & ServerProfile

// frontend/src/features/profile/schemas.ts
export type ProfileFormErrorKey = PhysicalDataErrorKey | "fat" | "muscle" | "firstName"
// makeProfileFormSchema(today?): misma firma; añade firstName al objeto y su issue (path ["firstName"]).
// profileResponseSchema: añade first_name: z.string().nullable().default(null)
// saveProfilePayloadSchema (.strict()): añade first_name: z.string().optional()

// frontend/src/features/profile/mappers.ts
// Cuerpo del PUT desde el formulario del perfil: payloadFromAnswers(values) + first_name recortado.
export function payloadFromProfileForm(values: PhysicalDataFormValues): SaveProfilePayload

// frontend/src/features/profile/components/PhysicalDataForm.tsx
export function PhysicalDataForm(props: {
  initial: OnboardingAnswers
  initialBody: BodyComposition
  initialFirstName: string
}): JSX.Element
```

**Esqueletos (Art. B5.6, P1):**
- `firstNameMessage`, `homeGreeting` y `payloadFromProfileForm`: cuerpo `throw new Error("not implemented")` con parámetros `_value`, `_firstName` y `_values`.
- `firstNameSchema` se declara como `z.string().superRefine((value, ctx) => { const message = firstNameMessage(value); … })`, que delega en `firstNameMessage`. Así el esqueleto falla al validar, no al importar el módulo.
- Las constantes se crean con su valor definitivo, porque no tienen lógica.
- En el backend no hay símbolos nuevos, así que no hacen falta esqueletos.

### 3.3 Lógica

**Backend**
- `AuthService.register` (`services/auth_service.py`):
  - se quitan `parse_date_of_birth` y el parámetro `date_of_birth`;
  - `User(...)` se construye sin `date_of_birth`, que por defecto es `None`;
  - el comentario del orden de validación pasa a «correo, contraseña, nombre, apellido y, al final, duplicado»;
  - `register_from_body` deja de pasar `data.get("date_of_birth")`.
  - Dependencias sin cambios: `user_repository`, `unit_of_work`, `jwt_manager` y `clock`. El reloj se mantiene, porque lo usa el constructor y lo inyectan los tests y la ruta.
- `_validate` (`services/profile_service.py`), justo después de comprobar que `data` es un dict:
  ```
  has_first_name = "first_name" in data
  if has_first_name: first_name = validate_first_name(data["first_name"])
  ```
  Si la clave estaba, el dict devuelto incluye `"first_name": first_name`. Se reutiliza `validate_first_name` de `services/auth_input_rules.py` (misma regla, mismos mensajes y `MAX_NAME_CHARS`); no se duplica.
- `ProfileService.save_profile`:
  - la validación sigue ocurriendo antes de abrir la transacción, así que un 400 no modifica nada (AC-006.1, AC-006.2);
  - dentro del `try`, tras `user.date_of_birth = cleaned.pop("date_of_birth")`, añade `if "first_name" in cleaned: user.first_name = cleaned.pop("first_name")`. Debe ir antes del bucle `setattr(profile, …)`, para no escribir `first_name` en `UserProfile`;
  - el commit sigue siendo uno solo, el de `UnitOfWork`. Dependencias sin cambios.
- `profile_routes._serialize`: añade `"first_name": user.first_name`. La ruta sigue sin lógica.

**Frontend**
- **Regla del nombre** (`features/auth/schemas.ts`): `firstNameMessage(value)` hace `const trimmed = value.trim()`.
  - Si `trimmed === ""`, devuelve `FIRST_NAME_REQUIRED_MESSAGE`.
  - Si `Array.from(trimmed).length > MAX_FIRST_NAME_CHARS`, devuelve `FIRST_NAME_TOO_LONG_MESSAGE`.
  - Si no, devuelve `null`.
  - `firstNameSchema = z.string().trim().superRefine(…)` añade un issue `custom` con ese mensaje.
  - Se cuentan caracteres igual que `len()` en Python y que `newPasswordSchema` (AC-008.4).
- **Registro:**
  - `registerSchema.first_name = firstNameSchema`; `last_name` sigue con `"Campo obligatorio"` (AC-008.6). La salida de zod lleva el nombre recortado.
  - `RegisterForm` quita el `FormField` de la fecha y `date_of_birth` de `defaultValues`. `onSubmit` sigue enviando `values`, que ya no contienen la clave (AC-002.2).
- **Perfil:**
  - `makeProfileFormSchema` añade `firstName: z.string()` al objeto y, dentro del `superRefine`, `firstNameMessage(values.firstName)` con `path: ["firstName"]`. Va en el `superRefine` y no como validador del campo, para que un nombre no válido no impida calcular los demás mensajes. Es el mismo patrón que la fecha de nacimiento.
  - `fieldMessages` lo expone como `errors.firstName`, que entra en `allValid` y desactiva «Guardar cambios» (AC-007.5, AC-007.6).
- **`PhysicalDataForm`:**
  - `defaultValues = { ...initial, ...initialBody, firstName: initialFirstName }`. `saved`, `dirty` y «Descartar» (`form.reset(saved)`) cubren el nombre sin más cambios (AC-007.7).
  - `measurementChanged` no depende del nombre, así que cambiar solo el nombre no registra ninguna medición (AC-007.3).
  - En `onSave`, primero se normaliza `values = { ...values, firstName: values.firstName.trim() }` (así `saved` y el campo quedan sin espacios) y se envía `saveProfile.mutateAsync(payloadFromProfileForm(values))`.
- **`payloadFromProfileForm`:** `{ ...payloadFromAnswers(values), first_name: values.firstName.trim() }` (AC-007.4). El onboarding sigue usando `payloadFromAnswers`, sin `first_name` (AC-005.2).
- **`profileResponseSchema`:** `first_name: z.string().nullable().default(null)`. Un backend todavía sin desplegar, que no envía la clave, no rompe el `parse` (riesgo de despliegue, sección 6).
- **`ProfilePage`:** pasa `initialFirstName={profile.first_name ?? ""}` y cambia el título de la sección a «Datos personales». La descripción no cambia (AC-007.8).
- **`homeGreeting`:** `const name = firstName?.trim()`; devuelve `name ? \`Hola de nuevo, ${name}\` : "Hola de nuevo"`. `HomePage` pinta `<h1>{homeGreeting(profile?.first_name)}</h1>`.
- **Caché:** `useSaveProfile` ya hace `setQueryData(profileKeys.detail, data)` con la respuesta del `PUT`, que incluye `first_name`. Por eso `/home` muestra el nombre nuevo sin recargar (AC-009.4), sin tocar `hooks.ts`.

### 3.4 Interfaz de usuario

- **Registro (`RegisterForm`):**
  - campos «Nombre» y «Apellido» (fila de dos columnas), «Email» y «Password»;
  - sin «Fecha de nacimiento»;
  - bajo «Nombre» aparecen «El nombre es obligatorio» o «El nombre no puede superar los 100 caracteres» (`FormMessage`); bajo «Apellido», «Campo obligatorio».
- **Perfil (`/profile`):**
  - la sección se titula «Datos personales», con la descripción actual;
  - el primer elemento de la rejilla es `<Field label="Nombre" htmlFor="profile-first-name" error={errors.firstName}>`, con un `<Input id="profile-first-name" type="text" value={draft.firstName} onChange={(e) => update({ firstName: e.target.value })} aria-invalid={!!errors.firstName || undefined} />`, delante de «Género»;
  - es un `textbox`, no un `spinbutton` ni un `combobox`, para no desplazar los índices que usan los tests existentes;
  - el aviso se muestra en cuanto el valor no es válido (también al cargar con `first_name: null`, AC-007.2), igual que el resto de campos del formulario;
  - «Guardar cambios», «Descartar», «Cambios guardados» y los errores no cambian.
- **Home (`/home`):** `h1` con `homeGreeting(...)`. El resto no cambia.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `AuthService.register` / `register_from_body` sin fecha (`backend/services/auth_service.py`) |
| REQ-002 | `registerSchema` y `RegisterPayload` sin `date_of_birth`; `RegisterForm` sin el campo |
| REQ-003 | Sin cambios de código: `OnboardingPage` (`defaultValues` con `initialDateOfBirth ?? ""`) y `makePhysicalDataSchema` (`DOB_REQUIRED_MESSAGE`); solo tests |
| REQ-004 | `profile_routes._serialize` (`first_name`); `ProfileResponse` y `profileResponseSchema` en el frontend |
| REQ-005 | `_validate` (clave presente → `validate_first_name`) y `ProfileService.save_profile` (`user.first_name`) |
| REQ-006 | `_validate`: nombre validado primero, antes de abrir la transacción; mensajes de `auth_input_rules` |
| REQ-007 | `PhysicalDataForm` (campo, `firstName` en el estado, `payloadFromProfileForm`), `makeProfileFormSchema`, `ProfilePage` (título e `initialFirstName`) |
| REQ-008 | `firstNameMessage` y `firstNameSchema` en `features/auth/schemas.ts`, usados por `registerSchema` y `makeProfileFormSchema` |
| REQ-009 | `homeGreeting` (`features/home/greeting.ts`) en `HomePage`; caché escrita por `useSaveProfile` |
| NFR | La spec no define NFR. Seguridad sin cambios: `GET`/`PUT /api/profile` con `@require_auth` y `user_id` del token |

## 5. Estrategia de pruebas

Marcadores con el número de spec: `# SDD: 033 REQ-00X AC-00X.Y` / `// SDD: 033 …` (Art. P1.1).

### 5.1 backend

Entorno: Postgres de prueba (`TEST_DATABASE_URL`). Sin servicios externos ni dobles nuevos.

| AC | Tipo | Archivo | Cómo |
|---|---|---|---|
| AC-001.1, AC-001.2, AC-001.3, AC-001.4 | integración | `tests/test_routes/test_auth_routes.py` | `POST /api/auth/register` sin fecha, con `"1995-05-20"` y con `"2001-02-30"`, `"abc"`, `123`, `null` y mañana (`app_clock.set(...)`) → 201 y `GET /api/profile` con `date_of_birth: null` y `onboarding_completed: false`. Sin fecha ni nombre → 400 «El nombre es obligatorio» y `count_users == 0` |
| AC-001.1–AC-001.3 (unitario) | unitario | `tests/test_services/test_auth_service.py` | `register(...)` con 4 argumentos y `register_from_body({...,"date_of_birth": "abc"})` → `repo.created[0].date_of_birth is None` (fakes existentes) |
| AC-004.1, AC-004.2, AC-004.3 | integración | `tests/test_routes/test_profile_routes.py` | `registered_user` (nombre «Test») o `create_user(...)` con `first_name="Ana"` / sin nombre → `GET` con `first_name`; `PUT` válido → respuesta con `first_name` |
| AC-005.1–AC-005.4 | integración | `tests/test_routes/test_profile_routes.py` | `PUT` con `"  María José "`, sin la clave (usuario con «Ana» y usuario sin nombre) y con 100 caracteres rodeados de espacios; comprobar la respuesta y el `GET` posterior |
| AC-006.1–AC-006.4 | integración | `tests/test_routes/test_profile_routes.py` | Usuario con nombre «Ana» y perfil guardado. `PUT` con `""`, `"   "`, `None`, `123` (parametrizado), 101 y 300 caracteres, y nombre no válido junto con un peso fuera de rango → 400 con el mensaje exacto. Un `GET` posterior devuelve el nombre y el `profile` anteriores |
| AC-005.x / AC-006.x (unitario) | unitario | `tests/test_services/test_profile_service.py` | `ProfileService` con los fakes del propio archivo (`make_user` amplía `SimpleNamespace` con `first_name`). Comprobar la clave ausente (no cambia), la presente (recortada), el orden (el nombre antes que la fecha) y que con un 400 no hay commit (`FakeUnitOfWork`) |

Aislamiento (P1): solo fakes escritos a mano (`tests/fakes.py` y los `Fake*` de cada archivo), sin `unittest.mock` ni `monkeypatch`. El reloj fijo usa el fixture `app_clock` existente.

### 5.2 frontend

Red simulada en `api.ts` de cada feature (`vi.mock("@/features/auth/api")`, `vi.mock("@/features/profile/api")`, `vi.mock("@/features/body-metrics/api")`), como en los tests existentes. Sin dobles nuevos.

| AC | Tipo | Archivo | Cómo |
|---|---|---|---|
| AC-008.1–AC-008.4 | unitario | `src/features/auth/schemas.test.ts` | `firstNameSchema.safeParse` / `firstNameMessage` con «  Ana  », `""`, `"   "`, 100 caracteres con espacios, 101 caracteres, 100 y 101 emojis (`"😀".repeat(n)`) |
| AC-002.1, AC-002.2, AC-008.5, AC-008.6 | componente | `src/features/auth/components/RegisterForm.test.tsx` | `queryByLabelText("Fecha de nacimiento")` es null; tras enviar, `registerMock.mock.calls[0][0]` tiene las 4 claves y `not.toHaveProperty("date_of_birth")`; nombre «   » o de 101 caracteres → mensaje bajo «Nombre» y sin llamada; nombre y apellido vacíos → los dos mensajes |
| AC-003.1 | página | `src/features/onboarding/pages/OnboardingPage.test.tsx` (o `src/app/OnboardingRoute.test.tsx` con `makePendingResponse(null)`) | Fecha vacía y el paso no avanza sin una fecha válida |
| AC-007.1–AC-007.8 | página | `src/features/profile/pages/ProfilePage.test.tsx` | `getProfile` con `first_name` «Ana» o `null`. Comprobar el valor del campo «Nombre», el aviso, el botón desactivado, que el `PUT` lleva `first_name: "Beatriz"` (también desde «  Beatriz  ») sin `createBodyMetric`, «Descartar», el `h2` «Datos personales» sin «Datos físicos» y que «Nombre» va antes que «Género» (orden en el DOM) |
| AC-007.4 (unitario) | unitario | `src/features/profile/mappers.test.ts` | `payloadFromProfileForm` recorta `first_name` y conserva el resto de `payloadFromAnswers` |
| AC-004.x (cliente) | unitario | `src/features/profile/schemas.test.ts` | `profileResponseSchema.parse` conserva `first_name` y lo pone a `null` si falta; `saveProfilePayloadSchema` acepta `first_name` opcional; `makeProfileFormSchema` da `firstName` como error con nombre vacío o de 101 caracteres |
| AC-009.1–AC-009.3 | unitario y página | `src/features/home/greeting.test.ts` (nuevo) y `src/features/home/pages/HomePage.test.tsx` | `homeGreeting("Ana")`, `homeGreeting(null)` y `homeGreeting("   ")`; `heading` de nivel 1 con el nombre exacto |
| AC-009.4 | integración de pantallas | `src/features/home/pages/HomePage.test.tsx` (o `src/app/router.test.tsx`) | Un mismo `QueryClient`: se renderiza `ProfilePage`, se guarda «Beatriz» (`saveProfile` mock que devuelve `first_name: "Beatriz"`; `getProfile` sigue devolviendo «Ana») y después se renderiza `HomePage` con el mismo cliente → «Hola de nuevo, Beatriz» sin otra llamada a `getProfile` |

### 5.3 Tests y utilidades existentes afectados por el cambio de contrato

La spec aprobada cambia comportamientos que hoy afirman tests de las specs 006, 018 y 020. Los adapta el `test-author` en la etapa de tests. No se debilita la cobertura: cada caso pasa a afirmar el comportamiento nuevo o se sustituye por su equivalente de la 033.

- **Backend:**
  - `test_auth_routes.py`:
    - los tests `018 REQ-005` (AC-005.1–005.8), `018 AC-006.4` y `018 AC-006.5` afirman 400 o la fecha guardada: se sustituyen por los de AC-001.1–AC-001.4;
    - `register_payload` deja de incluir `date_of_birth` y `REGISTER_FIELD_ERRORS` pierde su entrada, porque la batería `anomalous_requests` recorre los campos del cuerpo válido.
  - `test_auth_service.py`:
    - el helper `register(...)` pasa a 4 argumentos;
    - los tests de fecha (líneas ~343–411, 495 y 505) se sustituyen por «ignora la fecha»;
    - el de la línea 485 conserva su intención sin la fecha.
  - `test_fixed_clock_routes.py`: los dos tests `020 REQ-005 AC-005.4` de edad en el registro pasan a afirmar que la fecha se ignora (201 en los dos casos y `date_of_birth: null`), o se retiran si quedan cubiertos por AC-001.3.
  - `test_profile_routes.py`:
    - `NO_PROFILE` añade `"first_name": None`;
    - `REQ-001 AC-001.4` (fecha de registro visible en el perfil) pasa a afirmar `null`;
    - `REQ-002 AC-002.7` toma la fecha inicial de una cuenta creada con `create_user(..., date_of_birth=…)`, no del registro.
  - `conftest.registered_user` puede seguir enviando la fecha (se ignora). El `test-author` debe ejecutar la suite completa y adaptar cualquier otro test que dependa de que el registro guarde la fecha.
- **Frontend:**
  - `src/test/profileFixtures.ts`: `makeProfileResponse` añade `first_name: "Ana"` por defecto (así los formularios de perfil existentes siguen siendo válidos) y `makePendingResponse`, `first_name: null`;
  - `src/test/fakeMetricsServer.ts`: `saveProfile` conserva `first_name` (lo actualiza si llega en el payload) y no lo mete en `profile`;
  - `src/app/router.test.tsx`, `src/app/diaryRoute.test.tsx` y `src/app/lazyRoutes.test.tsx`: el `h1` pasa de «Hola de nuevo» a «Hola de nuevo, Ana» (comportamiento de AC-009.1 con el fixture);
  - `RegisterForm.test.tsx`: los helpers `fillAndSubmit*` dejan de rellenar «Fecha de nacimiento»;
  - `src/features/profile/schemas.test.ts`: los valores válidos añaden `firstName`;
  - los tests de `ProfilePage` y `PhysicalDataForm.refresh*` que comparan el payload del `PUT` con `toEqual` exacto añaden `first_name`.

### 5.4 Comandos

- backend: `".venv/Scripts/python.exe" -m pytest -q` y el ratchet de ruff.
- frontend: `npm test`, `npm run lint`, `npx tsc -b` y `npm run build`.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Despliegue desacompasado: Vercel publica el frontend antes de que el CD del backend termine y `GET /api/profile` aún no trae `first_name` | Media | Alto si el `parse` fallara (el guard del onboarding no cargaría) | `profileResponseSchema` con `first_name: z.string().nullable().default(null)`: sin la clave, saludo sin nombre y campo vacío. Un backend antiguo ignora `first_name` en el `PUT` y no rompe nada |
| Tests existentes que dependen de que el registro guarde la fecha (fixture `registered_user` y otros) fallan por motivos ajenos a la 033 | Media | Medio | Lista de 5.3; el `test-author` ejecuta la suite completa de los dos ámbitos y adapta cada caso al contrato nuevo, sin `skip` |
| Una cuenta sin nombre (Google) no puede guardar cambios físicos en `/profile` hasta escribir uno | Alta para esas cuentas | Bajo | Es lo que pide la spec (AC-007.2): el aviso bajo «Nombre» explica el motivo. El onboarding no se ve afectado (no envía `first_name`) |
| Diferencias mínimas entre `str.strip()` de Python y `String.prototype.trim()` de JS en espacios Unicode raros (p. ej. U+0085, U+FEFF) | Baja | Bajo | Manda el servidor: un caso raro acaba en un 400 con el mismo mensaje, que el formulario muestra como error de guardado. Se anota en el backlog |

## 7. Cumplimiento de la constitución

- **B1:** la spec está aprobada (`approvals.spec`) y el cambio pasa por todo el flujo.
- **B4:** todos los REQ están mapeados (sección 4) y cada AC tiene un test previsto en 5.1 y 5.2, con el marcador `SDD: 033 …`.
- **B5.1/B5.2:** los tests se escriben antes de implementar. Los símbolos nuevos tienen esqueletos según 3.2. El rojo legítimo del backend llega por comportamiento: por ejemplo, `GET` sin `first_name`, o el registro con una fecha no válida que hoy da 400.
- **B5.3:** la adaptación de tests de 5.3 no debilita la cobertura. Esos tests afirman un contrato que la spec aprobada sustituye de forma explícita (sección 6 de la spec, «Desaparecen de este endpoint los errores de fecha de nacimiento»), y cada uno se reemplaza por su equivalente del contrato nuevo. No se usan `skip`, `xfail` ni `.only`.
- **B5.4 / P1.4:** no se llama a servicios externos.
- **P1 backend:** solo fakes escritos a mano, sin `unittest.mock` ni `monkeypatch`.
- **P1 frontend:** la red se simula en `api.ts`, con `globals: false` y nombres de test en español.
- **P2 backend:**
  - capas respetadas: la ruta solo serializa y la lógica vive en el servicio;
  - un solo `commit`, el de `UnitOfWork`;
  - errores con `ValidationError`;
  - se reutiliza `validate_first_name` (P2.5);
  - sin cambios de modelo, así que sin migración (P2.4).
- **P2 frontend:**
  - organización por feature, con los esquemas en `schemas.ts`;
  - HTTP solo por `apiFetch`, sin cambios en `api.ts`;
  - TanStack Query y react-hook-form con zod.
  - La regla del nombre vive en `features/auth/schemas.ts` y la importa `features/profile/schemas.ts`. El perfil ya importa esquemas de otra feature (`onboarding/schemas.ts`), así que se sigue el patrón existente.
- **P2 general:** los textos van en español correcto.
- **P3:** no hay endpoints nuevos. `PUT /api/profile` valida `first_name` en el servicio (`ValidationError`) y con zod en el frontend. El usuario sale siempre del token y no se construye SQL a mano.
- **P4:** no hay migración ni pasos manuales en producción. El `doc-keeper` debe actualizar `CLAUDE.md` y `README.md`, que describen la validación de la fecha de nacimiento en el registro (spec 018).
- **DEBERÍA no cumplidos:** ninguno.

## 8. ADRs

Ninguna. No hay decisiones de arquitectura nuevas: se reutilizan la regla del nombre de la spec 018 y el modelo de perfil de la ADR-0019. La edad se sigue calculando desde `users.date_of_birth`, que solo deja de rellenarse en el registro.
