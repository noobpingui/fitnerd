from datetime import date

from flask import Blueprint, request, jsonify, g, current_app

from extensions import db, jwt_manager
from repositories.user_repository import UserRepository
from unit_of_work.unit_of_work import UnitOfWork
from services.auth_service import AuthService
from decorators import require_auth

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)
#Factory function: a helper whose purpose is to hand back a fully-dependency-loaded AuthService
def _build_auth_service():
    user_repository = UserRepository(db.session)
    unit_of_work = UnitOfWork(db.session)
    return AuthService(user_repository, unit_of_work, jwt_manager, current_app.config["GOOGLE_CLIENT_ID"])


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    auth_service = _build_auth_service()

    token = auth_service.register(
        email=data.get("email"),
        password=data.get("password"),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        date_of_birth=date.fromisoformat(data.get("date_of_birth")), #Format: "YYYY-MM-DD"
    )

    return jsonify({"token": token}), 201

@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    auth_service = _build_auth_service()

    token = auth_service.login(
        email=data.get("email"),
        password=data.get("password")
    )

    return jsonify({"token": token}), 200

@auth_bp.route("/google", methods=["POST"])
def google_login():

    data = request.get_json()

    auth_service = _build_auth_service()

    #credential: el ID token que Google Identity Services le entrega al
    #frontend despues de que el usuario elige su cuenta de Google.
    token = auth_service.login_with_google(data.get("credential"))

    return jsonify({"token": token}), 200

@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():

    user_id = g.decoded_token["id"]

    auth_service = _build_auth_service()

    user = auth_service.get_me(user_id)

    return jsonify(
        id=user.id,
        email=user.email,
        avatar_url=user.avatar_url
    ), 200