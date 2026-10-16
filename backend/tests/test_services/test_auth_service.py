"""Unitarios de AuthService (spec 014). El repositorio de usuarios, el gestor
JWT, el verificador de Google y la UnitOfWork son fakes escritos a mano e
inyectados por constructor: no hay Postgres ni llamadas a Google.
"""

import uuid
from datetime import date

import bcrypt
import pytest

from exceptions.custom_exceptions import (
    AuthenticationError,
    ConflictError,
    ValidationError,
)
from models.user import User, UserRoles
from services.auth_service import AuthService
from tests.fakes import FakeUnitOfWork

PASSWORD = "Clave123"
INVALID_EMAIL = "Email inválido"
TOO_SHORT = "La contraseña debe tener al menos 8 caracteres"
WRONG_CREDENTIALS = "Wrong Credentials"


class FakeUserRepository:
    """Guarda usuarios en memoria. `queried_emails` registra el argumento de
    cada `get_by_email`; la comparación es exacta (los correos guardados ya
    están en minúsculas tras la migración), así que solo encuentra la cuenta
    si el servicio normaliza el correo antes de consultar. `create` asigna id y rol, porque los valores por defecto
    del modelo solo existen tras el flush."""

    def __init__(self, users=None):
        self.users = list(users or [])
        self.queried_emails = []
        self.created = []

    def get_by_email(self, email):
        self.queried_emails.append(email)
        for user in self.users:
            if user.email == email:
                return user
        return None

    def create(self, user):
        if user.id is None:
            user.id = uuid.uuid4()
        if user.user_role is None:
            user.user_role = UserRoles.user
        self.users.append(user)
        self.created.append(user)
        return user


class FakeJWTManager:
    def __init__(self):
        self.payloads = []

    def generate_token(self, payload, minutes):
        self.payloads.append(payload)
        return "token-de-mentira"


class FakeGoogleVerifier:
    """Invocable: devuelve `claims` o lanza ValueError si `claims` es None."""

    def __init__(self, claims=None):
        self.claims = claims
        self.calls = []

    def __call__(self, id_token_str, client_id):
        self.calls.append((id_token_str, client_id))
        if self.claims is None:
            raise ValueError("token no válido")
        return self.claims


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("utf-8")


def make_user(email, password=PASSWORD, google_id=None):
    return User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password) if password is not None else None,
        first_name="Ana",
        last_name="Pérez",
        date_of_birth=date(1990, 1, 1),
        google_id=google_id,
        user_role=UserRoles.user,
    )


def make_service(users=None, verifier=None):
    repo = FakeUserRepository(users)
    uow = FakeUnitOfWork()
    jwt = FakeJWTManager()
    service = AuthService(
        repo, uow, jwt, "client-id", google_token_verifier=verifier or FakeGoogleVerifier()
    )
    return service, repo, uow, jwt


def register(service, email="ana@example.com", password=PASSWORD):
    return service.register(email, password, "Ana", "Pérez", date(1990, 1, 1))


# ---------------------------------------------------------------- registro

# SDD: 014 REQ-001 AC-001.1
def test_register_stores_the_normalized_email():
    """El registro guarda el correo sin espacios y en minúsculas."""
    service, repo, uow, _ = make_service()

    token = register(service, email="  Ana@Example.COM ")

    assert token == "token-de-mentira"
    assert repo.created[0].email == "ana@example.com"
    assert uow.committed is True


# SDD: 014 REQ-001 AC-001.1
def test_register_looks_up_duplicates_with_the_normalized_email():
    """La comprobación de duplicados usa el correo ya normalizado."""
    service, repo, _, _ = make_service()

    register(service, email="  Ana@Example.COM ")

    assert repo.queried_emails == ["ana@example.com"]


# SDD: 014 REQ-001 AC-001.2
def test_register_rejects_a_duplicate_email_ignoring_case():
    """Un correo que solo se diferencia en mayúsculas da ConflictError y no crea cuenta."""
    service, repo, uow, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(ConflictError) as exc_info:
        register(service, email="ANA@example.com")

    assert str(exc_info.value) == "Email already registered"
    assert repo.created == []
    assert uow.rolled_back is True


# SDD: 014 REQ-006 AC-006.10
def test_register_validates_the_password_before_checking_duplicates():
    """Con cuenta existente y contraseña corta gana el error de contraseña y no se consulta el duplicado."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(ValidationError) as exc_info:
        register(service, email="ana@example.com", password="corta")

    assert str(exc_info.value) == TOO_SHORT
    assert repo.queried_emails == []


# SDD: 014 REQ-007 AC-007.3
def test_register_validates_the_email_before_the_password():
    """Con correo inválido y contraseña corta gana 'Email inválido'."""
    service, repo, _, _ = make_service()

    with pytest.raises(ValidationError) as exc_info:
        register(service, email="no-es-un-correo", password="corta")

    assert str(exc_info.value) == INVALID_EMAIL
    assert repo.created == []


# SDD: 014 REQ-007 AC-007.3
def test_register_rejects_a_missing_email_without_creating_the_account():
    """Un correo ausente da 'Email inválido', no un error interno."""
    service, repo, _, _ = make_service()

    with pytest.raises(ValidationError) as exc_info:
        register(service, email=None)

    assert str(exc_info.value) == INVALID_EMAIL
    assert repo.created == []


# ---------------------------------------------------------------- login

# SDD: 014 REQ-002 AC-002.1
def test_login_finds_the_account_with_an_uppercase_email():
    """Un correo con mayúsculas inicia sesión y se consulta ya normalizado."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    token = service.login("ANA@Example.com", PASSWORD)

    assert token == "token-de-mentira"
    assert repo.queried_emails == ["ana@example.com"]


# SDD: 014 REQ-002 AC-002.2
def test_login_finds_the_account_with_surrounding_spaces():
    """Un correo con espacios alrededor inicia sesión y se consulta sin ellos."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    token = service.login(" ana@example.com  ", PASSWORD)

    assert token == "token-de-mentira"
    assert repo.queried_emails == ["ana@example.com"]


# SDD: 014 REQ-009 AC-009.1
def test_login_rejects_a_password_over_72_bytes_without_querying():
    """Una contraseña de 73 bytes da 'Wrong Credentials' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", "a" * 73)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.2
def test_login_rejects_a_missing_password_without_querying():
    """Sin contraseña (None) da 'Wrong Credentials' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", None)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.3
def test_login_rejects_a_missing_email_without_querying():
    """Sin correo (None) da 'Wrong Credentials' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login(None, PASSWORD)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.4
def test_login_rejects_a_non_text_email_without_querying():
    """Un correo numérico da 'Wrong Credentials' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login(123, PASSWORD)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.5
def test_login_rejects_a_non_text_password_without_querying():
    """Una contraseña numérica da 'Wrong Credentials' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", 12345678)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# ---------------------------------------------------------------- Google

# SDD: 014 REQ-004 AC-004.1
def test_google_login_links_the_existing_account_with_an_uppercase_email():
    """El correo de Google en mayúsculas vincula la cuenta existente sin crear otra."""
    existing = make_user("ana@example.com")
    verifier = FakeGoogleVerifier(
        {"email": "Ana@Example.com", "email_verified": True, "sub": "g-1", "given_name": "Ana"}
    )
    service, repo, uow, _ = make_service([existing], verifier=verifier)

    token = service.login_with_google("credencial")

    assert token == "token-de-mentira"
    assert repo.created == []
    assert len(repo.users) == 1
    assert existing.google_id == "g-1"
    assert uow.committed is True
    assert verifier.calls == [("credencial", "client-id")]


# SDD: 014 REQ-004 AC-004.2
def test_google_login_creates_the_account_with_a_lowercase_email():
    """Una cuenta nueva desde Google se guarda con el correo en minúsculas."""
    verifier = FakeGoogleVerifier(
        {"email": "Nuevo@Example.com", "email_verified": True, "sub": "g-2", "given_name": "Nu"}
    )
    service, repo, _, _ = make_service(verifier=verifier)

    service.login_with_google("credencial")

    assert [u.email for u in repo.created] == ["nuevo@example.com"]
    assert repo.queried_emails == ["nuevo@example.com"]
