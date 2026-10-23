"""Unitarios de AuthService (spec 014). El repositorio de usuarios, el gestor
JWT, el verificador de Google y la UnitOfWork son fakes escritos a mano e
inyectados por constructor: no hay Postgres ni llamadas a Google.
"""

import uuid
from datetime import date, datetime, timedelta

import bcrypt
import pytest

from exceptions.custom_exceptions import (
    AuthenticationError,
    ConflictError,
    ValidationError,
)
from models.user import User, UserRoles
from services.auth_service import AuthService
from tests.fakes import FakeClock, FakeUnitOfWork

PASSWORD = "Clave123"
INVALID_EMAIL = "Email inválido"
TOO_SHORT = "La contraseña debe tener al menos 8 caracteres"
WRONG_CREDENTIALS = "Correo o contraseña incorrectos"
EMAIL_TAKEN = "Ya existe una cuenta con este correo"
INVALID_REQUEST = "La petición no es válida"
FIRST_NAME_REQUIRED = "El nombre es obligatorio"
LAST_NAME_REQUIRED = "El apellido es obligatorio"
INVALID_DOB = "La fecha de nacimiento no es válida"
FUTURE_DOB = "La fecha de nacimiento no puede ser futura"
AGE_RANGE = "Debes tener entre 14 y 100 años"
NOW = datetime(2026, 10, 18, 12, 0)
TODAY = NOW.date()


class FakeUserRepository:
    """Guarda usuarios en memoria. `queried_emails` registra el argumento de
    cada `get_by_email`; la comparación es exacta (los correos guardados ya
    están en minúsculas tras la migración), así que solo encuentra la cuenta
    si el servicio normaliza el correo antes de consultar. `create` asigna id y rol,
    porque los valores por defecto del modelo solo existen tras el flush."""

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
        repo,
        uow,
        jwt,
        "client-id",
        google_token_verifier=verifier or FakeGoogleVerifier(),
        clock=FakeClock(NOW),
    )
    return service, repo, uow, jwt


def register(
    service,
    email="ana@example.com",
    password=PASSWORD,
    first_name="Ana",
    last_name="Pérez",
    date_of_birth="1990-01-01",
):
    return service.register(email, password, first_name, last_name, date_of_birth)


def years_before_today(years, extra_days=0):
    """Fecha ISO de quien cumple `years` años exactos hoy (más `extra_days` días
    de nacido después: positivo la acerca al siguiente cumpleaños)."""
    born = date(TODAY.year - years, TODAY.month, TODAY.day) + timedelta(days=extra_days)
    return born.isoformat()


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

    assert str(exc_info.value) == EMAIL_TAKEN
    assert repo.created == []
    assert uow.rolled_back is True


# SDD: 014 REQ-006 AC-006.10
def test_register_validates_the_password_before_checking_duplicates():
    """Con cuenta existente y contraseña corta gana el error de contraseña."""
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
    """Una contraseña de 73 bytes da credenciales incorrectas sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", "a" * 73)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.2
def test_login_rejects_a_missing_password_without_querying():
    """Sin contraseña (None) da 'Correo o contraseña incorrectos' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", None)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.3
def test_login_rejects_a_missing_email_without_querying():
    """Sin correo (None) da 'Correo o contraseña incorrectos' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login(None, PASSWORD)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.4
def test_login_rejects_a_non_text_email_without_querying():
    """Un correo numérico da 'Correo o contraseña incorrectos' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login(123, PASSWORD)

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 014 REQ-009 AC-009.5
def test_login_rejects_a_non_text_password_without_querying():
    """Una contraseña numérica da 'Correo o contraseña incorrectos' sin consultar el repositorio."""
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


# ---------------------------------------------------------------- spec 018

def assert_rejected(service, repo, message, **register_kwargs):
    """El registro lanza ValidationError con `message`, sin consultar duplicados ni crear cuenta."""
    with pytest.raises(ValidationError) as exc_info:
        register(service, **register_kwargs)

    assert str(exc_info.value) == message
    assert repo.queried_emails == []
    assert repo.created == []


# SDD: 018 REQ-005 AC-005.1
def test_register_rejects_a_missing_date_of_birth():
    """Fecha de nacimiento ausente (None): 'La fecha de nacimiento no es válida'."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, INVALID_DOB, date_of_birth=None)


# SDD: 018 REQ-005 AC-005.2
@pytest.mark.parametrize("value", ["", 19900101, "1990/01/01", "no-es-fecha", [], {}])
def test_register_rejects_a_date_of_birth_with_a_wrong_format_or_type(value):
    """Vacía, numérica o con formato erróneo: 'no es válida', sin cuenta."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, INVALID_DOB, date_of_birth=value)


# SDD: 018 REQ-005 AC-005.3
def test_register_rejects_a_date_of_birth_that_does_not_exist():
    """'2001-02-30' no existe: 'La fecha de nacimiento no es válida'."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, INVALID_DOB, date_of_birth="2001-02-30")


# SDD: 018 REQ-005 AC-005.4
def test_register_rejects_a_future_date_of_birth():
    """Mañana (según el reloj inyectado): 'no puede ser futura'."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, FUTURE_DOB, date_of_birth="2026-10-19")


# SDD: 018 REQ-005 AC-005.5
def test_register_rejects_someone_who_turns_14_tomorrow():
    """13 años cumplidos hoy (cumple 14 mañana): 'Debes tener entre 14 y 100 años'."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, AGE_RANGE, date_of_birth=years_before_today(14, 1))


# SDD: 018 REQ-005 AC-005.7
def test_register_rejects_someone_of_101_years():
    """101 años cumplidos hoy: 'Debes tener entre 14 y 100 años'."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, AGE_RANGE, date_of_birth=years_before_today(101))


# SDD: 018 REQ-005 AC-005.6
def test_register_accepts_exactly_14_years_and_stores_a_date():
    """Cumple 14 hoy: se acepta y la fecha se guarda como `date`."""
    service, repo, uow, _ = make_service()

    token = register(service, date_of_birth=years_before_today(14))

    assert token == "token-de-mentira"
    assert repo.created[0].date_of_birth == date(2012, 10, 18)
    assert isinstance(repo.created[0].date_of_birth, date)
    assert uow.committed is True


# SDD: 018 REQ-005 AC-005.8
def test_register_accepts_100_years_that_turn_101_tomorrow():
    """100 años cumplidos hoy (cumple 101 mañana): se acepta."""
    service, repo, _, _ = make_service()

    register(service, date_of_birth=years_before_today(101, 1))

    assert repo.created[0].date_of_birth == date(1925, 10, 19)


# SDD: 018 REQ-003 AC-003.5 AC-003.6 REQ-004 AC-004.5
def test_register_stores_the_trimmed_first_and_last_names():
    """El nombre y el apellido se guardan sin los espacios de los extremos."""
    service, repo, _, _ = make_service()

    register(service, first_name="  María José ", last_name=" Pérez  ")

    assert repo.created[0].first_name == "María José"
    assert repo.created[0].last_name == "Pérez"


# SDD: 018 REQ-003 AC-003.1 AC-003.2 AC-003.3 AC-003.4 AC-003.7
@pytest.mark.parametrize(
    "value, message",
    [
        (None, FIRST_NAME_REQUIRED),
        ("   ", FIRST_NAME_REQUIRED),
        (123, FIRST_NAME_REQUIRED),
        ("a" * 101, "El nombre no puede superar los 100 caracteres"),
        ("a" * 300, "El nombre no puede superar los 100 caracteres"),
    ],
)
def test_register_rejects_an_invalid_first_name(value, message):
    """Un nombre ausente, en blanco, numérico o demasiado largo no crea cuenta."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, message, first_name=value)


# SDD: 018 REQ-004 AC-004.1 AC-004.2 AC-004.3 AC-004.4
@pytest.mark.parametrize(
    "value, message",
    [
        (None, LAST_NAME_REQUIRED),
        ("", LAST_NAME_REQUIRED),
        (123, LAST_NAME_REQUIRED),
        ("a" * 101, "El apellido no puede superar los 100 caracteres"),
    ],
)
def test_register_rejects_an_invalid_last_name(value, message):
    """Un apellido ausente, vacío, numérico o demasiado largo no crea cuenta."""
    service, repo, _, _ = make_service()

    assert_rejected(service, repo, message, last_name=value)


# SDD: 018 REQ-006 AC-006.1
def test_register_validates_the_email_before_the_first_name():
    """Correo inválido y sin nombre: gana 'Email inválido'.

    El nombre ausente se rechaza por sí solo.
    """
    service, repo, _, _ = make_service()
    assert_rejected(service, repo, FIRST_NAME_REQUIRED, first_name=None)

    assert_rejected(service, repo, INVALID_EMAIL, email="no-es-un-correo", first_name=None)


# SDD: 018 REQ-006 AC-006.2
def test_register_validates_the_password_before_the_first_name():
    """Contraseña corta y sin nombre: gana el mensaje de contraseña.

    El nombre ausente se rechaza por sí solo.
    """
    service, repo, _, _ = make_service()
    assert_rejected(service, repo, FIRST_NAME_REQUIRED, first_name=None)

    assert_rejected(service, repo, TOO_SHORT, password="corta", first_name=None)


# SDD: 018 REQ-006 AC-006.3
def test_register_validates_the_first_name_before_last_name_and_date():
    """Sin nombre, apellido ni fecha: gana 'El nombre es obligatorio'."""
    service, repo, _, _ = make_service()

    assert_rejected(
        service, repo, FIRST_NAME_REQUIRED, first_name=None, last_name=None, date_of_birth=None
    )


# SDD: 018 REQ-006 AC-006.4
def test_register_validates_the_last_name_before_the_date_of_birth():
    """Sin apellido y con fecha futura: gana 'El apellido es obligatorio'."""
    service, repo, _, _ = make_service()

    assert_rejected(
        service, repo, LAST_NAME_REQUIRED, last_name=None, date_of_birth="2026-10-19"
    )


# SDD: 018 REQ-006 AC-006.5
def test_register_validates_the_date_of_birth_before_the_duplicate_check():
    """Con la cuenta ya existente y sin fecha, gana el error de fecha sin consultar duplicados."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    assert_rejected(service, repo, INVALID_DOB, date_of_birth=None)


# SDD: 018 REQ-001 AC-001.3 AC-001.4
@pytest.mark.parametrize("body", [None, [], [{"email": "ana@example.com"}], "texto", 5])
def test_register_from_body_rejects_a_body_that_is_not_an_object(body):
    """Un cuerpo que no es objeto da 'La petición no es válida' sin consultar el repositorio."""
    service, repo, _, _ = make_service()

    with pytest.raises(ValidationError) as exc_info:
        service.register_from_body(body)

    assert str(exc_info.value) == INVALID_REQUEST
    assert repo.queried_emails == []
    assert repo.created == []


# SDD: 018 REQ-001 AC-001.3
def test_register_from_body_registers_with_the_fields_of_the_object():
    """Un objeto válido crea la cuenta con sus campos y devuelve el token."""
    service, repo, _, _ = make_service()

    token = service.register_from_body(
        {
            "email": "Ana@Example.com",
            "password": PASSWORD,
            "first_name": " Ana ",
            "last_name": "Pérez",
            "date_of_birth": "1990-01-01",
        }
    )

    assert token == "token-de-mentira"
    assert repo.created[0].email == "ana@example.com"
    assert repo.created[0].first_name == "Ana"


# SDD: 018 REQ-002 AC-002.3 AC-002.4
@pytest.mark.parametrize("body", [None, [], [{"email": "ana@example.com"}], "texto", 5])
def test_login_from_body_rejects_a_body_that_is_not_an_object(body):
    """Un cuerpo que no es objeto da 'La petición no es válida' sin consultar el repositorio."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(ValidationError) as exc_info:
        service.login_from_body(body)

    assert str(exc_info.value) == INVALID_REQUEST
    assert repo.queried_emails == []


# SDD: 018 REQ-002 AC-002.5
def test_login_from_body_with_an_empty_object_is_wrong_credentials():
    """`{}` sigue siendo credenciales incorrectas (401), no petición no válida."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login_from_body({})

    assert str(exc_info.value) == WRONG_CREDENTIALS
    assert repo.queried_emails == []


# SDD: 018 REQ-002 AC-002.1
def test_login_from_body_returns_a_token_for_valid_credentials():
    """Un objeto con correo y contraseña correctos devuelve el token."""
    service, _, _, _ = make_service([make_user("ana@example.com")])

    token = service.login_from_body({"email": "ana@example.com", "password": PASSWORD})

    assert token == "token-de-mentira"


# SDD: 018 REQ-007 AC-007.1
def test_login_with_a_wrong_password_uses_the_spanish_message():
    """Contraseña errónea: 'Correo o contraseña incorrectos'."""
    service, _, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", "Otra1234")

    assert str(exc_info.value) == WRONG_CREDENTIALS


# SDD: 018 REQ-007 AC-007.2
def test_login_with_an_unknown_email_uses_the_spanish_message():
    """Correo inexistente: 'Correo o contraseña incorrectos'."""
    service, _, _, _ = make_service()

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("nadie@example.com", PASSWORD)

    assert str(exc_info.value) == WRONG_CREDENTIALS


# SDD: 018 REQ-007 AC-007.3
def test_login_to_a_google_account_without_password_uses_the_spanish_message():
    """Cuenta de Google sin contraseña: 'Correo o contraseña incorrectos'."""
    service, _, _, _ = make_service([make_user("ana@example.com", password=None, google_id="g-1")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login("ana@example.com", PASSWORD)

    assert str(exc_info.value) == WRONG_CREDENTIALS


# SDD: 018 REQ-007 AC-007.4
@pytest.mark.parametrize(
    "email, password",
    [(123, PASSWORD), ("ana@example.com", None), ("ana@example.com", "a" * 73)],
)
def test_login_with_anomalous_data_uses_the_spanish_message(email, password):
    """Correo numérico, sin contraseña o de 73 bytes: el mismo mensaje en español."""
    service, _, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(AuthenticationError) as exc_info:
        service.login(email, password)

    assert str(exc_info.value) == WRONG_CREDENTIALS


# SDD: 018 REQ-008 AC-008.1
def test_register_a_duplicate_email_uses_the_spanish_message():
    """Correo ya registrado: ConflictError 'Ya existe una cuenta con este correo'."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(ConflictError) as exc_info:
        register(service)

    assert str(exc_info.value) == EMAIL_TAKEN
    assert repo.created == []


# SDD: 018 REQ-008 AC-008.2
def test_register_a_duplicate_email_in_uppercase_uses_the_spanish_message():
    """'ANA@example.com' con 'ana@example.com' existente: el mismo mensaje."""
    service, repo, _, _ = make_service([make_user("ana@example.com")])

    with pytest.raises(ConflictError) as exc_info:
        register(service, email="ANA@example.com")

    assert str(exc_info.value) == EMAIL_TAKEN
    assert len(repo.users) == 1
