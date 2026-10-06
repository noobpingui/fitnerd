# Plan 002 — Recuperación de contraseña por correo (forgot password)

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-05; reabierta y aprobada de nuevo el mismo día con REQ-012, commit `492b023`)
- **Estado:** borrador (iteración 2)

## 1. Resumen de la solución
Se añaden dos endpoints públicos al blueprint `auth_bp` que ya existe (`/api/auth/forgot-password` y `/api/auth/reset-password`). Los atiende un servicio nuevo, `PasswordResetService`, que recibe por constructor sus dependencias:
- `UserRepository`, que ya existe;
- `PasswordResetRepository`, nuevo;
- `UnitOfWork`;
- un `EmailSender`, nuevo (ADR-0014, ya **aceptada**: Resend);
- la URL base del frontend;
- un reloj inyectable, para probar los límites de 2 y 10 minutos y la caducidad de 5 minutos sin esperas.

Cada solicitud **aceptada** deja una fila en una tabla nueva, `password_reset_requests`, con el correo, la **IP del cliente** y la hora. Esa fila sirve a la vez:
- de registro para el límite de 1 solicitud cada 2 minutos por correo (REQ-004), también para correos sin cuenta;
- de registro para el límite de 3 solicitudes cada 10 minutos por IP (REQ-012), para cualquier correo;
- de almacén del token. Solo se guarda su hash SHA-256, nunca el token en claro.

Como solo se escriben filas al aceptar, las solicitudes rechazadas (`400`, `429`) o fallidas (`503`) no cuentan para ningún límite, tal como exige la spec.

El correo se envía **antes** de escribir nada en la base de datos. Así, un fallo del proveedor (`503`) no deja rastro: no consume ningún límite y no invalida el enlace anterior.

Para que dos peticiones simultáneas (el caso típico de un bot) no se salten los límites, la solicitud toma al principio dos **advisory locks transaccionales de Postgres**, uno por IP y otro por correo, que se liberan solos en el commit o el rollback.

La IP del cliente es `request.remote_addr` después de aplicar `werkzeug.middleware.proxy_fix.ProxyFix` con `x_for=1`, que toma la IP que Caddy escribe en `X-Forwarded-For` (ADR-0015, nueva).

En el frontend se añaden dos páginas públicas a la feature `auth` (`/forgot-password` y `/reset-password`), un enlace en `LoginForm` y el aviso de éxito en el login. El `429` por IP no necesita nada nuevo: se muestra el campo `error`, igual que el resto de los `429`.

**Migración Alembic:** sí, una tabla nueva.

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | `backend/models/password_reset_request.py`; `backend/migrations/versions/<rev>_create_password_reset_requests_table.py` | `backend/models/__init__.py` (exporta `PasswordResetRequest`) | Registro de solicitudes, IPs y tokens (REQ-002, REQ-004, REQ-007, REQ-008, REQ-012, NFR-002) |
| backend · repositories | `backend/repositories/password_reset_repository.py` | — | Consultas por correo, por IP en una ventana, por hash de token; invalidación de los enlaces anteriores; advisory locks |
| backend · services | `backend/services/password_reset_service.py` | — | Toda la lógica de REQ-002 a REQ-009, REQ-012 y los NFR |
| backend · utils | `backend/utils/email_sender.py` | — | `EmailSender` y transportes `resend`, `console` y `memory` (ADR-0014) |
| backend · extensions / app / config | — | `backend/extensions.py` (`email_sender = EmailSender()`); `backend/app.py` (`email_sender.init_app(app)` y `ProxyFix` según `PROXY_FIX_X_FOR`); `backend/config.py` (`MAIL_BACKEND`, `RESEND_API_KEY`, `MAIL_FROM`, `FRONTEND_BASE_URL` y `PROXY_FIX_X_FOR`, con valores fijos en `TestingConfig`) | Configurar el correo, la URL de los enlaces y la IP real del cliente (ADR-0015) |
| backend · routes | — | `backend/routes/auth_routes.py` (`_build_password_reset_service()` y dos vistas nuevas) | Endpoints públicos; la vista de solicitud pasa `request.remote_addr` al servicio |
| backend · tests | `backend/tests/test_services/test_password_reset_service.py`; `backend/tests/test_routes/test_password_reset_routes.py` | `backend/tests/fakes.py` (`FakeEmailSender` y `FakeClock`); `backend/tests/conftest.py` (fixture autouse que vacía el `outbox` y el `fail_with` del transporte `memory`) | Estrategia de pruebas (§5) |
| backend · docs de entorno | — | `backend/.env.example` (las 5 variables nuevas, Art. 7.1) | Documentar la configuración |
| frontend · features/auth | `components/ForgotPasswordForm.tsx` y `components/ResetPasswordForm.tsx` (con sus `.test.tsx`); `pages/ForgotPasswordPage.tsx` y `pages/ResetPasswordPage.tsx` (con `ResetPasswordPage.test.tsx`) | `api.ts`, `types.ts`, `schemas.ts`, `hooks.ts`, `components/LoginForm.tsx`, `components/LoginForm.test.tsx` | REQ-001, REQ-010 y REQ-011 |
| frontend · app | `frontend/src/app/router.test.tsx` | `frontend/src/app/router.tsx` (dos rutas públicas nuevas) | Rutas accesibles sin sesión (AC-001.2) |
| infraestructura | — | Ninguno. `Caddyfile` y `docker-compose.prod.yml` no cambian: Caddy ya escribe `X-Forwarded-For` (ADR-0015) | — |

## 3. Diseño

### 3.1 Modelo de datos y migraciones
**Tabla nueva `public.password_reset_requests`** (modelo `PasswordResetRequest` en `backend/models/password_reset_request.py`, que hereda de `Base`):

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | `Uuid` PK | no | `default=uuid.uuid4` |
| `email` | `String` (sin longitud, igual que `users.email`) | no | Correo tal como se recibió, **sin espacios en los extremos**. Índice `ix_public_password_reset_requests_email` |
| `client_ip` | `String(45)` | no | IP del cliente original tras `ProxyFix` (cabe una IPv6 en texto). Índice compuesto `ix_public_password_reset_requests_client_ip_created_at` sobre (`client_ip`, `created_at`) |
| `user_id` | `Uuid`, FK a `public.users.id` | **sí** | `NULL` cuando el correo no tiene cuenta o la cuenta es solo de Google. Índice |
| `token_hash` | `String(64)` | **sí** | SHA-256 en hexadecimal del token. `NULL` cuando no se envió correo. `unique=True` (en Postgres admite varios `NULL`) |
| `created_at` | `DateTime` (sin zona horaria, como el resto del proyecto) | no | **Lo fija el servicio** con su reloj inyectado (UTC sin `tzinfo`). Sin `server_default`, para que todas las comparaciones usen la misma fuente de tiempo |
| `used_at` | `DateTime` | sí | Momento del restablecimiento con éxito (uso único) |
| `invalidated_at` | `DateTime` | sí | Momento en que lo sustituyó un enlace más reciente |

`__table_args__` incluye el índice compuesto y `{"schema": "public"}`, igual que `ProgressAnalysis`.

**Por qué Postgres y no Redis (`RateLimiter`) para los dos límites:**
- `RateLimiter.check_and_increment` es una ventana **fija** que hace `INCR` en **cada** intento. La spec exige una ventana **móvil** (una solicitud deja de contar a los 10 minutos exactos de aceptarse, AC-012.3) y que solo cuenten las solicitudes **aceptadas** (AC-012.6 y AC-012.7). Con `INCR`, un `400`, un `429` o un `503` consumirían cupo.
- Hay un precedente: `progress_analyses` ya limita los análisis de IA con una tabla.
- Los dos límites y el token viven en la misma fila y en la misma transacción.
- Los tests de integración ya tienen Postgres, y la constitución impide usar Redis real en los tests.

**Migración:**
- Se genera con `flask db migrate -m "create password_reset_requests table"`, con `down_revision = 'e28ebf553c7d'` (la cabeza actual).
- **Hay que revisarla a mano:** el autogenerate de este repo suele añadir operaciones espurias de `drop_constraint` y `create_foreign_key` sobre otras tablas, por el esquema `public` (se ve en `2ae982b570ac`). Solo deben quedar `create_table` con sus tres índices simples y el compuesto en `upgrade()`, y lo contrario en `downgrade()`.
- Los tests usan `create_all()` y no detectan si falta la migración ni si falta el índice compuesto. El reviewer debe comprobarlo (Art. 6.4).

### 3.2 Contratos de API
| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| `POST` | `/api/auth/forgot-password` | Ninguna (pública) | `{"email": "<correo>"}` | `200` `{"message": "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."}` (también sin cuenta o con cuenta solo de Google) | `400` `{"error": "Email inválido"}` · `429` `{"error": "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."}` (límite por IP) · `429` `{"error": "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."}` (límite por correo) · `503` `{"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}` |
| `POST` | `/api/auth/reset-password` | Ninguna (pública) | `{"token": "<token>", "password": "<nueva>"}` | `200` `{"message": "Contraseña actualizada"}` | `400` `{"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}` · `400` `{"error": "La contraseña debe tener al menos 8 caracteres"}` · `400` `{"error": "La contraseña es demasiado larga"}` |

Detalles de las rutas, en `backend/routes/auth_routes.py`:
- `data = request.get_json(silent=True) or {}`. Con `silent=True`, un cuerpo ausente o que no es JSON llega al servicio como campos ausentes y da el `400` de la spec, en lugar del `415` de werkzeug.
- `_build_password_reset_service()` construye:
  ```
  PasswordResetService(UserRepository(db.session), PasswordResetRepository(db.session),
                       UnitOfWork(db.session), email_sender, current_app.config["FRONTEND_BASE_URL"])
  ```
- La vista de solicitud llama a `service.request_reset(data.get("email"), request.remote_addr or "")`. Parsear la request (incluida la IP) es trabajo de la ruta (Art. 6.1); la ruta no valida nada.
- La vista de reset pasa `data.get("token")` y `data.get("password")`, sin validarlos.
- Las vistas devuelven `jsonify({"message": REQUEST_ACCEPTED_MESSAGE}), 200` o `jsonify({"message": PASSWORD_UPDATED_MESSAGE}), 200`, con constantes importadas del módulo del servicio.
- Todos los errores salen de excepciones de `custom_exceptions.py`: `ValidationError` (400), `RateLimitError` (429) y `ServiceUnavailableError` (503). Las traduce `error_handlers.py` (Art. 6.3).
- No hay `@require_auth` (Art. 7.2: el endpoint no expone datos de usuario).

### 3.3 IP del cliente detrás de Caddy (ADR-0015)
- En producción la cadena es cliente → Caddy (contenedor `caddy`) → gunicorn (`backend:5000`). Sin más, `request.remote_addr` sería la IP de Caddy dentro de la red de Docker, la misma para todos (AC-012.9 fallaría).
- `reverse_proxy` de Caddy 2 **ignora** el `X-Forwarded-For` que mande el cliente (no hay `trusted_proxies` configurado) y lo sustituye por la IP real de la conexión. Por eso el último valor de `X-Forwarded-For` es de fiar y no lo puede falsear el cliente.
- `backend/config.py`:
  - `Config`: `PROXY_FIX_X_FOR = int(os.getenv("PROXY_FIX_X_FOR", "0"))` (desarrollo sin proxy: no se confía en la cabecera);
  - `ProductionConfig`: `PROXY_FIX_X_FOR = int(os.getenv("PROXY_FIX_X_FOR", "1"))` (un proxy de confianza, Caddy);
  - `TestingConfig`: `PROXY_FIX_X_FOR = 1`, **fijo**, para simular a Caddy en los tests de integración con la cabecera `X-Forwarded-For`.
- `backend/app.py`, en `create_app()` tras cargar la configuración: si `app.config["PROXY_FIX_X_FOR"] > 0`, `app.wsgi_app = ProxyFix(app.wsgi_app, x_for=app.config["PROXY_FIX_X_FOR"])`. Solo `x_for`; no se tocan `x_proto` ni `x_host`, que no hacen falta.
- Afecta a `request.remote_addr` en toda la app, pero hoy ningún código lo usa (comprobado con búsqueda), así que no cambia ningún comportamiento existente.

### 3.4 Lógica de negocio

**`backend/utils/email_sender.py`** (ADR-0014):
- `EmailSendError(Exception)`.
- `@dataclass EmailMessage(sender: str, to: str, subject: str, text: str, html: str)`.
- `ResendTransport(api_key: str | None, timeout: int = 10)`:
  - `send(message)` hace un `POST` a `https://api.resend.com/emails` con `urllib.request`:
    - cabeceras `Authorization: Bearer <api_key>` y `Content-Type: application/json`;
    - cuerpo `{"from", "to": [to], "subject", "text", "html"}`.
  - Cualquier `HTTPError`, `URLError`, `TimeoutError`, o una `api_key` vacía, se convierte en `EmailSendError` con un mensaje interno. Nunca incluye la API key.
- `ConsoleTransport(logger)`: `send(message)` escribe en el log con nivel INFO el destinatario, el asunto y el texto. Solo para desarrollo.
- `InMemoryTransport`:
  - `outbox: list[EmailMessage]` y `fail_with: Exception | None`;
  - `send` lanza `fail_with` si está definido y, si no, añade el mensaje al `outbox`;
  - `clear()` vacía el `outbox` y pone `fail_with = None`.
- `EmailSender`:
  - singleton sin configurar, con `transport = None` y `sender = None`;
  - `init_app(app)` elige el transporte según `app.config["MAIL_BACKEND"]` (`"resend"`, `"console"` o `"memory"`; con otro valor lanza `ValueError` al arrancar) y guarda `sender = app.config["MAIL_FROM"]`;
  - `send(to, subject, text, html) -> None` construye un `EmailMessage` y lo delega en `self.transport.send(...)`.

**`backend/config.py`** (además de `PROXY_FIX_X_FOR`, §3.3):
- `Config`:
  - `MAIL_BACKEND = os.getenv("MAIL_BACKEND", "console")`;
  - `RESEND_API_KEY = os.getenv("RESEND_API_KEY")`;
  - `MAIL_FROM = os.getenv("MAIL_FROM", "fitnerd <no-reply@fitnerd.betofallas.dev>")`;
  - `FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")`.
- `ProductionConfig`: `MAIL_BACKEND = os.getenv("MAIL_BACKEND", "resend")`.
- `TestingConfig`: `MAIL_BACKEND = "memory"` y `FRONTEND_BASE_URL = "http://localhost:5173"`, **fijos**, sin leer el entorno (`load_dotenv()` carga el `.env` local).

**`backend/repositories/password_reset_repository.py`** — `PasswordResetRepository(BaseRepository)` con el modelo `PasswordResetRequest`. Todo con el ORM y parámetros enlazados (Art. 7.5); ningún método hace commit:
- `lock_keys(keys: list[str]) -> None`: para cada clave **en orden alfabético**, `self.session.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))`. El lock dura hasta el fin de la transacción. El orden fijo evita interbloqueos (las claves de correo, `password-reset:email:…`, siempre van antes que las de IP, `password-reset:ip:…`). Una colisión de hash solo serializa de más; no rompe nada.
- `count_recent_by_ip(client_ip, since) -> int`: `select count(*) ... where client_ip == :ip and created_at > :since`. Estrictamente mayor: una fila de hace exactamente 10 minutos ya no cuenta (AC-012.3).
- `get_latest_by_email(email) -> PasswordResetRequest | None`: `select ... where email == :email order by created_at desc limit 1`.
- `get_by_token_hash(token_hash) -> PasswordResetRequest | None`.
- `invalidate_active_for_user(user_id, at) -> None`: `update(...)` con `SET invalidated_at = :at WHERE user_id = :user_id AND used_at IS NULL AND invalidated_at IS NULL`.
- `create(instance)`: el heredado de `BaseRepository`.

**`backend/services/password_reset_service.py`** — `PasswordResetService`:
- Constantes de módulo:
  - `REQUEST_ACCEPTED_MESSAGE`, `PASSWORD_UPDATED_MESSAGE`, `INVALID_EMAIL_MESSAGE`, `IP_RATE_LIMITED_MESSAGE`, `EMAIL_RATE_LIMITED_MESSAGE`, `EMAIL_SEND_FAILED_MESSAGE`, `INVALID_LINK_MESSAGE`, `PASSWORD_TOO_SHORT_MESSAGE` y `PASSWORD_TOO_LONG_MESSAGE`, con los textos exactos de la spec §6;
  - `EMAIL_COOLDOWN = timedelta(minutes=2)`, `IP_WINDOW = timedelta(minutes=10)`, `IP_MAX_REQUESTS = 3` y `TOKEN_TTL = timedelta(minutes=5)`;
  - `MIN_PASSWORD_CHARS = 8` y `MAX_PASSWORD_BYTES = 72`;
  - `EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")`.
- Funciones de módulo:
  - `utc_now()` devuelve `datetime.now(timezone.utc).replace(tzinfo=None)`;
  - `hash_token(token) -> str` devuelve `hashlib.sha256(token.encode()).hexdigest()`.
- Constructor:
  ```
  __init__(self, user_repository, password_reset_repository, unit_of_work, email_sender,
           frontend_base_url: str, clock=utc_now)
  ```

`request_reset(email, client_ip) -> None` (REQ-002 a REQ-006 y REQ-012). Sigue el orden de comprobación de la spec §6: correo, IP, correo reciente y envío.
1. Si `email` no es un `str`, o `email.strip()` está vacío o no casa con `EMAIL_PATTERN`, lanza `ValidationError(INVALID_EMAIL_MESSAGE)`. No hay lecturas ni escrituras (REQ-005).
2. `email = email.strip()`.
3. A partir de aquí todo va dentro de `try: ... except Exception: unit_of_work.rollback(); raise`, igual que en `AuthService.register`. El rollback libera los locks también en los `429` y el `503`.
4. `repo.lock_keys([f"password-reset:email:{email}", f"password-reset:ip:{client_ip}"])` y **después** `now = self.clock()`, para que el tiempo se mida ya con el lock tomado.
5. **Límite por IP (REQ-012):** si `repo.count_recent_by_ip(client_ip, now - IP_WINDOW) >= IP_MAX_REQUESTS`, lanza `RateLimitError(IP_RATE_LIMITED_MESSAGE)`. Va antes del límite por correo, así que prevalece si se superan los dos (AC-012.8). No escribe nada, así que no consume el límite por correo (AC-012.7).
6. **Límite por correo (REQ-004):** `last = repo.get_latest_by_email(email)`. Si existe y `now - last.created_at < EMAIL_COOLDOWN`, lanza `RateLimitError(EMAIL_RATE_LIMITED_MESSAGE)`.
   - Exactamente 2 minutos **no** bloquea (AC-004.3).
   - El límite es por correo, exista o no la cuenta, y desde cualquier IP (AC-004.4, AC-004.5).
7. `user = user_repository.get_by_email(email)`, con la misma comparación exacta que el login (Q9).
8. Si `user is None` o `not user.password_hash` (REQ-003):
   - `repo.create(PasswordResetRequest(email=email, client_ip=client_ip, user_id=None, token_hash=None, created_at=now))`;
   - `unit_of_work.commit()`;
   - `return`. No se envía correo. La fila cuenta para los dos límites (AC-004.4, AC-012.5).
9. Si no:
   1. `token = secrets.token_urlsafe(32)`: 43 caracteres, 256 bits de entropía (NFR-002).
   2. `reset_url = f"{frontend_base_url.rstrip('/')}/reset-password?token={token}"`.
   3. **Primero el envío:** `email_sender.send(to=user.email, subject="Restablece tu contraseña de fitnerd", text=..., html=...)`.
      - El texto y el HTML, en español, incluyen `reset_url`, la frase "caduca a los 5 minutos" y "si no pediste este cambio, puedes ignorar este correo".
      - Si lanza **cualquier** `Exception`: `logger.exception("Fallo al enviar el correo de restablecimiento")` y `raise ServiceUnavailableError(EMAIL_SEND_FAILED_MESSAGE)`. Nunca se interpola `str(exc)` (NFR-001). El `except` del paso 3 hace el rollback.
      - Como aún no se ha escrito nada, ningún límite se consume (AC-006.2, AC-012.6) y el enlace anterior sigue válido (AC-006.3).
   4. **Después las escrituras, en la misma transacción:**
      - `repo.invalidate_active_for_user(user.id, now)`, que sustituye a los anteriores (REQ-008);
      - `repo.create(PasswordResetRequest(email=email, client_ip=client_ip, user_id=user.id, token_hash=hash_token(token), created_at=now))`;
      - `unit_of_work.commit()`, que también libera los locks.

`reset_password(token, password) -> None` (REQ-007 a REQ-009). **El error del token prevalece** (spec §6):
1. Si `token` no es un `str` o está vacío, lanza `ValidationError(INVALID_LINK_MESSAGE)` (AC-008.5).
2. `row = repo.get_by_token_hash(hash_token(token))` y `now = self.clock()`.
3. El enlace es válido solo si se cumple todo esto:
   - `row is not None`;
   - `row.user_id is not None`;
   - `row.used_at is None`;
   - `row.invalidated_at is None`;
   - `now - row.created_at < TOKEN_TTL`. Exactamente 5 minutos ya no vale (AC-008.2).

   Si no, lanza `ValidationError(INVALID_LINK_MESSAGE)`.
4. Si `password` no es un `str` o `len(password) < MIN_PASSWORD_CHARS`, lanza `ValidationError(PASSWORD_TOO_SHORT_MESSAGE)`. `len` cuenta puntos de código.
5. Si `len(password.encode("utf-8")) > MAX_PASSWORD_BYTES`, lanza `ValidationError(PASSWORD_TOO_LONG_MESSAGE)`. Así bcrypt nunca recibe más de 72 bytes y no hay `5xx` (AC-009.8).
   - Los pasos 4 y 5 no escriben nada, así que el token sigue vigente (AC-009.2 y AC-009.7).
6. `user = user_repository.get_by_id(row.user_id)`. Si es `None`, lanza `ValidationError(INVALID_LINK_MESSAGE)`.
7. Dentro de `try/except Exception: rollback; raise`:
   - `user.password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")`. Es el mismo mecanismo que `AuthService.register` (NFR-003);
   - `row.used_at = now`, para el uso único (AC-007.3);
   - `unit_of_work.commit()`.

`reset-password` no tiene límite por IP (fuera de alcance, spec §3). No se toca `AuthService` ni el registro (spec §3). Las sesiones abiertas no se cierran (Q7).

### 3.5 Frontend
Todo va en `frontend/src/features/auth/` (Art. 6.6). Las llamadas pasan por `apiFetch` (Art. 6.7).

- **`types.ts`:** `ForgotPasswordPayload = { email: string }`, `ResetPasswordPayload = { token: string; password: string }` y `MessageResponse = { message: string }`.
- **`api.ts`:**
  - `requestPasswordReset(payload)` hace `POST /api/auth/forgot-password`;
  - `resetPassword(payload)` hace `POST /api/auth/reset-password`.
- **`schemas.ts`:**
  - `forgotPasswordSchema = z.object({ email: z.email("Email inválido") })`.
  - `resetPasswordSchema`:
    - `password: z.string()` con dos `refine`:
      1. `Array.from(v).length >= 8` → "Mínimo 8 caracteres". Cuenta puntos de código, igual que `len` en Python, para que los emojis no se cuenten doble.
      2. `new TextEncoder().encode(v).length <= 72` → "Contraseña demasiado larga".
    - `confirmPassword: z.string()`.
    - `.refine(d => d.password === d.confirmPassword, { message: "Las contraseñas no coinciden", path: ["confirmPassword"] })`.
  - Se exportan los tipos `ForgotPasswordFormValues` y `ResetPasswordFormValues`.
- **`hooks.ts`:** son solo mutaciones, así que **no hay claves de query nuevas** (no se cachea nada).
  - `useRequestPasswordReset()` es `useMutation({ mutationFn: requestPasswordReset })`.
  - `useResetPassword()` es `useMutation({ mutationFn: resetPassword, onSuccess: () => navigate("/login", { replace: true, state: { passwordReset: true } }) })`.
- **`components/ForgotPasswordForm.tsx`:**
  - react-hook-form con `zodResolver(forgotPasswordSchema)`;
  - un campo con la etiqueta "Email" y un botón "Enviar enlace", que muestra "Enviando..." y está `disabled` mientras `isPending`;
  - si `isSuccess`, muestra el texto fijo de AC-010.1 (no el `message` del backend, que es más corto);
  - si hay `error instanceof ApiError`, muestra `error.message` (AC-010.2). Sirve igual para los dos `429` (por IP y por correo) y el `503`;
  - un enlace "Volver al login" a `/login`.
- **`components/ResetPasswordForm.tsx`** (`{ token: string }`):
  - campos "Nueva contraseña" y "Confirmar contraseña", ambos `type="password"`, y un botón "Guardar contraseña" que muestra "Guardando..." y está `disabled` mientras `isPending`;
  - al enviar llama a `mutate({ token, password })`;
  - si hay `ApiError`, muestra `error.message` y un enlace "Solicitar un enlace nuevo" a `/forgot-password` (AC-011.5).
- **`pages/ForgotPasswordPage.tsx`:** `AuthLayout` con el título "Recuperar contraseña" y `ForgotPasswordForm`.
- **`pages/ResetPasswordPage.tsx`:**
  - lee `token` con `useSearchParams()`;
  - si falta o está vacío tras `trim()`, no muestra el formulario: muestra "El enlace no es válido o ha caducado. Solicita uno nuevo." y el enlace "Solicitar un enlace nuevo" (AC-011.6);
  - si no, `AuthLayout` con el título "Nueva contraseña" y `<ResetPasswordForm token={token} />`.
- **`components/LoginForm.tsx`:**
  - un `<Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>` bajo el campo Password;
  - con `useLocation()`, si `location.state?.passwordReset === true`, muestra `<p role="status">Contraseña actualizada. Ya puedes iniciar sesión.</p>` encima del formulario.
  - Va en el formulario y no en `LoginPage` para que los tests existentes con `MemoryRouter` lo cubran sin montar `AuthLayout`.
- **`app/router.tsx`:** dos rutas públicas nuevas, `/forgot-password` → `ForgotPasswordPage` y `/reset-password` → `ResetPasswordPage`.
  - Van fuera de `ProtectedRoute` y antes del comodín `*`, que hoy redirige a `/home` y de ahí a `/login`.
  - Se envuelven en `PageTransition`, como login y registro.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `LoginForm.tsx` (enlace "¿Olvidaste tu contraseña?") y `router.tsx` (ruta pública `/forgot-password`), con `ForgotPasswordPage` y `ForgotPasswordForm` |
| REQ-002 | `PasswordResetService.request_reset` (pasos 7 y 9): token, envío síncrono con `EmailSender`, invalidación y fila nueva. La vista `forgot_password` devuelve `200` con `REQUEST_ACCEPTED_MESSAGE`. `ResendTransport` en producción |
| REQ-003 | `request_reset` (paso 8): sin cuenta o sin `password_hash`, guarda una fila sin token y no envía correo. Misma respuesta `200` |
| REQ-004 | `request_reset` (paso 6) con `PasswordResetRepository.get_latest_by_email` y `EMAIL_COOLDOWN`, mediante `RateLimitError` (429). Por correo, exista o no la cuenta; independiente del límite por IP |
| REQ-005 | `request_reset` (paso 1), mediante `ValidationError("Email inválido")`, antes de cualquier lectura. En el frontend, `forgotPasswordSchema` |
| REQ-006 | `request_reset` (paso 9.3): primero se envía y después se escribe; un fallo se convierte en `ServiceUnavailableError` (503) sin escrituras |
| REQ-007 | `reset_password` (paso 7): hash bcrypt, `used_at` y commit. La vista `reset_password` devuelve `200` con `PASSWORD_UPDATED_MESSAGE` |
| REQ-008 | `reset_password` (pasos 1 a 3 y 6), con `get_by_token_hash`, `TOKEN_TTL`, `used_at` e `invalidated_at` (que fija `invalidate_active_for_user` en cada emisión) |
| REQ-009 | `reset_password` (pasos 4 y 5) con `MIN_PASSWORD_CHARS` y `MAX_PASSWORD_BYTES` (bytes UTF-8), sin escrituras. En el frontend, `resetPasswordSchema` |
| REQ-010 | `ForgotPasswordForm.tsx` con `useRequestPasswordReset`: mensaje fijo de éxito, error del backend (incluido el `429` por IP), "Enviando..." y "Volver al login" |
| REQ-011 | `ResetPasswordPage.tsx` y `ResetPasswordForm.tsx` con `useResetPassword`, que navega a `/login` con `state.passwordReset`; `LoginForm.tsx` muestra el aviso |
| REQ-012 | Columna `client_ip` con índice (`client_ip`, `created_at`); `request_reset` (pasos 4 y 5) con `lock_keys`, `count_recent_by_ip`, `IP_WINDOW` e `IP_MAX_REQUESTS`, mediante `RateLimitError(IP_RATE_LIMITED_MESSAGE)` antes del límite por correo; la vista pasa `request.remote_addr`, que con `ProxyFix(x_for=1)` es la IP del cliente original (§3.3, ADR-0015) |
| NFR-001 | Las vistas solo devuelven constantes. El token solo viaja en el correo. El `503` usa un mensaje fijo y el detalle solo va al log (`logger.exception`) |
| NFR-002 | `secrets.token_urlsafe(32)` (43 caracteres, CSPRNG) en cada emisión. En la base de datos solo se guarda `hash_token(token)` (SHA-256) |
| NFR-003 | `bcrypt.hashpw(..., bcrypt.gensalt())` en `reset_password`, el mismo mecanismo que `AuthService.register` |

## 5. Estrategia de pruebas

### Andamiaje (ADR-0012)
`tasks.md` debería incluir tareas `(scaffold)`, sin lógica y con `raise NotImplementedError` en Python o `throw new Error("not implemented")` en TypeScript, para:
- **Backend:**
  - `password_reset_service.py`: `PasswordResetService.__init__`, `request_reset(email, client_ip)` y `reset_password(token, password)`. El constructor puede guardar los atributos, porque no es lógica;
  - `password_reset_repository.py`: los seis métodos propios (`lock_keys`, `count_recent_by_ip`, `get_latest_by_email`, `get_by_token_hash`, `invalidate_active_for_user`; `create` es el heredado);
  - `email_sender.py`: firmas de `EmailSender`, `InMemoryTransport`, `ResendTransport` y `ConsoleTransport`, más `EmailSendError` y `EmailMessage`;
  - el modelo `PasswordResetRequest` completo (con `client_ip` y el índice compuesto), porque es solo declaración y los fakes lo instancian.
- **Frontend:** `requestPasswordReset` y `resetPassword` en `api.ts`, los dos hooks, y los componentes y páginas nuevos como stubs que lanzan el error.

**No** se deben andamiar ni cablear antes del red check:
- las vistas nuevas en `auth_routes.py`: sin ellas, los tests de rutas dan `404`, que es rojo legítimo;
- `email_sender.init_app(app)` en `app.py`: un `NotImplementedError` al arrancar rompería **toda** la suite y no sería un rojo legítimo;
- `ProxyFix` en `app.py` y `PROXY_FIX_X_FOR` en `config.py`: sin ellos, AC-012.4, AC-012.7 y AC-012.9 quedan en rojo legítimo (todas las peticiones del test client salen de `127.0.0.1`);
- las rutas de `router.tsx` y los cambios de `LoginForm.tsx`.

Las constantes de mensajes no van en el esqueleto: los tests usan los literales de la spec.

### Fakes nuevos
**En `backend/tests/fakes.py`** (son reutilizables):
- `FakeEmailSender(raise_error=None)`: guarda `sent: list[dict]` con las claves `to`, `subject`, `text` y `html`. `send(to, subject, text, html)` lanza `raise_error` si lo hay. Como es mutable, se puede probar la recuperación (AC-006.2).
- `FakeClock(now: datetime)`: es invocable (`__call__` devuelve `self.now`) y tiene `advance(**timedelta_kwargs)`.

**Locales en `test_password_reset_service.py`:**
- `FakeUserRepository(users)`, con `get_by_email` (comparación exacta) y `get_by_id`. Los usuarios son `SimpleNamespace(id, email, password_hash)`, y el `password_hash` inicial se crea con bcrypt real.
- `FakePasswordResetRepository`: guarda en memoria una lista de `PasswordResetRequest` reales, con `create`, `get_latest_by_email`, `get_by_token_hash`, `invalidate_active_for_user` y `count_recent_by_ip` (`created_at > since`) con la misma semántica que el SQL. `lock_keys` solo anota las claves en `locked_keys` (no hay concurrencia en memoria).
- Se reutiliza `FakeUnitOfWork`. Para extraer el token del correo falso: `re.search(r"token=([A-Za-z0-9_-]+)", sent["text"])`.
- Para preparar "N solicitudes aceptadas desde una IP" basta con llamar N veces a `request_reset` con correos distintos sin cuenta (no envían correo) y la misma IP; o, si hace falta controlar la hora de cada una, insertar directamente `PasswordResetRequest` en el fake con `created_at` elegido.

### Tests unitarios de servicio
Archivo: `backend/tests/test_services/test_password_reset_service.py`. No usan Postgres. Ahí se prueban todas las fronteras de tiempo con `FakeClock`. Salvo que el caso diga otra cosa, todas las llamadas usan la misma IP (por ejemplo `"203.0.113.10"`); los casos de REQ-004 que encadenan más de 3 solicitudes aceptadas deben variar la IP para no tropezar con REQ-012.

| AC | Caso y aserción clave |
|---|---|
| AC-002.1, AC-N001.1 | Cuenta con contraseña: `request_reset` no lanza nada, y la constante `REQUEST_ACCEPTED_MESSAGE` es el texto exacto de la spec |
| AC-002.2 | `len(fake_email.sent) == 1` y `sent[0]["to"] == "ana@example.com"`. Una fila con `token_hash`, `client_ip` y `uow.committed` |
| AC-002.3 | `subject == "Restablece tu contraseña de fitnerd"`. El texto contiene `"<FRONTEND_BASE_URL>/reset-password?token="` y `"5 minutos"` |
| AC-002.4 | Usuario con `password_hash` y `google_id`: se envía el correo |
| AC-003.1, AC-003.2 | Sin usuario, o usuario con `password_hash=None`: no lanza, `sent == []` y queda una fila con `user_id is None` y `token_hash is None` |
| AC-004.1, AC-004.2 | Solicitud aceptada, `clock.advance(minutes=1, seconds=59)` y otra solicitud: `RateLimitError` con el mensaje exacto de 2 minutos y `len(sent) == 1`. Luego `reset_password(token1, ...)` no lanza |
| AC-004.3 | `advance(minutes=2)`: segunda solicitud aceptada y `len(sent) == 2` |
| AC-004.4 | Correo sin cuenta, `advance(minutes=1)` y otra solicitud: `RateLimitError` de 2 minutos |
| AC-004.5 | `ana` aceptada, `advance(minutes=1)` y `luis` aceptada, con un correo enviado a `luis` |
| AC-005.1, AC-005.2 | `"no-es-un-correo"`, `""`, `None` y `"   "`: `ValidationError("Email inválido")`, sin correo ni filas, y `lock_keys` no se llamó |
| AC-006.1, AC-N001.2 | `FakeEmailSender(raise_error=RuntimeError("SMTP-SECRETO-123"))`: `ServiceUnavailableError` con el mensaje exacto, sin `"SMTP-SECRETO-123"` en `exc.message`, sin filas creadas y `uow.rolled_back` |
| AC-006.2 | Tras el fallo, `fake_email.raise_error = None` y otra solicitud sin avanzar el reloj: aceptada y se envía el correo |
| AC-006.3 | Token A en `t0`; `advance(minutes=2)` y una solicitud con fallo (503); `advance(seconds=30)` y `reset_password(A, "Clave123")` no lanza |
| AC-007.1, AC-007.2, AC-N003.1 | `reset_password` válido: `bcrypt.checkpw(b"NuevaClave123", user.password_hash)`, `password_hash != "NuevaClave123"` y `uow.committed` |
| AC-007.3 | Segundo uso del mismo token: `ValidationError(INVALID_LINK)` y el hash no cambia |
| AC-008.1, AC-008.2 | `advance(minutes=4, seconds=59)`: válido. `advance(minutes=5)`: `ValidationError` con el mensaje de enlace no válido |
| AC-008.3 | Token A en `t0`, `advance(minutes=2, seconds=30)` y token B: A da enlace no válido y B es válido |
| AC-008.4, AC-008.5 | Token inventado, `""` y `None`: enlace no válido |
| AC-009.1, AC-009.3 | `"corta"` y `None`: `ValidationError` de "al menos 8 caracteres", sin cambios en el hash |
| AC-009.2, AC-009.7 | Tras el rechazo por corta o por larga, el mismo token con `"Clave123"`: válido |
| AC-009.4, AC-009.6, AC-009.9 | `"Clave123"`, `"a"*72` y `"ñ"*36`: válidos, y `checkpw` funciona |
| AC-009.5, AC-009.8 | `"a"*73` y `"ñ"*37`: `ValidationError("La contraseña es demasiado larga")`, sin otra excepción |
| Precedencia (§6) | Token inválido y contraseña `"corta"`: el mensaje es el de enlace no válido |
| AC-N002.1 | Dos emisiones separadas por `advance(minutes=2)`: los tokens son distintos y `len >= 32` |
| AC-012.1 | Tres solicitudes aceptadas desde `203.0.113.10` para tres correos distintos (separadas por segundos); la cuarta para `luis@example.com` (con cuenta): `RateLimitError` con `"Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."` y ningún correo a `luis` |
| AC-012.2 | Dos aceptadas desde la IP y la tercera para una cuenta con contraseña: aceptada y se envía el correo |
| AC-012.3 | Primera aceptada en `t0`, otras dos en `t0+1 min` y `t0+2 min`; `clock` en `t0+10 min` exactos y otra solicitud para una cuenta: aceptada y se envía el correo |
| AC-012.4 | IP `203.0.113.10` en el límite; solicitud desde `198.51.100.20`: aceptada y se envía el correo |
| AC-012.5 | Tres aceptadas desde la IP, todas para correos sin cuenta; cuarta para una cuenta: `RateLimitError` de IP y `sent == []` |
| AC-012.6 | Desde una IP: 3 `ValidationError`, 3 `RateLimitError` por correo (la solicitud previa que los provoca se hace desde **otra** IP) y 3 `ServiceUnavailableError`; luego una solicitud para otra cuenta: aceptada y se envía el correo. `count_recent_by_ip` de la IP solo ve 0 filas antes de la última |
| AC-012.7 | Tras AC-012.1, solicitud para `luis@example.com` desde `198.51.100.20` sin avanzar el reloj: aceptada (no había fila de `luis`) |
| AC-012.8 | `ana` aceptada desde otra IP en `t0`; `203.0.113.10` en el límite con otros correos; `advance(minutes=1)` y `ana` desde `203.0.113.10`: `RateLimitError` con el mensaje **de IP**, no el de 2 minutos |
| Concurrencia (diseño, sin AC) | `fake_repo.locked_keys` contiene la clave del correo y la de la IP, y se anotaron antes de la primera lectura. Opcional, sin marcador de AC (o con `SDD: REQ-012`) |

### Tests de integración de rutas
Archivo: `backend/tests/test_routes/test_password_reset_routes.py`. Necesitan Postgres (`docker compose up -d postgres`).
- Se usa el transporte `memory`: `from extensions import email_sender` y `email_sender.transport.outbox` o `.fail_with`.
- La fixture autouse nueva de `conftest.py` llama a `email_sender.transport.clear()` en el teardown.
- La cuenta con contraseña se crea con `POST /api/auth/register`, igual que en la fixture `registered_user`.
- La cuenta solo de Google se inserta con `db_session`, con un `User(password_hash=None, google_id="g-1")` y `commit()`, dentro de un `with` breve. No se debe mantener abierto el app context durante las peticiones (ver `conftest.py`).
- Para "envejecer" una solicitud sin esperar ni falsear el reloj, se hace un `UPDATE` de `password_reset_requests.created_at` con `db_session` (ORM, por ejemplo `created_at - timedelta(minutes=2)`). Así se prueban AC-004.3, AC-008.3, AC-012.3 y AC-N002.1 de punta a punta.
- **IP del cliente:** el test client siempre conecta desde `127.0.0.1`, que hace de "Caddy". Con `TestingConfig.PROXY_FIX_X_FOR = 1`, cada petición indica la IP del cliente con `headers={"X-Forwarded-For": "203.0.113.10"}`.
- **Cupo por IP en los demás tests:** la base se vacía entre tests, pero un mismo test que haga más de 3 solicitudes aceptadas desde la misma IP recibirá `429`. Los tests de REQ-002 a REQ-009 que encadenen varias solicitudes (por ejemplo AC-009.6 y AC-009.9 con su propio usuario cada uno) deben usar un `X-Forwarded-For` distinto en cada una o separarse en tests distintos.

| AC | Aserción clave |
|---|---|
| AC-002.1, AC-N001.1 | `200` y `get_json() ==` el cuerpo exacto. El token del correo no aparece en `response.get_data(as_text=True)` |
| AC-002.2, AC-002.3 | `len(outbox) == 1`, `to`, asunto, `sender == "fitnerd <no-reply@fitnerd.betofallas.dev>"`, el enlace `http://localhost:5173/reset-password?token=` y `"5 minutos"` |
| AC-003.1, AC-003.2 | `200` con el mismo cuerpo y `outbox == []` |
| AC-004.1, AC-004.4 | Dos peticiones seguidas: la segunda da `429` con el cuerpo exacto de 2 minutos y `len(outbox) == 1` (o `0` sin cuenta) |
| AC-004.3 | Se envejece la fila 2 minutos y se vuelve a pedir: `200` y `len(outbox) == 2` |
| AC-004.5 | `ana` y luego `luis`, ambas `200`, con 2 correos a destinatarios distintos |
| AC-005.1, AC-005.2 | `"no-es-un-correo"`, sin campo, `""` y sin cuerpo JSON: `400 {"error": "Email inválido"}` |
| AC-006.1, AC-006.2, AC-N001.2 | `fail_with = RuntimeError("SMTP-SECRETO-123")`: `503` con el cuerpo exacto y sin ese texto. Después `fail_with = None` y otra petición: `200` y 1 correo |
| AC-007.1, AC-007.2 | Reset con el token del `outbox`: `200 {"message": "Contraseña actualizada"}`. El login con la nueva da `200` y con la anterior `401` |
| AC-007.3 | Reutilizar el token: `400` con el mensaje de enlace no válido |
| AC-008.3 | Primer token, se envejece la fila y segundo token: el primero da `400` y el segundo `200` |
| AC-008.4, AC-008.5 | Token inventado, sin token y `""`: `400` con el mensaje de enlace no válido |
| AC-009.1, AC-009.5, AC-009.8 | `"corta"`, `"a"*73` y `"ñ"*37`: `400` con los cuerpos exactos (nunca `5xx`). Luego el mismo token con `"Clave123"` da `200` |
| AC-009.6, AC-009.9 | `"a"*72` y `"ñ"*36` (cada uno con su propio usuario): `200` y login correcto |
| AC-N002.1 | Dos emisiones, con la primera fila envejecida: los tokens de los dos correos son distintos y `len >= 32` |
| AC-N003.1 | Tras el reset, se lee `User.password_hash` con `db_session`: no es igual a la contraseña y `bcrypt.checkpw` funciona |
| AC-012.1, AC-012.5 | Tres `200` desde `X-Forwarded-For: 203.0.113.10` para tres correos sin cuenta; la cuarta para una cuenta registrada: `429` con el cuerpo exacto de IP y `outbox == []` |
| AC-012.2 | Dos `200` desde la IP y la tercera para una cuenta: `200` y 1 correo |
| AC-012.3 | Tres `200` desde la IP; se envejece la fila más antigua hasta salir de la ventana (`UPDATE` que fija `created_at = utc_now() - timedelta(minutes=10, seconds=1)`; el segundo extra absorbe los milisegundos entre el `UPDATE` y la petición, porque en integración no se controla el reloj) y se pide para una cuenta: `200` y 1 correo. El borde exacto de 10 minutos se prueba en el unitario |
| AC-012.4 | Con `203.0.113.10` en el límite, petición desde `X-Forwarded-For: 198.51.100.20`: `200` y 1 correo |
| AC-012.6 | Desde `203.0.113.10`: 3 `400`, 3 `429` por correo (con una solicitud previa para ese correo desde otra IP) y 3 `503` (`fail_with`); después, `fail_with = None` y una petición para otra cuenta: `200` y 1 correo nuevo |
| AC-012.7 | Tras el `429` de AC-012.1 para `luis@example.com`, la misma petición desde `198.51.100.20`: `200` y correo a `luis` |
| AC-012.8 | `ana` `200` desde `198.51.100.20`; `203.0.113.10` en el límite con otros correos; `ana` desde `203.0.113.10`: `429` con el cuerpo **de IP** |
| AC-012.9 | Todas las peticiones salen del mismo `127.0.0.1` (el "proxy"). Tres `200` con `X-Forwarded-For: 203.0.113.10` y la cuarta da `429`; después, una con `X-Forwarded-For: 198.51.100.20` da `200`. Comprueba que se usa la IP original y no la del proxy |

### Tests de frontend (Vitest y RTL)
La red se simula con `vi.stubGlobal("fetch", ...)`, como en `LoginForm.test.tsx`, que ya existe. Para "no se envía ninguna petición" se usa `expect(fakeFetch).not.toHaveBeenCalled()`, y para el estado "en curso", un `fetch` que devuelve una promesa que nunca se resuelve. En los tests que montan `LoginForm` hay que poner `vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")`.

| Archivo | AC cubiertos |
|---|---|
| `frontend/src/features/auth/components/LoginForm.test.tsx` (se amplía) | AC-001.1 (`getByRole("link", { name: "¿Olvidaste tu contraseña?" })` con `href="/forgot-password"`) y AC-011.4, parte del aviso: `MemoryRouter` con `initialEntries={[{ pathname: "/login", state: { passwordReset: true } }]}` muestra el aviso, y sin `state` no |
| `frontend/src/app/router.test.tsx` | AC-001.2: `window.history.pushState({}, "", "/forgot-password")`, `localStorage` sin token y `<AppRouter />` dentro de `QueryClientProvider`: se ven el campo "Email" y el botón "Enviar enlace", y `window.location.pathname` sigue siendo `/forgot-password`. Igual para `/reset-password?token=abc` |
| `frontend/src/features/auth/components/ForgotPasswordForm.test.tsx` | AC-005.3, AC-010.1 (respuesta `200`, texto exacto), AC-010.2 (`429` con el mensaje de 2 minutos, `429` con el mensaje de IP de REQ-012 y `503`: muestra `error`), AC-010.3 ("Enviando..." y `disabled`) y AC-010.4 (enlace a `/login`) |
| `frontend/src/features/auth/components/ResetPasswordForm.test.tsx` | AC-011.2, AC-011.3, AC-011.5 (`400`, error y enlace a `/forgot-password`), AC-011.7, AC-011.8 (`"a".repeat(73)`) y AC-011.9 (`"ñ".repeat(37)`). También que el cuerpo de `fetch` lleve `token` y `password` |
| `frontend/src/features/auth/pages/ResetPasswordPage.test.tsx` | AC-011.1 (`/reset-password?token=abc`), AC-011.6 (sin token y con `?token=`) y AC-011.4 de punta a punta: rutas `/reset-password` → `ResetPasswordPage` y `/login` → `LoginForm`, `fetch` con `200`, y termina en el login con el aviso |

### Marcadores y ejecución
- Cada test lleva el marcador en la línea anterior:
  - Python: `# SDD: REQ-00X AC-00X.Y` (o `NFR-00X AC-N00X.Y`);
  - TypeScript: `// SDD: ...` antes de `it(...)`.
- Nombres: en inglés en el backend (por ejemplo, `test_request_reset_is_rate_limited_to_three_per_ip_in_ten_minutes`) y en español en `it("…")`.
- Para ejecutar todo:
  - `.venv/Scripts/python.exe -m pytest -q` en `backend/`, más el ratchet de ruff;
  - `npm test`, `npm run lint`, `npx tsc -b` y `npm run build` en `frontend/`.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Canal lateral por tiempo (riesgo aceptado por el usuario en el gate de plan, iteración 1):** con una cuenta con contraseña, la respuesta espera al envío a Resend; sin cuenta, o con cuenta solo de Google, responde al instante. Midiendo la latencia se puede deducir qué correos tienen cuenta con contraseña | Media | Bajo | **Aceptado** por el usuario. No se mitiga en esta feature. El límite por IP (REQ-012) y el de correo reducen mucho el ritmo al que un atacante puede sondear correos. Si más adelante se quiere cerrar, la opción sería enviar en segundo plano, pero contradice la spec ("antes de responder", REQ-002 y AC-002.2) y exigiría otra spec |
| Un bot lanza muchas solicitudes **en paralelo** desde una IP: todas leen el contador antes de que ninguna escriba y se saltan el límite de 3 | Media | Medio | Advisory locks transaccionales por IP y por correo (`lock_keys`) al principio de `request_reset`: las solicitudes de una misma IP o correo se procesan de una en una. Orden fijo de claves para evitar interbloqueos. Con esto también desaparece la carrera de dos solicitudes simultáneas para el mismo correo que el plan anterior aceptaba |
| Mientras se envía el correo, el lock y una conexión a la base de datos siguen retenidos; las peticiones simultáneas de la misma IP esperan | Baja | Bajo | `timeout=10` en `ResendTransport`. Solo esperan peticiones de la misma IP o del mismo correo, que es justo lo que se quiere frenar |
| La IP del cliente sale mal: si se quita Caddy, se pone un CDN delante o se cambia `trusted_proxies`, `x_for=1` contaría la IP equivocada (todos los clientes comparten cupo, o un cliente podría falsear `X-Forwarded-For`) | Baja | Medio | `PROXY_FIX_X_FOR` configurable por entorno; ADR-0015 documenta la cadena actual y qué hay que cambiar si cambia la infraestructura. AC-012.9 queda cubierto en integración simulando el proxy |
| Una petición directa a `127.0.0.1:5000` desde la propia instancia (sesión SSH) con un `X-Forwarded-For` inventado se trata como si viniera de esa IP | Muy baja | Bajo | Ese puerto solo escucha en `127.0.0.1` de la instancia (`docker-compose.prod.yml`); quien llega ahí ya tiene acceso al servidor |
| Varios usuarios legítimos detrás de la misma IP pública (NAT de una oficina, datos móviles con CGNAT) comparten el cupo de 3 cada 10 minutos | Baja | Bajo | Es el comportamiento que fija la spec (Q15). El mensaje de `429` invita a reintentar más tarde |
| En producción no llegan los correos: dominio sin verificar en Resend, falta `RESEND_API_KEY` o `FRONTEND_BASE_URL` apunta a localhost | Media | Alto | `ResendTransport` falla de forma controlada (`503`) si falta la key. Lista de pasos operativos en ADR-0014, que el doc-keeper debe llevar a la documentación de despliegue. Después de desplegar, se prueba a mano con una cuenta real |
| Los correos acaban en spam por falta de SPF, DKIM o DMARC | Media | Medio | Verificar el dominio en Resend, con los registros DNS que indica. El texto de AC-010.1 ya avisa de revisar la carpeta de spam |
| La migración autogenerada trae operaciones espurias sobre claves foráneas de otras tablas, o se olvida el índice compuesto | Alta | Medio | Revisión manual obligatoria (§3.1, Art. 6.4). Dejar solo `create_table` y sus índices. El reviewer lo comprueba |
| Un test envía un correo real porque el `.env` local tiene `MAIL_BACKEND=resend` | Baja | Medio | `TestingConfig` fija `MAIL_BACKEND = "memory"` sin leer el entorno |
| Tests de integración que se pisan con el límite por IP (más de 3 solicitudes aceptadas desde `127.0.0.1` en un mismo test) | Media | Bajo | Indicado en §5: variar `X-Forwarded-For` o separar los casos. La base se vacía entre tests |
| El correo se envía, pero el commit posterior falla: el usuario recibe un enlace que no funciona | Muy baja | Bajo | Responde `500` y el usuario puede volver a pedirlo enseguida, porque no se consumió ningún límite. Hacerlo al revés (escribir antes de enviar) rompería AC-006.2 y AC-006.3 |
| `password_reset_requests` crece sin límite y guarda correos de personas sin cuenta e IPs (dato personal) | Media | Bajo | Volumen pequeño. Una tarea de limpieza (por ejemplo, borrar filas de más de 24 h, que ya no cuentan para ningún límite) queda fuera de alcance; el doc-keeper debería anotarlo en el backlog |
| Contraseñas con emojis: `min(8)` de zod cuenta unidades UTF-16 y Python cuenta puntos de código | Baja | Bajo | El schema cuenta con `Array.from(v).length` y los bytes con `TextEncoder`, que es la misma métrica que el backend |

## 7. Cumplimiento de la constitución
- **Art. 1:** spec 002 aprobada el 2026-10-05, reabierta por Q15 (Art. 1.3) y aprobada de nuevo (`492b023`).
- **Art. 4:** los 12 REQ y los 3 NFR están mapeados (§4), y todos los AC tienen al menos un test previsto (§5), incluidos AC-012.1 a AC-012.9.
- **Art. 5.2 y ADR-0012:** hay esqueletos de servicio, repositorio, `email_sender` y frontend. Las rutas, `init_app` y `ProxyFix` no se cablean hasta implementar, así que el rojo es legítimo test a test (`404`, `NotImplementedError` en el servicio o `429` por compartir IP).
- **Art. 5.4:** los unitarios usan fakes escritos a mano e inyectados por constructor (`FakeEmailSender`, `FakeClock`, `FakeUserRepository`, `FakePasswordResetRepository` y `FakeUnitOfWork`). Ningún test llama a Resend: `TestingConfig` fuerza el transporte `memory`. Ningún test usa Redis: los límites viven en Postgres.
  - **Justificación:** los tests de integración usan `InMemoryTransport`, un doble que vive en código de producción y se selecciona por configuración (ADR-0014), en lugar de `monkeypatch`. Es la única forma de inspeccionar el correo y forzar el fallo de punta a punta, ya que las rutas construyen los servicios a partir de singletons.
  - Para envejecer filas se usa un `UPDATE` del ORM sobre la base de datos de test. No es un doble. La IP del cliente se simula con la cabecera `X-Forwarded-For`, que es exactamente lo que hace Caddy en producción.
- **Art. 6.1 y 6.2:** se respetan las capas `routes → services → repositories → models`. La ruta solo extrae `email` y `request.remote_addr`; la lógica de los límites está en el servicio y las consultas y locks en el repositorio. Las dependencias se inyectan por constructor desde `_build_password_reset_service()`, y solo `UnitOfWork` hace commit o rollback (que también liberan los advisory locks).
- **Art. 6.3:** los errores son `ValidationError`, `RateLimitError` y `ServiceUnavailableError`. Ninguno se construye a mano en las rutas.
- **Art. 6.4:** la migración de `password_reset_requests` (con `client_ip` y su índice compuesto) se revisa a mano (§3.1).
- **Art. 6.5:** el código nuevo no debe introducir violaciones de ruff, y no se tocan las que ya existían en `auth_service.py`, `auth_routes.py`, `app.py` ni `config.py`.
- **Art. 6.6 a 6.10:**
  - la feature `auth` sigue su estructura (`api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`, `components/` y `pages/`);
  - las llamadas pasan por `apiFetch`;
  - los formularios usan react-hook-form con zod;
  - hay mutaciones de TanStack Query y no hacen falta claves de query (no hay datos cacheables);
  - los componentes son los de shadcn, ya existentes.
- **Art. 6.11:** todos los textos van en español correcto y sin voseo. Ojo: `RegisterPage` dice hoy "Unite a fitnerd", que es voseo preexistente; no se toca porque está fuera de alcance.
- **Art. 7.1:** las variables nuevas (`MAIL_BACKEND`, `RESEND_API_KEY`, `MAIL_FROM`, `FRONTEND_BASE_URL` y `PROXY_FIX_X_FOR`) se documentan en `backend/.env.example`. La API key nunca se registra en el log.
- **Art. 7.2:** los endpoints son públicos porque no exponen datos de usuario: la respuesta es idéntica exista o no la cuenta (REQ-003).
- **Art. 7.3:** se valida en el servicio (`ValidationError`) y con zod en el frontend.
- **Art. 7.4:** no se llama a proveedores de IA. Aun así, hay un límite propio por correo y otro por IP, y los fallos del proveedor de correo se traducen a `503`.
- **Art. 7.5:** solo se usa el ORM (`select`, `update` y `func.pg_advisory_xact_lock` con parámetros enlazados).
- **"DEBERÍA" incumplidos:** ninguno.

## 8. ADRs
- [ADR-0014](../../docs/sdd/decisions/ADR-0014-correo-transaccional.md), **Aceptada** (el usuario confirmó Resend en el gate de plan, iteración 1): correo transaccional con Resend (API HTTP con la librería estándar, sin SDK) detrás de un `EmailSender` con los transportes `resend`, `console` y `memory`, elegidos con `MAIL_BACKEND`.
- [ADR-0015](../../docs/sdd/decisions/ADR-0015-ip-cliente-proxyfix.md), **Aceptada** (el usuario la aprobó en el gate de plan, iteración 2): la IP del cliente se obtiene con `ProxyFix(x_for=N)` de Werkzeug, con `N` en `PROXY_FIX_X_FOR` (1 en producción por Caddy, 0 en desarrollo, 1 fijo en tests), confiando en que Caddy sustituye el `X-Forwarded-For` del cliente.

## Comentarios del usuario
Gate de plan, iteración 1 (2026-10-05). Copiado literalmente por el orquestador:

> 1. Si, Resend es la opcion que vamos a usar. Con respecto a los riesgos, el 2 no me genera molestias, pero el 3 si, porque un script o bot malicioso puede generar problemas graves a futuro. Creo que el 2 podemos anotarlo y pasarlo asi, pero el 3 si es necesario regresar y replantear que la regla de solicitudes cada 2 minutos se aplique para la ip y no para el email como tal.

Contexto de los riesgos que cita el usuario (los presentó el orquestador en el gate):
- **Riesgo 2:** canal lateral por tiempo. Con cuenta existente, la respuesta espera al envío a Resend; sin cuenta, responde al instante, lo que permite deducir qué correos están registrados. El usuario lo **acepta**: debe quedar anotado como riesgo aceptado.
- **Riesgo 3:** sin límite por IP. El usuario pidió resolverlo; la spec se reabrió y ahora incluye REQ-012 (Q15: "1. Por IP y por correo. 2. Dejemolo en un punto intermedio; 3 solicitudes cada 10 minutos.").

Además: el usuario **confirma Resend**, así que ADR-0014 pasa de "Propuesta" a "Aceptada".

**Aplicado en la iteración 2 (planner):**
- Riesgo 2: anotado como riesgo aceptado en §6 (primera fila).
- Riesgo 3: REQ-012 diseñado (columna `client_ip`, `count_recent_by_ip`, advisory locks, `ProxyFix` con ADR-0015), mapeado en §4 y con pruebas para AC-012.1 a AC-012.9 en §5.
- ADR-0014 marcada como "Aceptada" y su fila del índice actualizada.

Gate de plan, iteración 2 (2026-10-05). Copiado literalmente por el orquestador, respondiendo a "1. ¿Apruebas ADR-0015? 2. ¿Apruebas cerrar la etapa plan? 3. ¿Apruebas el commit?":

> 1,2 y 3 approved

Por tanto ADR-0015 pasa de "Propuesta" a "Aceptada".
