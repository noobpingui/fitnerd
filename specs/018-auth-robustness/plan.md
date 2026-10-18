# Plan 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-18)
- **Ámbitos:** backend

## 1. Resumen de la solución

Las rutas `/register` y `/login` dejan de usar `request.get_json()` (que lanza 415 o 400 en inglés, o devuelve `None` y
acaba en 500) y pasan a leer el cuerpo con `request.get_json(silent=True)`, igual que `/api/profile` y
`/api/body-metrics`. El cuerpo crudo se entrega a dos métodos nuevos de `AuthService` (`register_from_body` y
`login_from_body`), que comprueban que es un objeto JSON y delegan en `register` y `login`. `register` añade, en el
orden de REQ-006, la validación de nombre, apellido y fecha de nacimiento antes de consultar duplicados. Las reglas de
nombre y del cuerpo viven en un módulo nuevo `services/auth_input_rules.py`; las de fecha de nacimiento se extraen de
`profile_service.py` a `services/date_of_birth_rules.py` para que perfil y registro compartan exactamente las mismas
reglas y mensajes. Los mensajes «Wrong Credentials» y «Email already registered» se sustituyen por constantes en
español. En `PasswordResetService.reset_password` se lee el reloj una sola vez al empezar y ese instante se pasa a todas
las comprobaciones de caducidad y al `used_at`. No hay cambios de modelo ni migración.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | routes | — | `backend/routes/auth_routes.py` | `/register` y `/login` leen el cuerpo con `get_json(silent=True)` y llaman a `register_from_body` / `login_from_body`; se elimina `date.fromisoformat` de la ruta (REQ-001, REQ-002, REQ-005) |
| backend | services | `backend/services/auth_input_rules.py` | — | Regla de cuerpo objeto JSON y reglas de nombre y apellido con sus mensajes (REQ-001 a REQ-004) |
| backend | services | `backend/services/date_of_birth_rules.py` | `backend/services/profile_service.py` | Se extraen `DOB_PATTERN`, `MIN_AGE`, `MAX_AGE`, los tres mensajes de fecha, `age_on` y `_parse_dob` (como `parse_date_of_birth`); `profile_service` los importa y los sigue exponiendo con los mismos nombres (REQ-005) |
| backend | services | — | `backend/services/auth_service.py` | Métodos `register_from_body` y `login_from_body`, reloj inyectado, validación de nombre/apellido/fecha en `register`, mensajes en español (REQ-001 a REQ-008) |
| backend | services | — | `backend/services/password_reset_service.py` | Un único `now` por petición en `reset_password` (REQ-009) |
| backend | tests | `backend/tests/test_services/test_auth_input_rules.py` | `backend/tests/test_routes/test_auth_routes.py`, `backend/tests/test_services/test_auth_service.py`, `backend/tests/test_services/test_password_reset_service.py`, `backend/tests/fakes.py` | Tests nuevos y actualización de los mensajes y del helper `register` de los existentes (ver §5) |

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. `users.first_name` y `users.last_name` son `String(250)` y `users.date_of_birth` es `Date` nullable: el
límite de 100 caracteres se aplica en el servicio y cabe en la columna. Las cuentas existentes (incluidas las de Google
con nombre, apellido o fecha vacíos) no se tocan; `login` y `login_with_google` no validan esos campos.

### 3.2 Contratos e interfaces

**HTTP** (sin autorización, igual que hoy):

| Endpoint | Caso | Código | Cuerpo |
|---|---|---|---|
| `POST /api/auth/register` | Cuerpo que no es objeto JSON (sin cuerpo, `text/plain`, JSON malformado, `null`, lista, número, texto) | 400 | `{"error": "La petición no es válida"}` |
| `POST /api/auth/register` | `email` / `password` no válidos | 400 | Mensajes de la spec 014, sin cambios |
| `POST /api/auth/register` | `first_name` ausente, no texto o en blanco | 400 | `{"error": "El nombre es obligatorio"}` |
| `POST /api/auth/register` | `first_name` recortado de más de 100 caracteres | 400 | `{"error": "El nombre no puede superar los 100 caracteres"}` |
| `POST /api/auth/register` | `last_name` ausente, no texto o en blanco | 400 | `{"error": "El apellido es obligatorio"}` |
| `POST /api/auth/register` | `last_name` recortado de más de 100 caracteres | 400 | `{"error": "El apellido no puede superar los 100 caracteres"}` |
| `POST /api/auth/register` | `date_of_birth` ausente, no texto, sin formato `AAAA-MM-DD` o inexistente | 400 | `{"error": "La fecha de nacimiento no es válida"}` |
| `POST /api/auth/register` | `date_of_birth` futura | 400 | `{"error": "La fecha de nacimiento no puede ser futura"}` |
| `POST /api/auth/register` | Edad fuera de 14–100 años cumplidos hoy (UTC) | 400 | `{"error": "Debes tener entre 14 y 100 años"}` |
| `POST /api/auth/register` | Correo ya registrado | 409 | `{"error": "Ya existe una cuenta con este correo"}` |
| `POST /api/auth/register` | Éxito | 201 | `{"token": …}` (sin cambios) |
| `POST /api/auth/login` | Cuerpo que no es objeto JSON | 400 | `{"error": "La petición no es válida"}` |
| `POST /api/auth/login` | Objeto JSON con credenciales incorrectas o datos anómalos (incluido `{}`) | 401 | `{"error": "Correo o contraseña incorrectos"}` |
| `POST /api/auth/login` | Éxito | 200 | `{"token": …}` (sin cambios) |

Restablecimiento de contraseña: sin cambios de contrato.

**Símbolos nuevos o cambiados** — esqueletos con `raise NotImplementedError("not implemented")` (Art. P1.5). Las
constantes de mensajes se crean con su valor real ya en el esqueleto (son datos, no lógica), igual que en la spec 014.

```python
# backend/services/auth_input_rules.py  (NUEVO)
"""Reglas del cuerpo de las peticiones de autenticación y de los nombres del registro."""
from exceptions.custom_exceptions import ValidationError

INVALID_REQUEST_MESSAGE = "La petición no es válida"
FIRST_NAME_REQUIRED_MESSAGE = "El nombre es obligatorio"
FIRST_NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres"
LAST_NAME_REQUIRED_MESSAGE = "El apellido es obligatorio"
LAST_NAME_TOO_LONG_MESSAGE = "El apellido no puede superar los 100 caracteres"
MAX_NAME_CHARS = 100


def require_json_object(body: object) -> dict:
    """Devuelve `body` si es un dict; si no (None, lista, número, texto...), lanza
    ValidationError(INVALID_REQUEST_MESSAGE)."""
    raise NotImplementedError("not implemented")


def validate_first_name(value: object) -> str:
    """Devuelve el nombre sin los espacios de los extremos. Lanza ValidationError con
    FIRST_NAME_REQUIRED_MESSAGE si no es texto o queda vacío, y con
    FIRST_NAME_TOO_LONG_MESSAGE si recortado supera MAX_NAME_CHARS caracteres."""
    raise NotImplementedError("not implemented")


def validate_last_name(value: object) -> str:
    """Igual que validate_first_name, con los mensajes del apellido."""
    raise NotImplementedError("not implemented")
```

```python
# backend/services/auth_service.py  (CAMBIOS)
from services.profile_service import utc_now   # mismo reloj que ya reutilizan body_metric y progress_analysis

WRONG_CREDENTIALS_MESSAGE = "Correo o contraseña incorrectos"
EMAIL_TAKEN_MESSAGE = "Ya existe una cuenta con este correo"


class AuthService():
    def __init__(self, user_repository, unit_of_work, jwt_manager, google_client_id=None,
                 google_token_verifier=verify_google_id_token, clock=utc_now):
        # Guarda también `self.clock = clock` (el esqueleto lo guarda sin lanzar).
        ...

    def register_from_body(self, body: object) -> str:
        """Comprueba que `body` es un objeto JSON y delega en `register` con sus campos."""
        raise NotImplementedError("not implemented")

    def login_from_body(self, body: object) -> str:
        """Comprueba que `body` es un objeto JSON y delega en `login` con `email` y `password`."""
        raise NotImplementedError("not implemented")

    # Firma sin cambios; cambia el contrato de `date_of_birth`: ahora es el valor crudo
    # del cuerpo (se espera un texto "AAAA-MM-DD"), no un `date` ya convertido.
    def register(self, email, password, first_name, last_name, date_of_birth) -> str: ...

    # Firma sin cambios; solo cambia el mensaje del AuthenticationError.
    def login(self, email, password) -> str: ...
```

```python
# backend/services/date_of_birth_rules.py  (NUEVO, extracción sin cambio de comportamiento)
INVALID_DOB_MESSAGE = "La fecha de nacimiento no es válida"
FUTURE_DOB_MESSAGE = "La fecha de nacimiento no puede ser futura"
AGE_RANGE_MESSAGE = "Debes tener entre 14 y 100 años"
MIN_AGE = 14
MAX_AGE = 100
DOB_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def age_on(date_of_birth: date, today: date) -> int: ...
def parse_date_of_birth(value: object, today: date) -> date: ...
```

`date_of_birth_rules.py` es un **movimiento de código existente** (el cuerpo actual de `age_on` y `_parse_dob` de
`profile_service.py`), no un símbolo nuevo con lógica pendiente: los tests **no** lo importan (se prueba a través de
`AuthService` y de los tests de perfil existentes), así que no lleva esqueleto y se mueve en la etapa de
implementación. `profile_service.py` lo importa y sigue exponiendo `age_on`, `utc_now`, `DOB_PATTERN`, `MIN_AGE`,
`MAX_AGE` y los tres mensajes con los mismos nombres (los importan `progress_analysis_service.py` y
`body_metric_service.py`), marcando la reexportación con `# noqa: F401` como ya hace `password_reset_service.py`.

```python
# backend/services/password_reset_service.py  (CAMBIO INTERNO, sin símbolos nuevos)
def _ensure_link_is_usable(self, row, now): ...   # recibe el instante; ya no llama a self.clock()
def reset_password(self, token, password): ...    # firma sin cambios
```

### 3.3 Lógica

**Rutas (`auth_routes.py`)**, solo parsean y delegan (Art. P2.1):

```python
@auth_bp.route("/register", methods=["POST"])
def register():
    token = _build_auth_service().register_from_body(request.get_json(silent=True))
    return jsonify({"token": token}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    token = _build_auth_service().login_from_body(request.get_json(silent=True))
    return jsonify({"token": token}), 200
```

Con `silent=True`, Flask devuelve `None` para: sin cuerpo, tipo de contenido no JSON (en lugar del 415 en inglés), JSON
malformado (en lugar del 400 en inglés) y el literal `null`. Una lista, un número o un texto JSON llegan como `list`,
`int`/`float` o `str`. En todos esos casos `require_json_object` lanza el 400 de REQ-001/REQ-002. Se elimina el import
de `date` de la ruta. `/google`, `/forgot-password`, `/reset-password` y `/me` no cambian. `_build_auth_service` no
cambia: `AuthService` usa el reloj por defecto (`utc_now`).

**`AuthService.register_from_body(body)`**: `data = require_json_object(body)` y
`return self.register(data.get("email"), data.get("password"), data.get("first_name"), data.get("last_name"),
data.get("date_of_birth"))`.

**`AuthService.login_from_body(body)`**: `data = require_json_object(body)` y
`return self.login(data.get("email"), data.get("password"))`. Un `{}` llega a `login(None, None)` y da 401
(AC-002.5).

**`AuthService.register`**, en el orden exacto de REQ-006, todo **antes** del `try` (no toca la base ni el UnitOfWork):

1. `email = validate_email(email)` (spec 014).
2. `validate_new_password(password)` (spec 014).
3. `first_name = validate_first_name(first_name)`.
4. `last_name = validate_last_name(last_name)`.
5. `date_of_birth = parse_date_of_birth(date_of_birth, self.clock().date())` — "hoy" en UTC, como en el perfil.
6. Dentro del `try` actual: duplicado → `ConflictError(EMAIL_TAKEN_MESSAGE)`; después hash, `User(...)` con los
   valores ya limpios (nombre y apellido recortados, fecha como `date`), `create`, `commit` y token.

**`validate_first_name` / `validate_last_name`**: comparten un helper privado
`_validate_name(value, required_message, too_long_message)`: si `value` no es `str` → requerido; `cleaned =
value.strip()`; si `cleaned == ""` → requerido; si `len(cleaned) > MAX_NAME_CHARS` → demasiado largo; devuelve
`cleaned`. Se usa `str.strip()` (espacios Unicode de los extremos) y `len` (caracteres, no bytes), sin restringir el
juego de caracteres (Q3). Un nombre de 300 caracteres da 400 antes de llegar a la base (AC-003.7), así que no se
alcanza nunca el límite de la columna.

**`AuthService.login`**: sustituye las cuatro apariciones de `"Wrong Credentials"` por `WRONG_CREDENTIALS_MESSAGE`; el
resto no cambia (REQ-007). Los mensajes de Google quedan en inglés (fuera de alcance).

**`PasswordResetService.reset_password`** (REQ-009): la primera instrucción del método es `now = self.clock()`, antes
incluso de comprobar el token. `_ensure_link_is_usable(row, now)` compara `now - row.created_at >= TOKEN_TTL`; se
llama con el mismo `now` en la lectura sin bloqueo y en la relectura con `FOR UPDATE`, y `row.used_at = now`. Se
borra la llamada a `self.clock()` de antes del commit. `request_reset` no cambia (ya lee el reloj una vez).

**Utilidades reutilizadas:** `validate_email`, `validate_new_password` y `normalize_email` de
`services/credential_rules.py`; las reglas de fecha del perfil (extraídas, no duplicadas); `utc_now` de
`profile_service.py`; `ValidationError`, `ConflictError` y `AuthenticationError` de `exceptions/custom_exceptions.py`
con el `error_handlers.py` existente. No se toca `utils/`.

### 3.4 Interfaz de usuario

No aplica. El frontend (`frontend/src/features/auth`) ya muestra el texto de `error` que devuelve el servidor, así que
los mensajes nuevos aparecen sin cambios en él.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `auth_routes.register` con `get_json(silent=True)` → `AuthService.register_from_body` → `require_json_object` (`auth_input_rules.py`) |
| REQ-002 | `auth_routes.login` con `get_json(silent=True)` → `AuthService.login_from_body` → `require_json_object`; `{}` sigue en `login` (401) |
| REQ-003 | `validate_first_name` (`auth_input_rules.py`), llamado en `AuthService.register`; se guarda el valor recortado |
| REQ-004 | `validate_last_name` (`auth_input_rules.py`), llamado en `AuthService.register`; se guarda el valor recortado |
| REQ-005 | `parse_date_of_birth` (`date_of_birth_rules.py`, extraído de `profile_service.py`) con `self.clock().date()` en `AuthService.register`; la ruta ya no convierte la fecha |
| REQ-006 | Orden de las llamadas en `register_from_body` + `register` (§3.3): cuerpo, correo, contraseña, nombre, apellido, fecha y duplicado |
| REQ-007 | `WRONG_CREDENTIALS_MESSAGE` en `AuthService.login` |
| REQ-008 | `EMAIL_TAKEN_MESSAGE` en `AuthService.register` |
| REQ-009 | `PasswordResetService.reset_password` con un único `now` y `_ensure_link_is_usable(row, now)` |
| NFR-001 | Combinación de REQ-001 a REQ-008: ninguna rama de `/register` ni `/login` puede llegar a una excepción no controlada con datos del cliente (tipos comprobados con `isinstance` antes de usarlos; sin `fromisoformat` en la ruta) |

## 5. Estrategia de pruebas

**Ámbito backend.** Entorno: Postgres de prueba (`TEST_DATABASE_URL`, `docker compose up -d postgres redis`). Ningún
test toca Google, Resend ni Redis reales. Sin `unittest.mock` ni `monkeypatch` (Art. P1.3): el reloj y los
repositorios son fakes inyectados por constructor. Marcadores `# SDD: 018 REQ-… AC-…` (Art. P1.1); nombres en inglés,
docstrings en español.

**Unitarios — `backend/tests/test_services/test_auth_input_rules.py` (nuevo):**
- `require_json_object`: devuelve el dict tal cual; lanza `ValidationError` con `INVALID_REQUEST_MESSAGE` para `None`,
  lista, número, texto y booleano (AC-001.3, AC-001.4, AC-002.3, AC-002.4).
- `validate_first_name` / `validate_last_name`: ausente (`None`), número, lista, `""`, `"   "` → requerido; 101 y 300
  caracteres → demasiado largo; 100 caracteres con espacios alrededor → los 100 caracteres; `"  María José "` →
  `"María José"`; `" Pérez  "` → `"Pérez"` (AC-003.1 a AC-003.7, AC-004.1 a AC-004.5).

**Unitarios — `backend/tests/test_services/test_auth_service.py` (ampliado):**
- `make_service` gana un `FakeClock` (de `tests/fakes.py`) en el parámetro `clock`, con una fecha fija (p. ej.
  `datetime(2026, 10, 18, 12, 0)`), para probar las fronteras de edad sin depender del día real.
- `register` con fecha ausente, `None`, `""`, `19900101` (número), `"1990/01/01"`, `"no-es-fecha"` y `"2001-02-30"`
  → `INVALID_DOB_MESSAGE`; mañana → futura; 13 años (cumple mañana) y 101 años → rango; 14 años exactos y 100 años
  (cumple 101 mañana) → éxito con `repo.created[0].date_of_birth == date(...)` (AC-005.1 a AC-005.8).
- Nombre y apellido recortados en `repo.created[0]` (AC-003.5, AC-003.6, AC-004.5); un error de validación no crea
  cuenta ni consulta el repositorio (`repo.queried_emails == []`).
- Orden (AC-006.1 a AC-006.5), en particular que con la cuenta ya existente y sin fecha gana el 400 de fecha sin
  consultar duplicados.
- `register_from_body` / `login_from_body` con `None` y con lista → `INVALID_REQUEST_MESSAGE` sin consultar el
  repositorio; `login_from_body({})` → `AuthenticationError(WRONG_CREDENTIALS_MESSAGE)` (AC-002.5).
- Mensajes nuevos de login (AC-007.1 a AC-007.4, incluida la cuenta de Google sin `password_hash`) y de duplicado
  (AC-008.1, AC-008.2).

**Unitarios — `backend/tests/test_services/test_password_reset_service.py` (ampliado):**
- Doble nuevo en `backend/tests/fakes.py`:

  ```python
  class FakeSequenceClock:
      """Reloj que devuelve los instantes indicados en orden y, agotados, repite el último.
      `calls` cuenta cuántas veces se consultó."""
      def __init__(self, *instants): ...
      def __call__(self): ...
  ```

  Es un fake de test (no código de producción): lo escribe el `test-author` completo, sin esqueleto.
- AC-009.1 y AC-009.2: la fila del enlace se inserta directamente en `FakePasswordResetRepository.rows` como
  `PasswordResetRequest(email=…, client_ip=IP, user_id=user.id, token_hash=hash_token(token), created_at=T)` (así
  `request_reset` no consume instantes del reloj), y el servicio se construye con
  `FakeSequenceClock(T + 4 min, T + 6 min)` o `FakeSequenceClock(T + 5 min, T + 4 min)`. En AC-009.1 se comprueba el
  hash nuevo, el commit y `row.used_at == T + 4 min`; en AC-009.2, `INVALID_LINK` y el hash sin cambios. Se puede
  añadir `clock.calls == 1` como aserción complementaria de REQ-009.

**Integración — `backend/tests/test_routes/test_auth_routes.py` (ampliado), con el fixture `client`:**
- Cuerpos crudos con el test client de Flask: `client.post(url, data="hola", content_type="text/plain")`;
  `data='{"email": '` con `content_type="application/json"`; `data="null"` con `application/json` (ojo: `json=None`
  no envía cuerpo); `json=[register_payload()]`; `client.post(url)` sin cuerpo. Comprobar el 400 exacto y
  `count_users(app) == 0` donde el AC lo pide (AC-001.1 a AC-001.5, AC-002.1 a AC-002.4; en AC-002.1, sin `token` en
  la respuesta).
- AC-002.5: `post_login(client)` con `{}` → 401 con el mensaje nuevo.
- Nombre, apellido y fecha de extremo a extremo: mensajes exactos y `count_users(app) == 0` en los rechazos; en los
  éxitos, el valor guardado se lee con `db.session` dentro de un `with app.app_context()` breve (patrón de
  `count_users`), y en AC-005.8 además `GET /api/profile` con el token devuelve esa `date_of_birth`.
- Fechas relativas al día real en UTC: un helper `years_ago(n, days=0)` sobre `datetime.now(timezone.utc).date()` que
  trate el 29 de febrero (si `replace(year=…)` falla, usar el 28 de febrero o el 1 de marzo según el caso, de forma que
  el AC siga siendo cierto).
- Orden (AC-006.1 a AC-006.5) y mensajes nuevos (AC-007.1 a AC-007.4, AC-008.1, AC-008.2). Para AC-007.3, la cuenta de
  Google se inserta con `User(email=…, password_hash=None, google_id="g-1")` como `insert_legacy_user`.
- NFR-001 (AC-N001.1): un test parametrizado por endpoint y cuerpo con la batería del AC (no JSON, malformado, `null`,
  lista, número, texto, `{}`, y un objeto válido con cada campo sustituido por `123`, `None` y `[]`). Comprueba
  `status_code < 500`, que es 2xx/400/401/409, que los errores son exactamente `{"error": <str>}` y que el texto no
  contiene «Wrong Credentials», «Email already registered» ni «Content-Type».

**Tests existentes que cambian por mandato de la spec** (no es debilitarlos, Art. B5.3; lo hace el `test-author`):
- `test_auth_routes.py`: `WRONG_CREDENTIALS` y `DUPLICATE` pasan a los textos en español, y los docstrings que citan
  «Wrong Credentials».
- `test_auth_service.py`: `WRONG_CREDENTIALS`, la aserción `"Email already registered"` y el helper `register(...)`,
  que pasa `"1990-01-01"` en lugar de `date(1990, 1, 1)` (REQ-005 cambia el contrato de `date_of_birth`).
- El resto de suites que registran usuarios (`conftest.registered_user`, perfil, métricas, reset, coach) ya envían
  nombre, apellido y fecha válidos: no cambian.

**Tests que pueden pasar ya en verde antes de implementar** (comportamiento que el código actual cumple por
casualidad; son de no regresión y el `verifier` debe aceptarlos como tales): AC-005.6 y AC-005.8 en integración (hoy
se acepta cualquier fecha válida), y AC-009.2 (el código actual ya rechaza en la primera lectura del reloj). El resto
fallan por comportamiento ausente: mensajes nuevos, 400 en vez de 415/500 o del texto en inglés, nombres sin recortar
o validaciones inexistentes.

**Lint:** los archivos nuevos y modificados no deben añadir violaciones de ruff (ratchet, Art. B5.7).

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Extraer las reglas de fecha rompe el perfil, el análisis o las métricas (importan `age_on`, `utc_now` y constantes desde `profile_service`) | Baja | Medio | `profile_service.py` sigue exponiendo los mismos nombres; la suite existente de perfil y análisis lo cubre; el `reviewer` comprueba que `_validate` usa `parse_date_of_birth` sin cambiar el orden de sus mensajes |
| Tests de integración de edad inestables en el cambio de día UTC o el 29 de febrero | Baja | Bajo | Fronteras exactas en unitarios con `FakeClock`; en integración, helper de fechas relativas que trate el 29 de febrero |
| Un cliente externo que compare «Wrong Credentials» o «Email already registered» deja de reconocerlos | Baja | Bajo | Aceptado en la spec (§6, Compatibilidad): los códigos HTTP no cambian; el frontend muestra el texto tal cual |
| Que el registro empiece a rechazar datos que el formulario del frontend considera válidos (p. ej. edad < 14, nombre de solo espacios) | Media | Bajo | Es el comportamiento pedido; el frontend muestra el mensaje del servidor. Validarlo también en el cliente queda en el backlog |

## 7. Cumplimiento de la constitución

- **Art. B1 / B4 / B5:** cambio funcional con spec aprobada; cada AC tiene test en §5 con marcador `SDD: 018 …`;
  esqueletos con `NotImplementedError("not implemented")` para `auth_input_rules` y los dos métodos nuevos de
  `AuthService`, cuyo `__init__` guarda `clock` sin lanzar. Los cambios en tests existentes son los que impone la spec
  (mensajes y contrato de `date_of_birth`), no debilitamientos.
- **Art. P1:** unitarios con fakes inyectados por constructor (`FakeClock`, `FakeSequenceClock`, repositorios en
  memoria), sin `unittest.mock` ni `monkeypatch`; integración con `client` y Postgres de prueba; sin servicios externos.
- **Art. P2.1:** las rutas solo leen el cuerpo, llaman al servicio y serializan; la comprobación del cuerpo vive en el
  servicio (como hace `ProfileService` con `INVALID_BODY_MESSAGE`); solo `UnitOfWork` hace commit/rollback.
- **Art. P2.2:** el reloj de `AuthService` se inyecta por constructor con valor por defecto, igual que en
  `ProfileService` y `PasswordResetService`; `_build_auth_service` no cambia.
- **Art. P2.3:** los errores son `ValidationError`, `ConflictError` y `AuthenticationError`; ninguna ruta construye un
  error a mano.
- **Art. P2.4:** sin cambios de modelo, sin migración.
- **Art. P2.5:** se reutilizan `credential_rules.py` y las reglas de fecha del perfil (extraídas a un módulo común, no
  duplicadas).
- **Art. P2 General / P3.2:** mensajes en español correcto, sin voseo; toda la entrada del registro y del login se
  valida en el servicio con `ValidationError`.
- **Art. P3.1, P3.3–P3.5:** no hay endpoints nuevos, ni proveedores de IA, ni SQL a mano, ni variables nuevas.
- No queda ningún «DEBERÍA» sin cumplir.

## 8. ADRs

Ninguna. Extraer las reglas de fecha a un módulo compartido y leer el cuerpo con `get_json(silent=True)` siguen
patrones ya existentes en el proyecto (`credential_rules.py`, `/api/profile`, `/api/body-metrics`).
