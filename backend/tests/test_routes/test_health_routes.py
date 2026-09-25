"""Tests de integracion de GET /api/health: ejercitan el flujo completo
route -> service -> repository -> Postgres real. Los casos de fallo de
base de datos enganchan listeners de sqlalchemy.event sobre db.engine (API
publica y documentada, no un mock) para forzar un fallo real de conexion o
de consulta sin necesitar apagar Postgres de verdad.

Hasta que la ruta no este registrada (Fase B), TODAS estas peticiones,
incluido el POST, devuelven 404 - rojo legitimo segun ADR-0012 y el plan
(seccion 5): la ruta no se andamia, solo el servicio y el repositorio.
"""

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.exc import OperationalError, ProgrammingError

from extensions import db as _db
from models import BodyRegion

FAKE_CONNECTION_ERROR_TEXT = (
    'connection to server at "db.interno.secreto" failed: '
    'password for user "usuario_secreto"'
)


@pytest.fixture
def break_database(app):
    """Simula una base de datos caida enganchando listeners de eventos de
    SQLAlchemy sobre `db.engine`. Devuelve un par (activate, heal):
    `activate(modo)` registra el listener correspondiente ("connection" o
    "query"), y `heal()` lo retira y libera el pool - el propio test la usa
    para probar la recuperacion (AC-002.3).

    El teardown de esta fixture SIEMPRE llama a `heal()`, y como se pide
    DESPUES que las fixtures autouse en la resolucion de dependencias de
    pytest, su teardown corre ANTES que el de `_clean_database`
    (conftest.py) - si quedara un listener activo, la limpieza de tablas
    del siguiente test rompiria contra una base "caida".
    """
    with app.app_context():
        engine = _db.engine

    registered = {}

    def _fail_connect(dialect, conn_rec, cargs, cparams):
        raise OperationalError(None, None, Exception(FAKE_CONNECTION_ERROR_TEXT))

    def _fail_query(conn, cursor, statement, parameters, context, executemany):
        raise ProgrammingError("SELECT 1", {}, Exception("fallo simulado de consulta"))

    def activate(mode):
        if mode == "connection":
            engine.dispose()  # vacia el pool para forzar una conexion nueva
            event.listen(engine, "do_connect", _fail_connect)
            registered["event"] = "do_connect"
            registered["listener"] = _fail_connect
        elif mode == "query":
            event.listen(engine, "before_cursor_execute", _fail_query)
            registered["event"] = "before_cursor_execute"
            registered["listener"] = _fail_query
        else:
            raise ValueError(f"Modo desconocido: {mode}")

    def heal():
        event_name = registered.get("event")
        listener = registered.get("listener")
        if event_name and event.contains(engine, event_name, listener):
            event.remove(engine, event_name, listener)
        registered.clear()
        engine.dispose()

    yield activate, heal

    heal()


# SDD: REQ-001 AC-001.1
def test_health_returns_200_with_json_content_type_when_database_is_up(client):
    """Con la base de datos disponible, GET /api/health responde 200 con
    Content-Type application/json."""
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.mimetype == "application/json"


# SDD: REQ-001 AC-001.2
def test_health_returns_exact_success_body_when_database_is_up(client):
    """El cuerpo de exito contiene exactamente las claves status y
    database, ambas en "ok", sin campos adicionales."""
    response = client.get("/api/health")

    assert response.get_json() == {"status": "ok", "database": "ok"}


# SDD: REQ-003 AC-003.1
def test_health_is_reachable_without_an_authorization_header(client):
    """El endpoint es publico: no exige la cabecera Authorization."""
    response = client.get("/api/health")

    assert response.status_code == 200


# SDD: REQ-003 AC-003.2
def test_health_ignores_an_invalid_authorization_token(client):
    """Un token invalido no bloquea la peticion: el endpoint no lo evalua."""
    response = client.get("/api/health", headers={"Authorization": "Bearer token-invalido"})

    assert response.status_code == 200


# SDD: REQ-004 AC-004.1
def test_health_rejects_post_with_405_and_standard_error_body(client):
    """Un metodo distinto de GET/HEAD responde 405 con el formato estandar
    de error del backend: un objeto JSON cuya unica clave es "error"."""
    response = client.post("/api/health")

    assert response.status_code == 405
    body = response.get_json()
    assert set(body.keys()) == {"error"}
    assert isinstance(body["error"], str) and body["error"].strip()


# SDD: NFR-002 AC-N002.1
def test_health_check_does_not_change_row_counts(client, db_session):
    """El chequeo de salud es de solo lectura: contar filas de todas las
    tablas antes y despues de GET /api/health debe dar el mismo resultado."""
    region = BodyRegion(name="Region de prueba para health check")
    db_session.add(region)
    db_session.commit()

    tables = _db.metadata.sorted_tables
    counts_before = {
        table.name: db_session.execute(select(func.count()).select_from(table)).scalar()
        for table in tables
    }

    response = client.get("/api/health")

    counts_after = {
        table.name: db_session.execute(select(func.count()).select_from(table)).scalar()
        for table in tables
    }

    assert response.status_code == 200
    assert counts_after == counts_before


# SDD: REQ-002 AC-002.1
def test_health_returns_503_when_database_connection_fails(client, break_database):
    """Un fallo al abrir la conexion (do_connect) se traduce a 503 con el
    cuerpo de error estandar, y no filtra la cadena de conexion ficticia."""
    activate, _heal = break_database

    activate("connection")

    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.get_json() == {"error": "Base de datos no disponible"}
    body_text = response.get_data(as_text=True)
    assert "usuario_secreto" not in body_text
    assert "db.interno.secreto" not in body_text


# SDD: REQ-002 AC-002.2
def test_health_returns_503_when_database_query_fails(client, break_database):
    """Un fallo al ejecutar la consulta (before_cursor_execute), con la
    conexion abierta con exito, tambien responde 503 con el cuerpo exacto."""
    activate, _heal = break_database

    activate("query")

    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.get_json() == {"error": "Base de datos no disponible"}


# SDD: REQ-002 AC-002.3
def test_health_recovers_after_the_connection_listener_is_removed(client, break_database):
    """Tras un primer 503 por fallo de conexion, quitar el listener con
    event.remove hace que la siguiente peticion vuelva a responder 200 -
    el resultado no queda cacheado."""
    activate, heal = break_database

    activate("connection")
    failing_response = client.get("/api/health")

    heal()  # llama a event.remove(...) y libera el pool
    recovered_response = client.get("/api/health")

    assert failing_response.status_code == 503
    assert recovered_response.status_code == 200
    assert recovered_response.get_json() == {"status": "ok", "database": "ok"}
