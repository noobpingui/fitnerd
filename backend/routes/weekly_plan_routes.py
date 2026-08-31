from flask import Blueprint, request, jsonify, g

from extensions import db
from repositories.weekly_plan_repository import WeeklyPlanRepository
from repositories.exercise_repository import ExerciseRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.weekly_plan_service import WeeklyPlanService
from decorators import require_auth
from exceptions.custom_exceptions import ValidationError

#Standalone (no anidado bajo /api/exercises), mismo criterio que
#exercise_favorite_routes.py: es "mi planificacion semanal", un recurso
#propio del usuario que combina un exercise_id con un dia de la semana.
weekly_plan_bp = Blueprint(
    "weekly_plan",
    __name__,
    url_prefix="/api/weekly-plan"
)


def _build_service():
    weekly_plan_repository = WeeklyPlanRepository(db.session)
    exercise_repository = ExerciseRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return WeeklyPlanService(weekly_plan_repository, exercise_repository, unit_of_work)


def _serialize(entry):
    return {
        "id": entry.id,
        "exercise_id": entry.exercise_id,
        "day_of_week": entry.day_of_week,
    }


@weekly_plan_bp.route("", methods=["GET"])
@require_auth
def list_plan():
    user_id = g.decoded_token["id"]

    service = _build_service()
    entries = service.list_plan(user_id)

    return jsonify([_serialize(entry) for entry in entries]), 200


@weekly_plan_bp.route("", methods=["POST"])
@require_auth
def add_entry():
    user_id = g.decoded_token["id"]
    data = request.get_json()

    exercise_id = data.get("exercise_id")
    day_of_week = data.get("day_of_week")

    if not exercise_id:
        raise ValidationError("exercise_id es obligatorio")
    #isinstance(x, int) con bool excluido a mano: en Python bool es subclase de int
    #(True == 1), asi que sin este chequeo un {"day_of_week": true} colaria como valido.
    if not isinstance(day_of_week, int) or isinstance(day_of_week, bool):
        raise ValidationError("day_of_week es obligatorio y debe ser un numero")

    service = _build_service()
    entry = service.add_entry(user_id, exercise_id, day_of_week)

    return jsonify(_serialize(entry)), 201


@weekly_plan_bp.route("/<uuid:entry_id>", methods=["DELETE"])
@require_auth
def remove_entry(entry_id):
    user_id = g.decoded_token["id"]

    service = _build_service()
    service.remove_entry(user_id, entry_id)

    return "", 204
