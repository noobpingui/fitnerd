from datetime import timezone

from flask import Blueprint, g, jsonify, request

from decorators import require_auth
from extensions import db
from repositories.user_profile_repository import UserProfileRepository
from repositories.user_repository import UserRepository
from services.profile_service import ProfileService
from unit_of_work.unit_of_work import UnitOfWork

profile_bp = Blueprint(
    "profile",
    __name__,
    url_prefix="/api/profile"
)


def _build_profile_service():
    return ProfileService(
        UserRepository(db.session),
        UserProfileRepository(db.session),
        UnitOfWork(db.session),
    )


def _serialize(state):
    user, profile = state.user, state.profile
    completed_at = user.onboarding_completed_at
    return {
        "onboarding_completed": completed_at is not None,
        "onboarding_completed_at": (
            completed_at.replace(tzinfo=timezone.utc).isoformat(timespec="seconds")
            if completed_at is not None else None
        ),
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "profile": None if profile is None else {
            "gender": profile.gender,
            "height_unit": profile.height_unit,
            "height_cm": profile.height_cm,
            "height_ft": profile.height_ft,
            "height_in": profile.height_in,
            "weight_unit": profile.weight_unit,
            "weight": profile.weight,
            "activity_level": profile.activity_level,
            "goal": profile.goal,
        },
    }


@profile_bp.route("", methods=["GET"])
@require_auth
def get_profile():
    state = _build_profile_service().get_profile(g.decoded_token["id"])
    return jsonify(_serialize(state)), 200


@profile_bp.route("", methods=["PUT"])
@require_auth
def save_profile():
    data = request.get_json(silent=True)
    state = _build_profile_service().save_profile(g.decoded_token["id"], data)
    return jsonify(_serialize(state)), 200
