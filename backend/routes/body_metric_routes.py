from datetime import date

from flask import Blueprint, request, jsonify, g, current_app

from extensions import db
from repositories.body_metric_repository import BodyMetricRepository
from repositories.progress_analysis_repository import ProgressAnalysisRepository
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
    unit_of_work = UnitOfWork(db.session)
    return BodyMetricService(body_metric_repository, unit_of_work)


#Mismo patron que _build_coach_service() en coach_routes.py.
def _build_progress_analysis_service():
    body_metric_repository = BodyMetricRepository(db.session)
    progress_analysis_repository = ProgressAnalysisRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    llm_client = LLMClient(model=current_app.config["ANTHROPIC_MODEL"])
    return ProgressAnalysisService(
        body_metric_repository,
        progress_analysis_repository,
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


@body_metric_bp.route("", methods=["POST"])
@require_auth
def create():
    data = request.get_json()
    user_id = g.decoded_token["id"]

    recorded_at_str = data.get("recorded_at")
    recorded_at = date.fromisoformat(recorded_at_str) if recorded_at_str else date.today()

    body_metric_service = _build_body_metric_service()
    metric = body_metric_service.create_metric(
        user_id=user_id,
        weight=data.get("weight"),
        body_fat_percentage=data.get("body_fat_percentage"),
        muscle_mass_percentage=data.get("muscle_mass_percentage"),
        notes=data.get("notes"),
        recorded_at=recorded_at,
    )

    return jsonify(_serialize(metric)), 201


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

    progress_analysis_service = _build_progress_analysis_service()
    analysis = progress_analysis_service.analyze(user_id)

    return jsonify(analysis=analysis), 200


@body_metric_bp.route("/<uuid:metric_id>", methods=["DELETE"])
@require_auth
def delete(metric_id):
    user_id = g.decoded_token["id"]

    body_metric_service = _build_body_metric_service()
    body_metric_service.delete_metric(user_id, metric_id)

    return "", 204
