import uuid

from flask import Blueprint, request, jsonify

from extensions import db
from repositories.exercise_category_repository import ExerciseCategoryRepository
from repositories.body_region_repository import BodyRegionRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.exercise_category_service import ExerciseCategoryService
from decorators import require_auth, require_admin
from exceptions.custom_exceptions import ValidationError

exercise_category_bp = Blueprint(
    "exercise_categories",
    __name__,
    url_prefix="/api/exercise-categories"
)


def _build_service():
    exercise_category_repository = ExerciseCategoryRepository(db.session)
    body_region_repository = BodyRegionRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return ExerciseCategoryService(exercise_category_repository, body_region_repository, unit_of_work)


#Mismo patron que list_exercises() en exercise_routes.py: body_region_id via query param
#filtra por region (navegacion nivel 2 del catalogo). Sin el param, devuelve TODAS las
#categorias activas - lo usa FavoritesPage para agrupar favoritos por categoria sin
#tener que conocer de antemano la region de cada uno.
@exercise_category_bp.route("", methods=["GET"])
@require_auth
def list_categories():
    body_region_id_str = request.args.get("body_region_id")

    service = _build_service()

    if not body_region_id_str:
        categories = service.list_all()
        return jsonify([{"id": category.id, "name": category.name} for category in categories]), 200

    try:
        body_region_id = uuid.UUID(body_region_id_str)
    except ValueError:
        raise ValidationError("body_region_id invalido")

    categories = service.list_by_region(body_region_id)

    return jsonify([{"id": category.id, "name": category.name} for category in categories]), 200


#Solo administradores pueden crear/borrar categorias - es catalogo compartido, no data del usuario.
@exercise_category_bp.route("", methods=["POST"])
@require_admin
def create_category():
    data = request.get_json()
    body_region_id_str = data.get("body_region_id")
    name = data.get("name")

    if not body_region_id_str or not name or not name.strip():
        raise ValidationError("body_region_id y name son obligatorios")

    try:
        body_region_id = uuid.UUID(body_region_id_str)
    except ValueError:
        raise ValidationError("body_region_id invalido")

    service = _build_service()
    category = service.create_category(body_region_id, name)

    return jsonify(id=category.id, name=category.name), 201


@exercise_category_bp.route("/<uuid:category_id>", methods=["DELETE"])
@require_admin
def delete_category(category_id):
    service = _build_service()
    service.delete_category(category_id)

    return "", 204
