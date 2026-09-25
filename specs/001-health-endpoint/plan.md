# Plan 001 — Endpoint de salud del backend con chequeo de base de datos

- **Spec:** [spec.md](spec.md) (aprobada el 2026-09-25)
- **Estado:** borrador

## 1. Resumen de la solución
Se añade un endpoint público `GET /api/health` que respeta las capas `routes → services → repositories`:
- Un blueprint nuevo, `health_bp`, con el prefijo `/api/health`. Se registra en `routes/__init__.py`.
- Un `HealthService` que recibe por constructor un `HealthRepository`. El repositorio ejecuta `SELECT 1` con `text()` sobre `db.session`.
- Si la comprobación falla con cualquier `SQLAlchemyError`, el servicio lanza `ServiceUnavailableError("Base de datos no disponible")`. El `error_handlers.py` que ya existe la traduce a `503 {"error": "..."}`, sin ningún detalle interno.
- El `405` sale gratis del manejador de `HTTPException` que ya existe.

No hay cambios de modelo, ni migración, ni frontend.

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | No hay cambios de esquema (spec §3) |
| backend · repositories | `backend/repositories/health_repository.py` | — | Acceso a datos: la consulta trivial `SELECT 1` (REQ-001, REQ-002, NFR-002) |
| backend · services | `backend/services/health_service.py` | — | Traduce un fallo de la BD a `ServiceUnavailableError` sin filtrar detalles (REQ-001, REQ-002, NFR-001) |
| backend · routes | `backend/routes/health_routes.py` | `backend/routes/__init__.py` (import de `health_bp` y `app.register_blueprint(health_bp)`) | Endpoint público de solo lectura (REQ-001 a REQ-004) |
| backend · tests | `backend/tests/test_services/test_health_service.py`, `backend/tests/test_routes/test_health_routes.py` | — | Estrategia de pruebas (§5) |
| backend · exceptions | — | — | Se reutiliza `ServiceUnavailableError` (503) de `exceptions/custom_exceptions.py` |
| frontend · features/<x> | — | — | Fuera de alcance (spec §3) |

## 3. Diseño
### 3.1 Modelo de datos y migraciones
No aplica. No hay tablas ni columnas nuevas, así que tampoco hay migración Alembic.

### 3.2 Contratos de API
| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| `GET` (y `HEAD`, que Flask añade automáticamente) | `/api/health` | Ninguna (sin `@require_auth`; la cabecera `Authorization` se ignora) | Sin parámetros ni cuerpo | `200` `{"status": "ok", "database": "ok"}` con `Content-Type: application/json` (vía `jsonify`) | `503` `{"error": "Base de datos no disponible"}` si falla la conexión o la consulta · `405` `{"error": "<descripción de werkzeug>"}` para cualquier otro método (manejador `HTTPException` existente) |

Detalles de la ruta:
- `Blueprint("health", __name__, url_prefix="/api/health")`.
- Una sola vista, `@health_bp.route("", methods=["GET"])`, igual que en `body_region_routes.py`, así que la URL final es `/api/health`.
- No lleva decoradores de auth. En `app.py` no hay `before_request` global, así que un token inválido nunca se evalúa (AC-003.2).

### 3.3 Lógica de negocio
**`HealthRepository`** (`backend/repositories/health_repository.py`):
- `__init__(self, session)`: guarda la sesión. No hereda de `BaseRepository` porque no tiene un modelo asociado.
- `ping(self) -> None`: ejecuta `self.session.execute(text("SELECT 1"))`.
  - Es una sentencia literal y constante, sin concatenar input (Art. 7.5).
  - No hace `add`, `flush` ni `commit`, así que no tiene efectos secundarios (NFR-002).
  - No captura excepciones: las de SQLAlchemy suben al servicio.

**`HealthService`** (`backend/services/health_service.py`):
- `__init__(self, health_repository)`: dependencia inyectada por constructor (Art. 6.2).
  - **No** recibe `UnitOfWork`, porque no hay escrituras que confirmar.
  - La transacción de solo lectura la cierra el `session.remove()` del teardown de Flask-SQLAlchemy, igual que en los servicios de solo lectura actuales (`BodyRegionService.list_regions`).
- Constante de módulo `DATABASE_UNAVAILABLE_MESSAGE = "Base de datos no disponible"`.
- `check(self) -> dict`:
  1. Llama a `self.health_repository.ping()`.
  2. Si lanza `sqlalchemy.exc.SQLAlchemyError` (que incluye `OperationalError`, `ProgrammingError` y `DBAPIError`, es decir, los fallos de conexión y de consulta), hace `raise ServiceUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc`.
     - El mensaje es fijo y **nunca** interpola `str(exc)` (NFR-001).
     - El detalle solo se registra en el log del servidor con `logging.getLogger(__name__).warning("Health check: base de datos no disponible", exc_info=True)`. El log no forma parte de la respuesta.
  3. Si no falla, devuelve `{"status": "ok", "database": "ok"}`.
  - No guarda estado entre llamadas ni cachea resultados (AC-002.3). Además, la ruta construye un servicio nuevo en cada petición.
- Las excepciones que no son de SQLAlchemy no se capturan. Llegan al manejador genérico, que responde `500 {"error": "Internal server error"}` y tampoco filtra detalles.

**Ruta** (`backend/routes/health_routes.py`):
- `_build_health_service()` devuelve `HealthService(HealthRepository(db.session))`, siguiendo el patrón `_build_*_service()` (Art. 6.2).
- La vista `health()` llama a `_build_health_service().check()` y devuelve `jsonify(result), 200`.
- No construye errores a mano (Art. 6.3).

### 3.4 Frontend
No aplica. El endpoint no lo consume el frontend (spec §3 y §6). No hay páginas, hooks, claves de query ni schemas zod.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `HealthRepository.ping()` (`SELECT 1`), `HealthService.check()` devuelve `{"status": "ok", "database": "ok"}` y `health_routes.health()` responde con `jsonify(...)`, `200` |
| REQ-002 | `HealthService.check()` captura `SQLAlchemyError` (conexión o consulta) y lanza `ServiceUnavailableError("Base de datos no disponible")`. `error_handlers.handle_app_error` lo traduce a `503`. No hay caché y el servicio se crea en cada petición (AC-002.3) |
| REQ-003 | `health_routes.py`: la vista no lleva `@require_auth` ni `@require_admin`, y no hay un `before_request` global |
| REQ-004 | `methods=["GET"]` en la vista. Werkzeug lanza `MethodNotAllowed` y `error_handlers.handle_http_exception` responde `405 {"error": description}` |
| NFR-001 | Mensaje fijo en `HealthService` (sin `str(exc)`), `raise ... from exc` solo para trazabilidad en el log, y el manejador `AppError` serializa únicamente `error.message` |
| NFR-002 | `HealthRepository.ping()` solo ejecuta `SELECT 1`. El servicio no recibe `UnitOfWork` y no hay `commit` |

## 5. Estrategia de pruebas

### Andamiaje (ADR-0012)
`tasks.md` debe incluir tareas `(scaffold)` para `backend/repositories/health_repository.py` y `backend/services/health_service.py`:
- Solo llevan las firmas `__init__`, `ping` y `check`, con cuerpo `raise NotImplementedError`.
- La constante `DATABASE_UNAVAILABLE_MESSAGE` **no** se incluye en el esqueleto. Los tests usan el literal de la spec.
- La ruta **no** se andamia ni se registra antes del red check.
  - Con la ruta sin registrar, todas las peticiones a `/api/health`, incluido `POST`, devuelven `404`, que es rojo legítimo según ADR-0012.
  - Si se registrara un esqueleto con `methods=["GET"]`, AC-004.1 pasaría en el rojo y el verifier lo marcaría como FAIL.

### Tests unitarios de servicio
Archivo: `backend/tests/test_services/test_health_service.py`. No usa Postgres.
- Fake nuevo, **local al archivo** (según la convención de `fakes.py`, los fakes de repositorio se definen en cada test): `FakeHealthRepository(raise_error=None)`.
  - Tiene un atributo `calls` (contador).
  - `ping()` incrementa `calls` y, si `raise_error` no es `None`, lo lanza.
  - Como `raise_error` es mutable, se puede cambiar entre llamadas (AC-002.3).
- Errores de prueba: se construyen instancias reales de `sqlalchemy.exc`.
  - Ejemplo: `OperationalError("SELECT 1", {}, Exception("connection to server at \"db.interno.secreto\" failed: password for user \"usuario_secreto\""))`.
  - Para el fallo de consulta: `ProgrammingError("SELECT 1", {}, Exception("..."))`.

| AC | Caso | Aserción clave |
|---|---|---|
| AC-001.2 | Fake sin error | `service.check() == {"status": "ok", "database": "ok"}` (igualdad exacta del dict) |
| AC-002.1 | Fake con `OperationalError` de conexión | `pytest.raises(ServiceUnavailableError)`, con `exc.message == "Base de datos no disponible"` y `exc.status_code == 503` |
| AC-002.2 | Fake con `ProgrammingError` de consulta | Igual que AC-002.1 |
| AC-002.3 | Primera llamada con error y después `fake.raise_error = None` | La primera llamada lanza `ServiceUnavailableError`, la segunda devuelve el dict de éxito y `fake.calls == 2` (no hay caché) |
| AC-N001.1 | Error cuyo mensaje contiene `"usuario_secreto"` y `"db.interno.secreto"` | `exc.message` es exactamente `"Base de datos no disponible"` y no contiene esos textos |

### Tests de integración de rutas
Archivo: `backend/tests/test_routes/test_health_routes.py`. Necesitan Postgres: `docker compose up -d postgres`.

**Casos con la base de datos disponible** (fixture `client`):

| AC | Aserción clave |
|---|---|
| AC-001.1 | `GET /api/health`: `status_code == 200` y `response.mimetype == "application/json"` |
| AC-001.2 | `response.get_json() == {"status": "ok", "database": "ok"}` |
| AC-003.1 | Sin cabecera `Authorization`: `200` |
| AC-003.2 | `headers={"Authorization": "Bearer token-invalido"}`: `200` |
| AC-004.1 | `POST /api/health`: `405`, `set(body.keys()) == {"error"}` e `isinstance(body["error"], str) and body["error"].strip()` |
| AC-N002.1 | Sembrar al menos una fila, por ejemplo con la fixture `registered_user` o con un `BodyRegion` vía `db_session` y `commit()`. Contar filas de **todas** las tablas de `_db.metadata.sorted_tables` con `select(func.count()).select_from(table)` antes y después del `GET`. Los recuentos son iguales |

**Casos con la base de datos caída** (AC-002.1, AC-002.2, AC-002.3 y AC-N001.1 a nivel HTTP):
- Se simula el fallo con la **API pública de eventos de SQLAlchemy** (`sqlalchemy.event.listen` y `event.remove`) sobre `db.engine`, sin `unittest.mock` ni `monkeypatch` (ver la justificación en §7).
- Hay que obtener `db.engine` dentro de un `with app.app_context():` breve. El listener queda en el objeto engine, así que sigue activo después de cerrar el contexto.
- **Fallo de conexión (AC-002.1 y AC-N001.1):**
  1. `db.engine.dispose()` vacía el pool, para que la petición tenga que abrir una conexión nueva.
  2. Se registra un listener `"do_connect"` que lanza `sqlalchemy.exc.OperationalError(None, None, Exception("postgresql://usuario_secreto:clave_secreta@db.interno.secreto:5432/fitnerd"))`.
  3. Se comprueba `503`, `get_json() == {"error": "Base de datos no disponible"}` y que `response.get_data(as_text=True)` no contiene `"usuario_secreto"`, `"clave_secreta"` ni `"db.interno.secreto"`.
- **Fallo de consulta (AC-002.2):** se registra un listener `"before_cursor_execute"` que lanza `sqlalchemy.exc.ProgrammingError("SELECT 1", {}, Exception("fallo simulado"))`. La conexión se abre bien y falla la ejecución. Se comprueba `503` con el cuerpo exacto.
- **Recuperación (AC-002.3):**
  1. Con el listener de `do_connect` activo, la petición devuelve `503`.
  2. Se hace `event.remove(...)` en el propio test.
  3. Una segunda petición devuelve `200` con el cuerpo de éxito.
- **Por qué se lanza la excepción de SQLAlchemy directamente, y no una de psycopg2:** así el servicio la recibe como `SQLAlchemyError` sin depender de si SQLAlchemy envuelve o no las excepciones de cada evento.
- **Limpieza obligatoria:** se hace en una fixture con `yield`, por ejemplo `break_database(app)`, que devuelve una función para activar cada modo.
  - En el teardown ejecuta `event.remove` (si el listener sigue registrado, con `event.contains`) y `db.engine.dispose()`.
  - Esta fixture se pide después que las autouse, así que su teardown corre **antes** que el de `_clean_database`. De lo contrario, la limpieza de tablas fallaría y contaminaría el resto de la suite.
  - Estos tests **no** deben pedir `db_session`, porque mantendría abierto un app context durante las peticiones.

**Marcadores:** cada test lleva en la línea anterior a `def test_...` el marcador `# SDD: REQ-00X AC-00X.Y` (o `# SDD: NFR-00X AC-N00X.Y`). Los nombres van en inglés y describen el comportamiento, por ejemplo `test_health_returns_503_when_database_connection_fails`. Docstrings y comentarios en español.

**RTL:** no aplica, porque no hay frontend.

**Fakes nuevos en `backend/tests/fakes.py`:** ninguno. `FakeHealthRepository` va local en el test unitario.

**Suite completa (Art. 9):** `.venv/Scripts/python.exe -m pytest -q` en `backend/` y el ratchet de ruff (`node .claude/sdd/scripts/ruff-new.mjs`).

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Los listeners de eventos sobre `db.engine` no se retiran y rompen el resto de la suite (la fixture compartida `app` es de scope `session`) | Media | Alto | Fixture con `yield` que hace `event.remove` y `dispose()` en el teardown, y que se ejecuta antes que el de `_clean_database` (§5) |
| El pool reutiliza una conexión ya abierta y el listener de `do_connect` no se dispara, así que el test de fallo de conexión da `200` | Media | Medio | `db.engine.dispose()` antes de activar el modo de fallo de conexión (§5) |
| AC-004.1 pasa en el red check si la ruta se andamia y se registra con `methods=["GET"]` | Media | Medio (FAIL del red check) | No andamiar ni registrar la ruta antes del red check: el `404` es rojo legítimo (ADR-0012, §5) |
| Filtrar detalles de la excepción si alguien interpola `str(exc)` en el mensaje | Baja | Alto (NFR-001) | Mensaje constante en el servicio y tests de no-fuga a nivel de servicio y de HTTP (AC-N001.1) |
| El endpoint público puede recibir mucho tráfico y abrir conexiones | Baja | Bajo | Consulta trivial sobre el pool existente. El rate limiting está fuera de alcance según la spec (§3) |

## 7. Cumplimiento de la constitución
- **Art. 1:** el cambio pasa por el flujo SDD (spec 001 aprobada el 2026-09-25).
- **Art. 4:** los 4 REQ y los 2 NFR están mapeados (§4), y sus 10 AC tienen al menos un test previsto con marcador `# SDD:` (§5).
- **Art. 5.2 y ADR-0012:** hay esqueletos para el servicio y el repositorio. La ruta no se registra hasta implementar, así que el rojo es legítimo test a test.
- **Art. 5.4:** los tests unitarios usan el fake `FakeHealthRepository`, inyectado por constructor. Ningún test llama a servicios externos.
  - **Justificación:** los tests de integración simulan la caída de Postgres con `sqlalchemy.event.listen`/`event.remove`. Es una API pública y documentada de SQLAlchemy para enganchar comportamiento al engine, no un parche de atributos. No se usa `unittest.mock` ni `monkeypatch`.
  - Se deja constancia aquí por transparencia, porque el efecto (forzar un fallo) se parece al de un doble. Es la única forma de ejercitar el `503` de punta a punta sin añadir a producción un punto de inyección solo para tests.
- **Art. 6.1 y 6.2:** capas `routes → services → repositories`, con el repositorio inyectado por constructor y construido en `_build_health_service()`. `UnitOfWork` no aplica, porque no hay escrituras ni commits.
- **Art. 6.3:** el `503` sale de `ServiceUnavailableError` y el `405` del manejador `HTTPException`. Ningún error se construye a mano en la ruta.
- **Art. 6.4:** no hay cambios de modelo, así que no hace falta migración.
- **Art. 6.5:** el código nuevo no debe introducir violaciones de ruff.
- **Art. 6.11:** el mensaje del `503` va en español correcto ("Base de datos no disponible"). El texto del `405` es el de werkzeug, en inglés, y cambiarlo queda fuera de alcance por decisión explícita de la spec (§3).
- **Art. 7.2:** el endpoint no expone datos de usuario, así que no requiere `@require_auth` (spec Q4).
- **Art. 7.4:** no llama a proveedores de IA, así que el rate limiting obligatorio no aplica.
- **Art. 7.5:** `text("SELECT 1")` es literal y constante, sin concatenar input.
- **Art. 7.1:** no hay secretos ni variables de entorno nuevas.
- **Art. 8:** se trabaja en la rama `feat/001-health-endpoint`. Parte de `chore/sdd-harness` como excepción de la prueba en seco, registrada en `state.json`.
- **"DEBERÍA" incumplidos:** ninguno.

## 8. ADRs
Ninguna. El endpoint reutiliza las capas, excepciones y manejadores existentes. Simular fallos de la BD con eventos de SQLAlchemy es una técnica de test local a esta feature, justificada en §7, y no una decisión de arquitectura.
