from flask import Blueprint, jsonify

from extensions import db
from repositories.health_repository import HealthRepository
from services.health_service import HealthService

health_bp = Blueprint(
    "health",
    __name__,
    url_prefix="/api/health"
)


def _build_health_service():
    health_repository = HealthRepository(db.session)
    return HealthService(health_repository)


#Público y de solo lectura: sin decoradores de auth (REQ-003).
@health_bp.route("", methods=["GET"])
def health():
    service = _build_health_service()
    result = service.check()

    return jsonify(result), 200
