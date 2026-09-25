"""Test UNITARIO de HealthService: no toca Postgres, usa el fake
FakeHealthRepository inyectado por constructor. Los errores de SQLAlchemy
se construyen como instancias REALES (OperationalError, ProgrammingError)
para simular un fallo de conexion o de consulta sin depender de una base
real caida - la clase de la excepcion es lo unico que le importa al
servicio (SQLAlchemyError), no de donde viene.
"""

import pytest
from sqlalchemy.exc import OperationalError, ProgrammingError

from exceptions.custom_exceptions import ServiceUnavailableError
from services.health_service import HealthService


class FakeHealthRepository:
    """Doble de HealthRepository - no toca Postgres. `raise_error` es
    mutable entre llamadas, lo que permite simular que la base de datos
    se recupera a mitad de la prueba (AC-002.3)."""

    def __init__(self, raise_error=None):
        self.raise_error = raise_error
        self.calls = 0

    def ping(self):
        self.calls += 1
        if self.raise_error is not None:
            raise self.raise_error


# SDD: REQ-001 AC-001.2
def test_check_returns_exact_success_body_when_repository_succeeds():
    """Cuando el repositorio no lanza ningun error, el servicio devuelve
    exactamente el cuerpo de exito, sin campos adicionales."""
    service = HealthService(FakeHealthRepository())

    assert service.check() == {"status": "ok", "database": "ok"}


# SDD: REQ-002 AC-002.1
def test_check_raises_service_unavailable_when_connection_fails():
    """Un fallo de conexion (OperationalError) se traduce a
    ServiceUnavailableError con el mensaje fijo en espanol y codigo 503."""
    error = OperationalError(
        "SELECT 1",
        {},
        Exception(
            'connection to server at "db.interno.secreto" failed: '
            'password for user "usuario_secreto"'
        ),
    )
    service = HealthService(FakeHealthRepository(raise_error=error))

    with pytest.raises(ServiceUnavailableError) as exc_info:
        service.check()

    assert exc_info.value.message == "Base de datos no disponible"
    assert exc_info.value.status_code == 503


# SDD: REQ-002 AC-002.2
def test_check_raises_service_unavailable_when_query_fails():
    """Un fallo al ejecutar la consulta de comprobacion (ProgrammingError)
    tambien se traduce a ServiceUnavailableError, igual que un fallo de
    conexion."""
    error = ProgrammingError("SELECT 1", {}, Exception("fallo simulado de consulta"))
    service = HealthService(FakeHealthRepository(raise_error=error))

    with pytest.raises(ServiceUnavailableError) as exc_info:
        service.check()

    assert exc_info.value.message == "Base de datos no disponible"
    assert exc_info.value.status_code == 503


# SDD: REQ-002 AC-002.3
def test_check_does_not_cache_a_previous_failure():
    """Tras un primer fallo, si la base de datos vuelve a responder, la
    siguiente llamada devuelve exito: el resultado no queda cacheado."""
    error = OperationalError("SELECT 1", {}, Exception("fallo simulado"))
    fake_repository = FakeHealthRepository(raise_error=error)
    service = HealthService(fake_repository)

    with pytest.raises(ServiceUnavailableError):
        service.check()

    fake_repository.raise_error = None
    result = service.check()

    assert result == {"status": "ok", "database": "ok"}
    assert fake_repository.calls == 2


# SDD: NFR-001 AC-N001.1
def test_check_does_not_leak_internal_error_details():
    """El mensaje de ServiceUnavailableError es fijo: nunca incluye texto
    identificable del error original (usuario, host o credenciales)."""
    error = OperationalError(
        "SELECT 1",
        {},
        Exception(
            'connection to server at "db.interno.secreto" failed: '
            'password for user "usuario_secreto"'
        ),
    )
    service = HealthService(FakeHealthRepository(raise_error=error))

    with pytest.raises(ServiceUnavailableError) as exc_info:
        service.check()

    assert exc_info.value.message == "Base de datos no disponible"
    assert "usuario_secreto" not in exc_info.value.message
    assert "db.interno.secreto" not in exc_info.value.message
