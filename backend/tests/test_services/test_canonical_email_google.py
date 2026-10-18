"""Test de la spec 019 (REQ-005) de Google Sign-In con Postgres real: con la
garantía de correo canónico activa (la crean los modelos con `create_all()`),
entrar con un token de Google con mayúsculas guarda la cuenta canónica.

La ruta `/api/auth/google` usa el verificador real de Google, así que el
servicio se construye a mano con fakes inyectados por constructor (JWT y
verificador de Google); el repositorio, la UnitOfWork y la base son reales.
"""

from sqlalchemy import select

from models.user import User
from repositories.user_repository import UserRepository
from services.auth_service import AuthService
from tests.migration_helpers import existing_canonical_email_checks
from unit_of_work.unit_of_work import UnitOfWork


class FakeJWTManager:
    def __init__(self):
        self.payloads = []

    def generate_token(self, payload, minutes):
        self.payloads.append(payload)
        return "token-de-mentira"


class FakeGoogleVerifier:
    def __init__(self, claims):
        self.claims = claims

    def __call__(self, id_token_str, client_id):
        return self.claims


# SDD: 019 REQ-005 AC-005.4
def test_google_first_login_stores_the_canonical_email_with_the_guarantee_active(db_session):
    """Token de Google con 'Ana@Example.com': se crea la cuenta 'ana@example.com'."""
    assert "ck_users_email_canonical" in existing_canonical_email_checks(db_session.connection())
    db_session.rollback()
    jwt_manager = FakeJWTManager()
    service = AuthService(
        UserRepository(db_session),
        UnitOfWork(db_session),
        jwt_manager,
        "client-id",
        google_token_verifier=FakeGoogleVerifier(
            {"email": "Ana@Example.com", "email_verified": True, "sub": "g-1"}
        ),
    )

    token = service.login_with_google("id-token")

    assert token == "token-de-mentira"
    assert db_session.scalars(select(User.email)).all() == ["ana@example.com"]
    assert jwt_manager.payloads[0]["user_role"] == "user"
