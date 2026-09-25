# Tareas 001 — Endpoint de salud del backend con chequeo de base de datos

- **Plan:** [plan.md](plan.md) (aprobado el 2026-09-25)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos.
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: primero las tareas (scaffold), que las ejecuta el implementer en modo scaffold (solo firmas que lanzan
  "not implemented", ADR-0012); después todas las tareas (test), que las ejecuta el test-author;
  después las tareas impl, migration y config en orden de dependencia, que las ejecuta el implementer.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
<!-- La ruta HTTP no se andamia: sin registrar, un 404 en cualquier método (incluido POST) es rojo legítimo
     (ADR-0012, plan §5). Solo se andaman los símbolos nuevos que los tests van a importar. -->
- [x] T-001 [REQ-001, REQ-002] (scaffold) Crear `HealthRepository.__init__(self, session)` y `HealthRepository.ping(self) -> None` que lancen `NotImplementedError`, sin lógica — `backend/repositories/health_repository.py`
- [x] T-002 [REQ-001, REQ-002] (scaffold) Crear `HealthService.__init__(self, health_repository)` y `HealthService.check(self) -> dict` que lancen `NotImplementedError`, sin lógica — `backend/services/health_service.py`

## Fase A — Tests (test-author)

### Unitarios de servicio (`backend/tests/test_services/test_health_service.py`)
- [x] T-010 [REQ-001, AC-001.2] (test) Definir el fake local `FakeHealthRepository(raise_error=None)` con contador `calls`, e implementar el test de éxito: `HealthService(fake).check() == {"status": "ok", "database": "ok"}` — `backend/tests/test_services/test_health_service.py`
- [x] T-011 [REQ-002, AC-002.1] (test) Test: fake que lanza `OperationalError` de conexión hace que `check()` lance `ServiceUnavailableError` con `message == "Base de datos no disponible"` y `status_code == 503` — `backend/tests/test_services/test_health_service.py`
- [x] T-012 [REQ-002, AC-002.2] (test) Test: fake que lanza `ProgrammingError` de consulta hace que `check()` lance `ServiceUnavailableError` con el mismo mensaje y código — `backend/tests/test_services/test_health_service.py`
- [x] T-013 [REQ-002, AC-002.3] (test) Test: primera llamada con `raise_error` puesto lanza `ServiceUnavailableError`; tras poner `raise_error = None`, la segunda llamada devuelve el dict de éxito y `fake.calls == 2` (sin caché) — `backend/tests/test_services/test_health_service.py`
- [x] T-014 [NFR-001, AC-N001.1] (test) Test: fake que lanza un error cuyo mensaje contiene textos identificables (p. ej. `"usuario_secreto"`, `"db.interno.secreto"`) hace que `exc.message` sea exactamente `"Base de datos no disponible"` y no contenga esos textos — `backend/tests/test_services/test_health_service.py`

### Integración de rutas (`backend/tests/test_routes/test_health_routes.py`)
- [x] T-015 [REQ-001, AC-001.1, AC-001.2] (test) Test: con la base de datos disponible, `GET /api/health` devuelve `200`, `Content-Type` `application/json` y cuerpo exacto `{"status": "ok", "database": "ok"}` — `backend/tests/test_routes/test_health_routes.py`
- [x] T-016 [REQ-003, AC-003.1] (test) Test: `GET /api/health` sin cabecera `Authorization` devuelve `200` — `backend/tests/test_routes/test_health_routes.py`
- [x] T-017 [REQ-003, AC-003.2] (test) Test: `GET /api/health` con `Authorization: Bearer token-invalido` devuelve `200` (el token se ignora) — `backend/tests/test_routes/test_health_routes.py`
- [x] T-018 [REQ-004, AC-004.1] (test) Test: `POST /api/health` devuelve `405` con cuerpo JSON de única clave `error` y valor de texto no vacío — `backend/tests/test_routes/test_health_routes.py`
- [x] T-019 [NFR-002, AC-N002.1] (test) Test: sembrar filas conocidas, contar filas de todas las tablas (`_db.metadata.sorted_tables`) antes y después de `GET /api/health`, y comprobar que no cambian — `backend/tests/test_routes/test_health_routes.py`
- [x] T-020 [REQ-002] (test) Crear la fixture `break_database(app)` con `yield`, que registra/retira listeners de `sqlalchemy.event` (`do_connect`, `before_cursor_execute`) sobre `db.engine` y hace `event.remove` + `db.engine.dispose()` en el teardown, antes que `_clean_database` — `backend/tests/test_routes/test_health_routes.py`
- [x] T-021 [REQ-002, NFR-001, AC-002.1, AC-N001.1] (test) Test con `break_database`: fallo de conexión (`do_connect` lanza `OperationalError` con una cadena de conexión ficticia) hace que `GET /api/health` devuelva `503`, cuerpo exacto `{"error": "Base de datos no disponible"}` y sin los textos ficticios en el cuerpo — `backend/tests/test_routes/test_health_routes.py`
- [x] T-022 [REQ-002, AC-002.2] (test) Test con `break_database`: fallo de consulta (`before_cursor_execute` lanza `ProgrammingError`) hace que `GET /api/health` devuelva `503` con el cuerpo exacto — `backend/tests/test_routes/test_health_routes.py`
- [x] T-023 [REQ-002, AC-002.3] (test) Test con `break_database`: primera petición con el listener de conexión activo devuelve `503`; tras `event.remove`, la siguiente petición devuelve `200` con el cuerpo de éxito (sin caché) — `backend/tests/test_routes/test_health_routes.py`

## Fase B — Implementación (implementer)
- [x] T-030 [REQ-001, REQ-002, NFR-002] (impl) Implementar `HealthRepository.ping()`: ejecutar `self.session.execute(text("SELECT 1"))` sin `add`, `flush` ni `commit`, y sin capturar excepciones — `backend/repositories/health_repository.py`
- [x] T-031 [REQ-001, REQ-002, NFR-001] (impl) Implementar `HealthService.check()`: llamar a `health_repository.ping()`, capturar `SQLAlchemyError` y relanzar `ServiceUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc` con log `logging.getLogger(__name__).warning(...)`, o devolver `{"status": "ok", "database": "ok"}` si no falla — `backend/services/health_service.py`
- [x] T-032 [REQ-001, REQ-003, REQ-004] (impl) Crear `health_bp = Blueprint("health", __name__, url_prefix="/api/health")` con la vista `GET` que llama a `_build_health_service().check()` y devuelve `jsonify(result), 200`, sin decoradores de auth — `backend/routes/health_routes.py`
- [x] T-033 [REQ-001, REQ-003] (config) Importar `health_bp` y registrar `app.register_blueprint(health_bp)` — `backend/routes/__init__.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-015 | T-030, T-031, T-032 |
| REQ-001 | AC-001.2 | T-010, T-015 | T-030, T-031, T-032 |
| REQ-002 | AC-002.1 | T-011, T-021 | T-030, T-031 |
| REQ-002 | AC-002.2 | T-012, T-022 | T-030, T-031 |
| REQ-002 | AC-002.3 | T-013, T-023 | T-030, T-031 |
| REQ-003 | AC-003.1 | T-016 | T-032, T-033 |
| REQ-003 | AC-003.2 | T-017 | T-032, T-033 |
| REQ-004 | AC-004.1 | T-018 | T-032, T-033 |
| NFR-001 | AC-N001.1 | T-014, T-021 | T-031 |
| NFR-002 | AC-N002.1 | T-019 | T-030 |
