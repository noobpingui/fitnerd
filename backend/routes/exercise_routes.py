import uuid

from flask import Blueprint, request, jsonify, g

from extensions import db
from repositories.exercise_repository import ExerciseRepository
from repositories.exercise_category_repository import ExerciseCategoryRepository
from repositories.exercise_favorite_repository import ExerciseFavoriteRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.exercise_service import ExerciseService
from services.exercise_favorite_service import ExerciseFavoriteService
from decorators import require_auth, require_admin
from exceptions.custom_exceptions import ValidationError

exercise_bp = Blueprint(
    "exercises",
    __name__,
    url_prefix="/api/exercises"
)


def _build_service():
    exercise_repository = ExerciseRepository(db.session)
    exercise_category_repository = ExerciseCategoryRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return ExerciseService(exercise_repository, exercise_category_repository, unit_of_work)


def _build_favorite_service():
    exercise_favorite_repository = ExerciseFavoriteRepository(db.session)
    exercise_repository = ExerciseRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return ExerciseFavoriteService(exercise_favorite_repository, exercise_repository, unit_of_work)


def _serialize(exercise):
    return {
        "id": exercise.id,
        "category_id": exercise.category_id,
        "name": exercise.name,
        "video_url": exercise.video_url,
    }


#Listamos por categoria via query param (?category_id=...) en vez de anidar la ruta bajo
#/exercise-categories/<id>/exercises - mantiene cada blueprint autocontenido en su propio recurso.
@exercise_bp.route("", methods=["GET"])
@require_auth
def list_exercises():
    category_id_str = request.args.get("category_id")

    if not category_id_str:
        raise ValidationError("Debe indicar category_id")

    try:
        category_id = uuid.UUID(category_id_str)
    except ValueError:
        raise ValidationError("category_id invalido")

    service = _build_service()
    exercises = service.list_by_category(category_id)

    return jsonify([_serialize(exercise) for exercise in exercises]), 200


@exercise_bp.route("", methods=["POST"])
@require_admin
def create_exercise():
    data = request.get_json()

    category_id_str = data.get("category_id")
    name = data.get("name")
    video_url = data.get("video_url")

    if not category_id_str or not name or not video_url:
        raise ValidationError("category_id, name y video_url son obligatorios")

    try:
        category_id = uuid.UUID(category_id_str)
    except ValueError:
        raise ValidationError("category_id invalido")

    service = _build_service()
    exercise = service.create_exercise(category_id, name, video_url)

    return jsonify(_serialize(exercise)), 201


@exercise_bp.route("/<uuid:exercise_id>", methods=["DELETE"])
@require_admin
def delete_exercise(exercise_id):
    service = _build_service()
    service.delete_exercise(exercise_id)

    return "", 204


@exercise_bp.route("/<uuid:exercise_id>/favorites", methods=["POST"])
@require_auth
def add_favorite(exercise_id):
    user_id = g.decoded_token["id"]

    service = _build_favorite_service()
    service.add_favorite(user_id, exercise_id)

    return "", 201


@exercise_bp.route("/<uuid:exercise_id>/favorites", methods=["DELETE"])
@require_auth
def remove_favorite(exercise_id):
    user_id = g.decoded_token["id"]

    service = _build_favorite_service()
    service.remove_favorite(user_id, exercise_id)

    return "", 204
