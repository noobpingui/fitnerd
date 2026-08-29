from flask import Blueprint, request, jsonify, g

from extensions import db
from repositories.feedback_repository import FeedbackRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.feedback_service import FeedbackService
from decorators import require_auth

feedback_bp = Blueprint(
    "feedback",
    __name__,
    url_prefix="/api/feedback"
)


def _build_feedback_service():
    feedback_repository = FeedbackRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return FeedbackService(feedback_repository, unit_of_work)


def _serialize(feedback):
    return {
        "id": feedback.id,
        "category": feedback.category,
        "message": feedback.message,
        "created_at": feedback.created_at.isoformat(),
    }


@feedback_bp.route("", methods=["POST"])
@require_auth
def create():
    data = request.get_json()
    user_id = g.decoded_token["id"]

    feedback_service = _build_feedback_service()
    feedback = feedback_service.create_feedback(
        user_id=user_id,
        category=data.get("category"),
        message=data.get("message"),
    )

    return jsonify(_serialize(feedback)), 201
