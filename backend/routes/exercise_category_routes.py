from flask import Blueprint, request, jsonify

from extensions import db
from repositories.exercise_category_repository import ExerciseCategoryRepository
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
    unit_of_work = UnitOfWork(db.session)
    return ExerciseCategoryService(exercise_category_repository, unit_of_work)


@exercise_category_bp.route("", methods=["GET"])
@require_auth
def list_categories():
    service = _build_service()
    categories = service.list_categories()

    return jsonify([{"id": category.id, "name": category.name} for category in categories]), 200


#Solo administradores pueden crear/borrar categorias - es catalogo compartido, no data del usuario.
@exercise_category_bp.route("", methods=["POST"])
@require_admin
def create_category():
    data = request.get_json()
    name = data.get("name")

    if not name or not name.strip():
        raise ValidationError("El nombre de la categoria es obligatorio")

    service = _build_service()
    category = service.create_category(name)

    return jsonify(id=category.id, name=category.name), 201


@exercise_category_bp.route("/<uuid:category_id>", methods=["DELETE"])
@require_admin
def delete_category(category_id):
    service = _build_service()
    service.delete_category(category_id)

    return "", 204
