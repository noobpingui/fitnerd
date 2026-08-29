from flask import Blueprint, request, jsonify

from extensions import db
from repositories.body_region_repository import BodyRegionRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.body_region_service import BodyRegionService
from decorators import require_auth, require_admin
from exceptions.custom_exceptions import ValidationError

body_region_bp = Blueprint(
    "body_regions",
    __name__,
    url_prefix="/api/body-regions"
)


def _build_service():
    body_region_repository = BodyRegionRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return BodyRegionService(body_region_repository, unit_of_work)


@body_region_bp.route("", methods=["GET"])
@require_auth
def list_regions():
    service = _build_service()
    regions = service.list_regions()

    return jsonify([{"id": region.id, "name": region.name} for region in regions]), 200


#Solo administradores pueden crear/borrar regiones - es catalogo compartido, no data del usuario.
@body_region_bp.route("", methods=["POST"])
@require_admin
def create_region():
    data = request.get_json()
    name = data.get("name")

    if not name or not name.strip():
        raise ValidationError("El nombre de la region es obligatorio")

    service = _build_service()
    region = service.create_region(name)

    return jsonify(id=region.id, name=region.name), 201


@body_region_bp.route("/<uuid:region_id>", methods=["DELETE"])
@require_admin
def delete_region(region_id):
    service = _build_service()
    service.delete_region(region_id)

    return "", 204
