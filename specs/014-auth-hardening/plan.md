# Plan 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-16)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución
- **Backend:** un módulo nuevo de reglas de credenciales (`services/credential_rules.py`) concentra la normalización del correo, su formato y las reglas de contraseña que hoy viven solo en `PasswordResetService`. `AuthService` y `PasswordResetService` lo usan; `UserRepository.get_by_email` pasa a comparar sin distinguir mayúsculas.
- **Uso único del enlace:** `PasswordResetRepository.get_by_token_hash` lee la fila con `SELECT … FOR UPDATE`, así que la segunda petición simultánea espera y ve el enlace ya usado (ADR-0025).
- **Datos:** una migración Alembic solo de datos pasa los correos a minúsculas y falla sin escribir nada si hay conflictos.
- **Log de Resend:** `ResendTransport._error_snippet` escapa los caracteres de control después de quitar la API key y recortar.
- **Frontend:** el formulario de registro reutiliza el esquema de contraseña del restablecimiento (`newPasswordSchema`), y `LoginForm` muestra el aviso desde un estado local capturado al montar y limpia `location.state` con un `navigate(…, { replace: true })`.

Todo respeta las capas `routes → services → repositories → models` (Art. P2): las rutas no cambian salvo que siguen pasando los valores crudos al servicio.

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | services | `backend/services/credential_rules.py` | — | Normalización y validación de correo y contraseña compartidas (REQ-001…007, REQ-009) |
| backend | services | — | `backend/services/auth_service.py` | Correo normalizado en registro, login y Google; validación en el registro; login robusto; verificador de Google inyectable (REQ-001, 002, 004, 005, 006, 007, 009) |
| backend | services | — | `backend/services/password_reset_service.py` | Usa `credential_rules`; correo normalizado en `request_reset`; `reset_password` con la lectura bloqueante dentro del `try` (REQ-003, REQ-010) |
| backend | repositories | — | `backend/repositories/user_repository.py` | `get_by_email` sin distinguir mayúsculas (REQ-001…005) |
| backend | repositories | — | `backend/repositories/password_reset_repository.py` | `get_by_token_hash` con `FOR UPDATE` (REQ-010) |
| backend | utils | — | `backend/utils/email_sender.py` | `escape_log_text` y su uso en `_error_snippet` (REQ-012) |
| backend | migrations | `backend/migrations/versions/a7d3f9c1e5b2_lowercase_user_emails.py` | — | Correos existentes a minúsculas, con fallo ante conflictos (REQ-005) |
| backend | routes | — | ninguno | `routes/auth_routes.py` ya pasa `data.get(...)` crudo al servicio; no cambia |
| backend | tests | `backend/tests/test_services/test_credential_rules.py`, `backend/tests/test_services/test_auth_service.py`, `backend/tests/test_services/test_lowercase_emails_migration.py` | `backend/tests/test_routes/test_auth_routes.py`, `backend/tests/test_routes/test_password_reset_routes.py`, `backend/tests/test_services/test_password_reset_service.py`, `backend/tests/test_services/test_email_sender.py` | Cobertura de los AC (lo escribe el `test-author`) |
| frontend | auth / schemas | — | `frontend/src/features/auth/schemas.ts` | `newPasswordSchema` compartido por registro y restablecimiento (REQ-008) |
| frontend | auth / hooks | — | `frontend/src/features/auth/hooks.ts` | `usePasswordResetNotice` (REQ-011) |
| frontend | auth / components | — | `frontend/src/features/auth/components/LoginForm.tsx` | Usa `usePasswordResetNotice` (REQ-011) |
| frontend | tests | `frontend/src/features/auth/components/RegisterForm.test.tsx` | `frontend/src/features/auth/components/LoginForm.test.tsx` | Cobertura de los AC |
| docs | ADR | `docs/sdd/decisions/ADR-0025-correo-canonico-en-minusculas.md` | `docs/sdd/decisions/README.md` | Decisión nueva |

`RegisterForm.tsx` no cambia: ya muestra `error.message` de `ApiError` (AC-008.6) y toma las reglas de `registerSchema`.

## 3. Diseño
### 3.1 Datos y migraciones
- **Sin cambios de esquema.** El modelo `User` no cambia; no se añade índice funcional (ADR-0025, opción 3 descartada).
- **Migración de datos** `backend/migrations/versions/a7d3f9c1e5b2_lowercase_user_emails.py`:
  - `revision = 'a7d3f9c1e5b2'`, `down_revision = 'f2c4e6a8b0d1'`.
  - `upgrade()`, con `bind = op.get_bind()` y SQL estático con `sqlalchemy.text` (sin concatenar valores, Art. P3.4):
    1. Conflictos: `SELECT lower(email) AS canonical, array_agg(email ORDER BY email) AS emails FROM public.users GROUP BY lower(email) HAVING count(*) > 1 ORDER BY canonical`.
    2. Si hay filas, `raise RuntimeError("Hay cuentas cuyos correos solo se diferencian en mayúsculas; resuélvelas a mano antes de migrar: " + "; ".join(", ".join(emails) por grupo))`. El texto lo arma Python con los resultados, no se reinyecta en SQL. Nada se ha escrito todavía, y Alembic corre la migración dentro de una transacción (`migrations/env.py`, `context.begin_transaction()`).
    3. Sin conflictos: `UPDATE public.users SET email = lower(email) WHERE email <> lower(email)`.
  - `downgrade()`: no hace nada; docstring: "No se puede deshacer: las mayúsculas originales solo se recuperan desde el volcado previo."
  - No modifica `password_reset_requests` (las filas antiguas solo afectan al límite de 2 minutos y caducan solas).
  - No se recortan espacios de correos guardados (la spec solo pide minúsculas); va al backlog.
- **Paso manual en producción** (Art. P4, lo documenta el `doc-keeper` en `docs/deploy-runbook.md` o en `docs-report.md`): volcado completo de la base en `C:/Users/alber/fitnerd-backups` antes del despliegue y, tras el CD, `docker compose -f docker-compose.prod.yml exec backend flask db upgrade`. Si falla por conflictos, resolverlos a mano y repetir.

### 3.2 Contratos e interfaces
**API HTTP:** las rutas y los formatos de respuesta no cambian. Cambian los códigos y mensajes de la tabla de la spec (sección 6): `POST /api/auth/register` añade `400` "Email inválido", "La contraseña debe tener al menos 8 caracteres" y "La contraseña es demasiado larga"; `POST /api/auth/login` responde `401` "Wrong Credentials" en lugar de `5xx` ante datos anómalos; `POST /api/auth/reset-password` responde `400` de enlace no válido a la petición simultánea perdedora. Autorización sin cambios (rutas públicas salvo `/me`).

**Símbolos nuevos o cambiados (backend)** — esqueletos con `raise NotImplementedError("not implemented")` (Art. P1.5):

```python
# backend/services/credential_rules.py
"""Reglas de correo y contraseña compartidas por el registro, el login y el restablecimiento."""
import re

INVALID_EMAIL_MESSAGE = "Email inválido"
PASSWORD_TOO_SHORT_MESSAGE = "La contraseña debe tener al menos 8 caracteres"
PASSWORD_TOO_LONG_MESSAGE = "La contraseña es demasiado larga"
MIN_PASSWORD_CHARS = 8
MAX_PASSWORD_BYTES = 72
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def normalize_email(email: str) -> str: ...
    # email.strip().lower()

def validate_email(email: object) -> str: ...
    # ValidationError(INVALID_EMAIL_MESSAGE) si no es str o no cumple EMAIL_PATTERN tras strip();
    # devuelve normalize_email(email)

def validate_new_password(password: object) -> str: ...
    # ValidationError(PASSWORD_TOO_SHORT_MESSAGE) si no es str o len(password) < 8 (puntos de código);
    # ValidationError(PASSWORD_TOO_LONG_MESSAGE) si len(password.encode("utf-8")) > 72;
    # devuelve la contraseña sin recortar

def exceeds_bcrypt_limit(password: str) -> bool: ...
    # len(password.encode("utf-8")) > MAX_PASSWORD_BYTES
```
Las constantes son valores, no lógica: el esqueleto ya las define con su valor final.

```python
# backend/services/auth_service.py
def verify_google_id_token(id_token_str: str, client_id: str | None) -> dict: ...
    # envoltorio de google_id_token.verify_oauth2_token(id_token_str, google_requests.Request(), client_id);
    # lanza ValueError si el token no es válido (comportamiento actual)

class AuthService:
    def __init__(self, user_repository, unit_of_work, jwt_manager, google_client_id: str | None = None,
                 google_token_verifier=verify_google_id_token): ...
        # guarda las dependencias sin lanzar; google_token_verifier(id_token_str, client_id) -> dict de claims
    def register(self, email, password, first_name, last_name, date_of_birth) -> str: ...   # firma sin cambios
    def login(self, email, password) -> str: ...                                           # firma sin cambios
    def login_with_google(self, id_token_str) -> str: ...                                  # firma sin cambios
    def get_me(self, user_id): ...                                                          # sin cambios
```

```python
# backend/services/password_reset_service.py
# Importa de credential_rules: INVALID_EMAIL_MESSAGE, PASSWORD_TOO_SHORT_MESSAGE, PASSWORD_TOO_LONG_MESSAGE,
# MIN_PASSWORD_CHARS, MAX_PASSWORD_BYTES, EMAIL_PATTERN, validate_email, validate_new_password.
# Siguen siendo atributos del módulo (las rutas y los tests existentes los importan desde aquí).
# Firmas de PasswordResetService sin cambios.
```

```python
# backend/repositories/user_repository.py
def get_by_email(self, email: str): ...
    # select(User).where(func.lower(User.email) == email.lower()).order_by(User.created_at, User.id); .first()

# backend/repositories/password_reset_repository.py
def get_by_token_hash(self, token_hash: str): ...
    # misma consulta + .with_for_update(); comentario: bloquea la fila hasta el commit o el rollback
```

```python
# backend/utils/email_sender.py
def escape_log_text(text: str) -> str: ...
    # "\n" -> "\\n", "\r" -> "\\r", "\t" -> "\\t";
    # resto de U+0000–U+001F y U+007F–U+009F -> "\\x" + 2 dígitos hex en minúscula (p. ej. "\\x1b", "\\x85");
    # U+2028 y U+2029 -> "\\u2028", "\\u2029";
    # todo lo demás (letras con tilde, "ñ", "\\") tal cual
```

**Símbolos nuevos o cambiados (frontend)** — esqueletos con `throw new Error("not implemented");` (Art. P1.5):

```ts
// frontend/src/features/auth/schemas.ts
// Mínimo 8 puntos de código y máximo 72 bytes UTF-8, igual que el backend.
export const newPasswordSchema: z.ZodType<string>  // z.string().refine(Array.from(v).length >= 8, "Mínimo 8 caracteres")
                                                    //          .refine(TextEncoder bytes <= 72, "Contraseña demasiado larga")
// registerSchema.password = newPasswordSchema; resetPasswordSchema.password = newPasswordSchema

// frontend/src/features/auth/hooks.ts
export function usePasswordResetNotice(): boolean
```
`newPasswordSchema` es una constante: el `implementer` puede crearla ya con su definición final si así lo indica `tasks.md`; los tests la ejercitan a través de `RegisterForm`.

### 3.3 Lógica
**`credential_rules`** (funciones puras, sin dependencias): ver 3.2. `validate_email` comprueba el patrón sobre `email.strip()` (igual que hoy `request_reset`) y devuelve la forma normalizada.

**`AuthService.register`** (dependencias por constructor: `user_repository`, `unit_of_work`, `jwt_manager`; Art. P2.2). Orden de la spec:
1. `email = validate_email(email)` → `400` "Email inválido" (AC-007.x).
2. `validate_new_password(password)` → `400` de longitud (AC-006.x).
3. `user_repository.get_by_email(email)` → `ConflictError("Email already registered")` (AC-001.2, AC-005.2).
4. Hash bcrypt y `User(email=email, …)` con el correo normalizado; commit.
Los pasos 1 y 2 van antes del `try` (no hay nada que deshacer); el resto sigue dentro del `try` con `rollback`.

**`AuthService.login`:**
1. Si `email` o `password` no son `str`, o `exceeds_bcrypt_limit(password)` → `AuthenticationError("Wrong Credentials")` sin consultar la base (AC-009.x). No se aplica el mínimo de 8.
2. `user_repository.get_by_email(normalize_email(email))`; el resto, igual que hoy.

**`AuthService.login_with_google`:** `claims = self.google_token_verifier(id_token_str, self.google_client_id)` (mismo `except ValueError` → "Invalid Google token"); `email = normalize_email(claims["email"])` para la búsqueda y para la cuenta nueva (AC-004.1, AC-004.2). La vinculación sigue igual.

**`PasswordResetService.request_reset`:** `email = validate_email(email)` sustituye a la comprobación actual; ese valor normalizado se usa en la clave del advisory lock, en `get_latest_by_email`, en `get_by_email` y en la fila `PasswordResetRequest.email` (AC-003.1, AC-003.2). El correo se envía a `user.email`, la dirección guardada.

**`PasswordResetService.reset_password`** (REQ-010): misma secuencia y mismos mensajes, pero desde `get_by_token_hash` (ahora con `FOR UPDATE`) hasta el `commit` todo va dentro del `try … except Exception: rollback; raise`, de modo que un `ValidationError` (enlace o contraseña) libera el bloqueo enseguida. La validación de la contraseña pasa a `validate_new_password`. Se conserva la precedencia "enlace no válido" sobre "contraseña inválida" (test existente). Con READ COMMITTED, la petición que espera el bloqueo recibe la versión confirmada de la fila (`used_at` fijado) y responde "enlace no válido" (AC-010.1). No hay interbloqueos nuevos: `request_reset` no bloquea filas de `users` y `reset_password` bloquea siempre en el orden fila de token → fila de usuario.

**`ResendTransport._error_snippet`:** quitar la API key → recortar a 200 caracteres → `escape_log_text` (orden de la sección 6 de la spec). La llamada a `self.logger.warning` y la excepción `EmailSendError` no cambian (AC-012.6).

**Utilidades reutilizadas:** `ValidationError`, `ConflictError` y `AuthenticationError` de `exceptions/custom_exceptions.py` (Art. P2.3); `UnitOfWork`; patrón de bloqueo de fila de ADR-0020 (`get_by_id_for_update`); patrón de migración probada con `MigrationContext` de la spec 012; `EMAIL_PATTERN` y las reglas de contraseña existentes, movidas sin cambiar su comportamiento.

### 3.4 Interfaz de usuario
- **Registro (`RegisterForm.tsx`, sin cambios de marcado):** `registerSchema.password` pasa a `newPasswordSchema`, así que muestra "Mínimo 8 caracteres" o "Contraseña demasiado larga" bajo el campo (`FormMessage`) y `handleSubmit` no llama a `mutate`. Los errores del servidor ya se pintan con `error.message`. Se actualiza el comentario de cabecera de `schemas.ts`, que hoy dice que el backend no valida el registro.
- **Aviso en `/login` (`usePasswordResetNotice` en `hooks.ts`, usado por `LoginForm.tsx`):**
  - `const [show] = useState(() => location.state?.passwordReset === true)`: el valor se fija al montar y no cambia mientras dure la visita (AC-011.2).
  - `useEffect`: si `location.state?.passwordReset === true`, `navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null })`. La entrada del historial deja de llevar el indicador (AC-011.3), así que una recarga o volver con "atrás" no lo muestra (AC-011.4).
  - `<Routes key={location.pathname}>` (`app/router.tsx`) no remonta `LoginForm` al reemplazar la entrada con la misma ruta, así que el aviso sigue visible.
  - `useResetPassword` no cambia (sigue navegando con `state: { passwordReset: true }`).

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `credential_rules.validate_email` + `AuthService.register` (guarda el correo normalizado) + `UserRepository.get_by_email` (sin distinguir mayúsculas) |
| REQ-002 | `AuthService.login` (`normalize_email`) + `UserRepository.get_by_email` |
| REQ-003 | `PasswordResetService.request_reset` (`validate_email`; correo normalizado en lock, límite y fila) + `UserRepository.get_by_email` |
| REQ-004 | `AuthService.login_with_google` (`normalize_email(claims["email"])`) + verificador inyectado |
| REQ-005 | `UserRepository.get_by_email` (cuentas no migradas) + migración `a7d3f9c1e5b2_lowercase_user_emails.py` |
| REQ-006 | `credential_rules.validate_new_password` en `AuthService.register`, después del correo y antes del duplicado |
| REQ-007 | `credential_rules.validate_email` en `AuthService.register`, primer paso |
| REQ-008 | `schemas.ts` (`newPasswordSchema` en `registerSchema`); `RegisterForm.tsx` sin cambios |
| REQ-009 | `AuthService.login` (tipos y `exceeds_bcrypt_limit` antes de consultar) |
| REQ-010 | `PasswordResetRepository.get_by_token_hash` con `FOR UPDATE` + `PasswordResetService.reset_password` con la lectura dentro del `try` |
| REQ-011 | `usePasswordResetNotice` en `hooks.ts`, usado por `LoginForm.tsx` |
| REQ-012 | `utils/email_sender.escape_log_text` aplicado en `ResendTransport._error_snippet` tras quitar la key y recortar |
| NFR-001 | Firmas públicas y mensajes existentes conservados; constantes reexportadas desde `password_reset_service`; suites existentes sin tocar salvo añadidos |

## 5. Estrategia de pruebas
**Convenciones (Art. P1):** marcador `# SDD: 014 REQ-… AC-…` / `// SDD: 014 …`; nombres de tests en inglés en el backend y en español en el frontend; docstrings y comentarios en español; sin `unittest.mock` ni `monkeypatch`; ningún servicio externo real.

**Entorno:** Postgres de prueba (`TEST_DATABASE_URL`, `docker compose up -d postgres redis`, puerto 5433) para los tests de integración y de migración. Redis, Google y Resend no se usan (correo por `InMemoryTransport` del conftest o `FakeOpener`).

### backend — unitarios (`backend/tests/test_services/`)
- **`test_credential_rules.py` (nuevo):** `normalize_email`, `validate_email` (ausente, número, sin formato, con espacios y mayúsculas) y `validate_new_password` en sus fronteras (`"Clave123"`, `"a"*72`/`73`, `"ñ"*36`/`37`, `"😀"*7`, `None`, `12345678`), con los mensajes exactos. Apoyan REQ-006/007; los AC se cubren además a nivel HTTP.
- **`test_auth_service.py` (nuevo):** `AuthService` con fakes escritos a mano en el propio archivo:
  - `FakeUserRepository`: `get_by_email` registra en `queried_emails` el argumento recibido y compara igual que el repositorio real (`stored.lower() == email.lower()`); `create` asigna `id = uuid4()` y `user_role = UserRoles.user` si faltan (los valores por defecto del modelo solo existen tras el flush) y guarda en `created`.
  - `FakeJWTManager` con `generate_token(payload, minutes)` que devuelve un texto fijo y guarda el payload.
  - `FakeGoogleVerifier` invocable: devuelve unos claims configurables o lanza `ValueError`.
  - `FakeUnitOfWork` de `tests/fakes.py`.
  - Cubre: correo normalizado al crear y al buscar (AC-001.1, 001.2), login con correo con mayúsculas y espacios (AC-002.1, 002.2), Google con correo en mayúsculas que vincula la cuenta existente sin crear otra (AC-004.1) o crea una con el correo en minúsculas (AC-004.2), orden de validación del registro (AC-006.10, AC-007.3) y login con datos anómalos sin consultar el repositorio ni lanzar nada distinto de `AuthenticationError` (AC-009.1–009.5).
- **`test_password_reset_service.py` (añadidos):** `request_reset("Ana@Example.com")` usa `password-reset:email:ana@example.com` como clave de lock, busca y guarda el correo normalizado y envía a `user.email` (AC-003.1); la segunda solicitud con `"ANA@EXAMPLE.COM"` a los 30 s da `RateLimitError` con el mensaje de la spec (AC-003.2). El `FakePasswordResetRepository` existente sirve tal cual (la firma de `get_by_token_hash` no cambia); no se modifica ningún test existente.
- **`test_email_sender.py` (añadidos):** `ResendTransport` con `FakeOpener(status, body)` y `FakeLogger` de `tests/fakes.py`, aislando el fragmento con `entry.split(": ", 1)[1]` como el test existente. Cubre AC-012.1 a AC-012.6 (sin saltos reales; `\r`, `\t`, `\x1b`, `\u2028`, `\u2029`, `\x85` como texto; `ñandú` intacto; 200 `\n` escapados y ninguna `b`; sin API key; `EmailSendError` sin cambios). Opcional: unitarios directos de `escape_log_text`.
- **`test_lowercase_emails_migration.py` (nuevo, contra Postgres):** mismo patrón que `test_catalog_removal_migration.py` (carga por ruta, `MigrationContext.configure(db_session.connection())` + `Operations.context`, y `db_session.rollback()` en `finally`).
  - AC-005.3: usuario `Ana@Example.com` con hash bcrypt, `google_id`, `UserProfile` y `BodyMetric`; tras `upgrade()` el correo es `ana@example.com` y lo demás no cambia.
  - AC-005.4: dos usuarios `Ana@Example.com` y `ana@example.com` (la restricción única actual distingue mayúsculas, así que se pueden insertar); `upgrade()` lanza `RuntimeError` cuyo mensaje contiene los dos correos; después ambos correos siguen igual y siguen existiendo dos cuentas.

### backend — integración (`backend/tests/test_routes/`, fixture `client`)
- **`test_auth_routes.py` (añadidos):** AC-001.1 y 001.2, AC-002.1–002.3, AC-005.1 y 005.2 (la cuenta con `Ana@Example.com` se inserta con el ORM y `commit`, con hash bcrypt, como `create_google_only_user` en `test_password_reset_routes.py`), AC-006.1–006.10, AC-007.1–007.4 y AC-009.1–009.5. Las comprobaciones de "no se crea la cuenta" se hacen con un login posterior (`401`) o contando filas de `User`. El registro y `GET /api/auth/me` comprueban el correo devuelto.
- **`test_password_reset_routes.py` (añadidos):** reutilizan los helpers del archivo (`register`, `forgot`, `reset`, `login`, `token_from`, `fresh_ip`, `outbox`).
  - AC-003.1–003.3 con `"Ana@Example.com"` y `"ANA@EXAMPLE.COM"`.
  - AC-010.4: segundo uso secuencial.
  - AC-012.6, extremo a extremo: `ResendTransport(API_KEY, opener=FakeOpener(status=401, body=…), logger=FakeLogger())` instalado en `email_sender.transport`, como ya hace el archivo; la respuesta sigue siendo `503` con el mensaje fijo.
  - **Concurrencia (AC-010.1–010.3)**, determinista y sin `sleep` como sincronización principal:
    1. Registrar la cuenta, pedir el enlace y obtener el token del `outbox`.
    2. El test abre su propia conexión (`db.engine.connect()`, `begin()`) y bloquea la fila con `SELECT id FROM public.password_reset_requests WHERE token_hash = :h FOR UPDATE` (`hash_token` de `services.password_reset_service`; parámetros enlazados).
    3. Lanza dos hilos, cada uno con su propio `app.test_client()`, que hacen `POST /api/auth/reset-password` con las dos contraseñas y guardan la respuesta.
    4. Espera, consultando `pg_stat_activity` desde otra conexión (`wait_event_type = 'Lock'` y `datname = current_database()`, con un tiempo máximo de unos 10 s), a que haya dos backends esperando un bloqueo.
    5. Hace `rollback` de su conexión, hace `join` de los hilos con timeout y comprueba exactamente un `200` y un `400` con los mensajes de la spec (AC-010.1), qué contraseña entra (AC-010.2) y, en la variante con `"corta"`, que esa recibe el error de mínimo y la otra `200` (AC-010.3).
    - Con el código actual, las dos peticiones leen el token sin bloquear y la segunda espera en el `UPDATE` de la fila de usuario o de token; al soltar el bloqueo, las dos responden `200`, lo que da un rojo legítimo en AC-010.1 y AC-010.2.
    - Para AC-010.3 el paso 4 puede esperar a un solo backend bloqueado, porque la petición `"corta"` puede terminar antes de bloquear con el código actual. Basta con esperar a que termine el hilo de `"corta"` o a que haya un backend bloqueado.
    - El `_clean_database` del conftest limpia después, porque los datos se confirman a través de la API.

### frontend (`npm test`, Vitest con `globals: false`)
- **`RegisterForm.test.tsx` (nuevo):** `vi.mock("@/features/auth/api", …)` con `register: vi.fn()` (Art. P1.4); se renderiza dentro de `QueryClientProvider` y `MemoryRouter`, con `vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")` como en `LoginForm.test.tsx`.
  - AC-008.1/008.2/008.3/008.5: mensaje junto al campo y `register` no llamado.
  - AC-008.4: `register` llamado con la contraseña `"ñ"*36`, con `expect.objectContaining({ password })` como primer argumento (TanStack Query v5 pasa un segundo argumento de contexto).
  - AC-008.6: `register` rechaza con `new ApiError(400, "La contraseña es demasiado larga")` y el texto aparece.
  - Usar `user.type` con `"a".repeat(73)` es lento: se recomienda `user.paste` o `fireEvent.change` sobre el campo.
- **`LoginForm.test.tsx` (añadidos):** el archivo ya simula la red con `vi.stubGlobal("fetch")`. Un `vi.mock` de la `api` afectaría a todo el archivo y rompería los tests existentes, así que AC-011.2 (fallo `401`) usa el mismo `fetch` simulado del archivo (excepción justificada en la sección 7).
  - AC-011.3 y AC-011.4 usan `createMemoryRouter` + `RouterProvider` con `initialEntries: [{ pathname: "/login", state: { passwordReset: true } }]` y rutas `/login` → `<LoginForm />` y `/register` → marcador.
  - AC-011.3: tras renderizar, `router.state.location.state?.passwordReset` no es `true` y el aviso sigue visible.
  - AC-011.4: `act(() => router.navigate("/register"))`, después `act(() => router.navigate(-1))`; el aviso no aparece.
  - AC-011.1 y AC-011.5 amplían los dos tests existentes de REQ-011 de la spec 002 con el marcador de la 014, o se añaden tests propios. No se modifica ni se debilita ningún test existente.

### Tests que ya pasan antes de implementar (guardas de regresión)
AC-002.3, AC-006.4, AC-006.6, AC-006.8, AC-009.3, AC-010.3, AC-010.4, AC-011.1, AC-011.2, AC-011.5, AC-012.4 y el `503` de AC-012.6 describen comportamiento que ya existe y lo protegen frente a la refactorización. El `verifier` debe tratarlos como regresión, no como rojo ausente. Todos los demás AC deben fallar por comportamiento ausente.

### NFR-001
AC-N001.1 se cumple ejecutando las suites completas de los dos ámbitos sin borrar, saltar ni debilitar tests. No hace falta un test nuevo con el marcador; si el flujo exige uno, basta con marcar con `# SDD: 014 NFR-001 AC-N001.1` uno de los tests nuevos de regresión (por ejemplo, el de AC-010.4).

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| La migración falla en producción por correos en conflicto | Baja | Medio (despliegue a medias: código nuevo sin datos migrados) | El código nuevo ya busca sin distinguir mayúsculas, así que funciona sin la migración. El mensaje lista los correos; se resuelven a mano y se repite `flask db upgrade`. Volcado previo obligatorio |
| Test de concurrencia inestable o colgado | Media | Medio | Sincronización con `pg_stat_activity` en lugar de `sleep`, `join` con timeout y conexión de bloqueo liberada en `finally` |
| Un `ValidationError` deja el bloqueo `FOR UPDATE` abierto hasta el fin de la request | Baja | Bajo | Lectura y validaciones dentro del `try` con `rollback` explícito |
| Contraseñas antiguas de más de 72 bytes (truncadas por bcrypt antiguo) dejan de entrar | Muy baja | Bajo | Lo exige la spec (REQ-009); se recupera con el restablecimiento. Se anota en el backlog |
| Olvidar aplicar la migración (los tests usan `create_all()`) | Media | Bajo | El `reviewer` la comprueba (Art. P2.4) y el `doc-keeper` documenta el paso en el runbook (Art. P4) |
| `lower()` de Postgres y `str.lower()` de Python difieren en letras no ASCII | Muy baja | Bajo | Correos reales ASCII; anotado en ADR-0025 |

## 7. Cumplimiento de la constitución
- **Art. B1/B4:** cada REQ y NFR está mapeado (sección 4) y cada AC tiene un test previsto (sección 5).
- **Art. B5:** TDD con esqueletos `not implemented` para `credential_rules`, `verify_google_id_token`, `escape_log_text` y `usePasswordResetNotice`. Los AC que ya se cumplen se señalan como regresión. Sin llamadas reales a Google ni a Resend.
- **Art. B6.5 / P3.5:** no hay variables de entorno nuevas.
- **Art. P1.3:** sin `unittest.mock` ni `monkeypatch`. La verificación de Google se inyecta por constructor precisamente para no usar `monkeypatch`, por eso REQ-004 se prueba con unitarios y no con integración (el verificador real llamaría a Google).
- **Art. P1.4 (frontend):** `RegisterForm.test.tsx` simula la red en la capa `api`. En `LoginForm.test.tsx` se mantiene el `vi.stubGlobal("fetch")` que ya usa el archivo: un `vi.mock` de la `api` se aplica a todo el archivo y rompería sus tests existentes. `fetch` es el borde de `apiClient`, así que la red sigue simulada en esa capa.
- **Art. P2.1–P2.3:** reglas en `services/`, consultas en `repositories/`; solo `UnitOfWork` hace commit o rollback; errores con `ValidationError`, `ConflictError` y `AuthenticationError`, sin errores construidos en las rutas.
- **Art. P2.4:** sin cambio de modelo; la migración de datos se incluye y debe revisarse a mano.
- **Art. P2.5:** se reutilizan `utils/email_sender.py` y el `EMAIL_PATTERN` existente; no se duplica ninguna utilidad.
- **Art. P2 frontend:** cambios dentro de `features/auth` (`schemas.ts` con zod y `hooks.ts`); sin llamadas HTTP nuevas.
- **Art. P3.2:** la entrada del registro (correo y contraseña) se valida en el servicio y con zod. **P3.4:** la migración y el test usan SQL estático o con parámetros enlazados.
- **Art. P4:** la migración necesita un paso manual en producción (volcado y `flask db upgrade`), que debe quedar documentado.
- Se cumplen todos los "DEBERÍA".

## 8. ADRs
- [ADR-0025](../../docs/sdd/decisions/ADR-0025-correo-canonico-en-minusculas.md): correo canónico en minúsculas, migración de datos que falla ante conflictos, enlace de restablecimiento leído con `FOR UPDATE` y verificador de Google inyectado (Propuesta).
