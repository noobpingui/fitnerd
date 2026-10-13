from flask import Blueprint, request, jsonify, g, current_app

from extensions import db
from repositories.body_metric_repository import BodyMetricRepository
from repositories.progress_analysis_repository import ProgressAnalysisRepository
from repositories.user_profile_repository import UserProfileRepository
from repositories.user_repository import UserRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.body_metric_service import BodyMetricService
from services.progress_analysis_service import ProgressAnalysisService
from utils.llm_client import LLMClient
from decorators import require_auth

body_metric_bp = Blueprint(
    "body_metrics",
    __name__,
    url_prefix="/api/body-metrics"
)


def _build_body_metric_service():
    body_metric_repository = BodyMetricRepository(db.session)
    user_repository = UserRepository(db.session)
    user_profile_repository = UserProfileRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return BodyMetricService(
        body_metric_repository, user_repository, user_profile_repository, unit_of_work
    )


#Mismo patron que _build_coach_service() en coach_routes.py.
def _build_progress_analysis_service():
    body_metric_repository = BodyMetricRepository(db.session)
    progress_analysis_repository = ProgressAnalysisRepository(db.session)
    user_repository = UserRepository(db.session)
    user_profile_repository = UserProfileRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    llm_client = LLMClient(model=current_app.config["ANTHROPIC_MODEL"])
    return ProgressAnalysisService(
        body_metric_repository,
        progress_analysis_repository,
        user_repository,
        user_profile_repository,
        unit_of_work,
        llm_client,
    )


def _serialize(metric):
    return {
        "id": metric.id,
        "weight": metric.weight,
        "body_fat_percentage": metric.body_fat_percentage,
        "muscle_mass_percentage": metric.muscle_mass_percentage,
        "notes": metric.notes,
        "recorded_at": metric.recorded_at.isoformat(),
    }


def _serialize_suggestion(suggestion):
    if suggestion is None:
        return None
    return {
        "kind": suggestion.kind,
        "target_kcal": suggestion.target_kcal,
        "suggested_kcal": suggestion.suggested_kcal,
        "adjustment_kcal": suggestion.adjustment_kcal,
        "floor_kcal": suggestion.floor_kcal,
    }


@body_metric_bp.route("", methods=["POST"])
@require_auth
def create():
    data = request.get_json(silent=True)
    user_id = g.decoded_token["id"]

    body_metric_service = _build_body_metric_service()
    result = body_metric_service.save_metric(user_id, data)

    return jsonify(_serialize(result.metric)), (201 if result.created else 200)


@body_metric_bp.route("/<uuid:metric_id>", methods=["PUT"])
@require_auth
def update(metric_id):
    data = request.get_json(silent=True)
    user_id = g.decoded_token["id"]

    body_metric_service = _build_body_metric_service()
    metric = body_metric_service.update_metric(user_id, metric_id, data)

    return jsonify(_serialize(metric)), 200


@body_metric_bp.route("", methods=["GET"])
@require_auth
def list_metrics():
    user_id = g.decoded_token["id"]

    body_metric_service = _build_body_metric_service()
    metrics = body_metric_service.list_metrics(user_id)

    return jsonify([_serialize(metric) for metric in metrics]), 200


@body_metric_bp.route("/analysis", methods=["POST"])
@require_auth
def analyze():
    user_id = g.decoded_token["id"]

    data = request.get_json(silent=True)

    progress_analysis_service = _build_progress_analysis_service()
    result = progress_analysis_service.analyze(user_id, data)

    return (
        jsonify(
            analysis=result.analysis,
            calorie_suggestion=_serialize_suggestion(result.calorie_suggestion),
        ),
        200,
    )


@body_metric_bp.route("/<uuid:metric_id>", methods=["DELETE"])
@require_auth
def delete(metric_id):
    user_id = g.decoded_token["id"]

    body_metric_service = _build_body_metric_service()
    body_metric_service.delete_metric(user_id, metric_id)

    return "", 204
