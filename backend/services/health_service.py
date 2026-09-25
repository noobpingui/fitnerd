import logging

from sqlalchemy.exc import SQLAlchemyError

from exceptions.custom_exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)

DATABASE_UNAVAILABLE_MESSAGE = "Base de datos no disponible"


class HealthService:

    def __init__(self, health_repository):
        self.health_repository = health_repository

    def check(self) -> dict:
        try:
            self.health_repository.ping()
        except SQLAlchemyError as exc:
            #El mensaje es fijo y nunca interpola str(exc) para no filtrar detalles (NFR-001).
            #El detalle solo queda en el log del servidor, nunca en la respuesta.
            logger.warning("Chequeo de salud: base de datos no disponible", exc_info=True)
            raise ServiceUnavailableError(DATABASE_UNAVAILABLE_MESSAGE) from exc

        return {"status": "ok", "database": "ok"}
