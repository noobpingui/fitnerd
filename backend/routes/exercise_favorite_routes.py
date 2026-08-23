from flask import Blueprint, jsonify, g

from extensions import db
from repositories.exercise_favorite_repository import ExerciseFavoriteRepository
from repositories.exercise_repository import ExerciseRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.exercise_favorite_service import ExerciseFavoriteService
from decorators import require_auth

#Standalone (no anidado bajo /api/exercises) porque este listado no gira en torno a
#un exercise_id puntual - es "mis favoritos", un recurso propio del usuario.
exercise_favorite_bp = Blueprint(
    "exercise_favorites",
    __name__,
    url_prefix="/api/favorites"
)


def _build_service():
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


@exercise_favorite_bp.route("", methods=["GET"])
@require_auth
def list_favorites():
    user_id = g.decoded_token["id"]

    service = _build_service()
    exercises = service.list_favorites(user_id)

    return jsonify([_serialize(exercise) for exercise in exercises]), 200
