"""Unitarios de PasswordResetService. Sin Postgres ni correo real: el
repositorio de usuarios, el de solicitudes de restablecimiento, el
EmailSender y el reloj son fakes escritos a mano e inyectados por
constructor. Aca se prueban todas las fronteras de tiempo (2 minutos por
correo, 10 minutos por IP, 5 minutos de caducidad) moviendo un FakeClock.
"""

import re
import uuid
from datetime import datetime
from types import SimpleNamespace

import bcrypt
import pytest

from exceptions.custom_exceptions import (
    RateLimitError,
    ServiceUnavailableError,
    ValidationError,
)
from services.password_reset_service import PasswordResetService
from tests.fakes import FakeClock, FakeEmailSender, FakeUnitOfWork

BASE_URL = "http://localhost:5173"
IP = "203.0.113.10"
OTHER_IP = "198.51.100.20"
T0 = datetime(2026, 1, 1, 12, 0, 0)

ACCEPTED_MESSAGE = (
    "Si el correo pertenece a una cuenta con contraseña, "
    "recibirás un enlace para restablecerla."
)
INVALID_EMAIL = "Email inválido"
EMAIL_LIMIT = "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."
IP_LIMIT = "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."
SEND_FAILED = "No se pudo enviar el correo. Inténtalo de nuevo más tarde."
INVALID_LINK = "El enlace no es válido o ha caducado. Solicita uno nuevo."
TOO_SHORT = "La contraseña debe tener al menos 8 caracteres"
TOO_LONG = "La contraseña es demasiado larga"
OLD_PASSWORD = "ClaveVieja123"


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("utf-8")


class FakeUserRepository:
    def __init__(self, users):
        self.users = users

    def get_by_email(self, email):
        for user in self.users:
            if user.email == email:
                return user
        return None

    def get_by_id(self, user_id):
        for user in self.users:
            if user.id == user_id:
                return user
        return None


class FakePasswordResetRepository:
    """Guarda en memoria PasswordResetRequest reales, con la misma semantica
    que el SQL del repositorio real. `calls` registra el orden de los
    metodos; `locked_keys` las claves de los advisory locks."""
    def __init__(self):
        self.rows = []
        self.locked_keys = []
        self.calls = []

    def lock_keys(self, keys):
        self.calls.append("lock_keys")
        self.locked_keys.extend(keys)

    def count_recent_by_ip(self, client_ip, since):
        self.calls.append("count_recent_by_ip")
        return len([r for r in self.rows if r.client_ip == client_ip and r.created_at > since])

    def get_latest_by_email(self, email):
        self.calls.append("get_latest_by_email")
        matching = [r for r in self.rows if r.email == email]
        return max(matching, key=lambda r: r.created_at) if matching else None

    def get_by_token_hash(self, token_hash):
        self.calls.append("get_by_token_hash")
        for row in self.rows:
            if row.token_hash == token_hash:
                return row
        return None

    def invalidate_active_for_user(self, user_id, at):
        self.calls.append("invalidate_active_for_user")
        for row in self.rows:
            if row.user_id == user_id and row.used_at is None and row.invalidated_at is None:
                row.invalidated_at = at

    def create(self, instance):
        self.calls.append("create")
        self.rows.append(instance)
        return instance


def make_user(email, password=OLD_PASSWORD, google_id=None):
    password_hash = hash_password(password) if password is not None else None
    return SimpleNamespace(
        id=uuid.uuid4(), email=email, password_hash=password_hash, google_id=google_id
    )


def make_service(users=None, email_sender=None):
    clock = FakeClock(T0)
    email_sender = email_sender or FakeEmailSender()
    repo = FakePasswordResetRepository()
    uow = FakeUnitOfWork()
    service = PasswordResetService(
        FakeUserRepository(users or []), repo, uow, email_sender, BASE_URL, clock=clock
    )
    return SimpleNamespace(service=service, repo=repo, uow=uow, email=email_sender, clock=clock)


def token_from(sent):
    match = re.search(r"token=([A-Za-z0-9_-]+)", sent["text"])
    assert match, "el correo no contiene un enlace con token"
    return match.group(1)


def fill_ip_limit(ctx, ip=IP, count=3):
    """Deja `count` solicitudes aceptadas desde `ip` usando correos sin cuenta."""
    for i in range(count):
        ctx.service.request_reset(f"relleno{i}-{ip}@example.com", ip)


# ---------------------------------------------------------------- REQ-002 / REQ-003

# SDD: REQ-002 AC-002.1 NFR-001 AC-N001.1
def test_request_reset_accepts_an_account_with_password_and_exposes_the_generic_message():
    """Una cuenta con contraseña no lanza nada y el mensaje es el texto exacto de la spec."""
    from services import password_reset_service as module

    ctx = make_service([make_user("ana@example.com")])

    result = ctx.service.request_reset("ana@example.com", IP)

    assert result is None
    assert module.REQUEST_ACCEPTED_MESSAGE == ACCEPTED_MESSAGE


# SDD: REQ-002 AC-002.2
def test_request_reset_sends_exactly_one_email_and_stores_a_row_with_token_hash():
    """Se envia un unico correo a la cuenta y queda una fila con token_hash e IP, con commit."""
    ctx = make_service([make_user("ana@example.com")])

    ctx.service.request_reset("ana@example.com", IP)

    assert len(ctx.email.sent) == 1
    assert ctx.email.sent[0]["to"] == "ana@example.com"
    assert len(ctx.repo.rows) == 1
    assert ctx.repo.rows[0].token_hash is not None
    assert ctx.repo.rows[0].client_ip == IP
    assert ctx.uow.committed is True


# SDD: REQ-002 AC-002.3
def test_request_reset_email_is_in_spanish_with_link_and_expiry():
    """El correo tiene el asunto de la spec, el enlace a /reset-password y avisa de 5 min."""
    ctx = make_service([make_user("ana@example.com")])

    ctx.service.request_reset("ana@example.com", IP)

    sent = ctx.email.sent[0]
    assert sent["subject"] == "Restablece tu contraseña de fitnerd"
    assert f"{BASE_URL}/reset-password?token=" in sent["text"]
    assert "5 minutos" in sent["text"]
    assert token_from(sent)


# SDD: REQ-002 AC-002.4
def test_request_reset_sends_email_to_an_account_linked_to_google_that_has_password():
    """Una cuenta con contraseña y vinculada a Google tambien recibe el correo."""
    ctx = make_service([make_user("ana@example.com", google_id="g-123")])

    ctx.service.request_reset("ana@example.com", IP)

    assert len(ctx.email.sent) == 1


# SDD: REQ-003 AC-003.1
def test_request_reset_for_unknown_email_sends_nothing_and_stores_a_row_without_token():
    """Sin cuenta no se envia correo, pero la solicitud cuenta (fila sin usuario ni token)."""
    ctx = make_service([])

    ctx.service.request_reset("nadie@example.com", IP)

    assert ctx.email.sent == []
    assert len(ctx.repo.rows) == 1
    assert ctx.repo.rows[0].user_id is None
    assert ctx.repo.rows[0].token_hash is None


# SDD: REQ-003 AC-003.2
def test_request_reset_for_google_only_account_sends_nothing():
    """Una cuenta solo de Google (sin contraseña) no recibe correo y no genera token."""
    ctx = make_service([make_user("google@example.com", password=None, google_id="g-1")])

    ctx.service.request_reset("google@example.com", IP)

    assert ctx.email.sent == []
    assert len(ctx.repo.rows) == 1
    assert ctx.repo.rows[0].user_id is None
    assert ctx.repo.rows[0].token_hash is None


# ---------------------------------------------------------------- REQ-004

# SDD: REQ-004 AC-004.1 AC-004.2
def test_second_request_within_two_minutes_is_rate_limited_and_first_link_stays_valid():
    """A 1:59 la segunda solicitud da 429 sin correo, y el enlace emitido sigue sirviendo."""
    ctx = make_service([make_user("ana@example.com")])
    ctx.service.request_reset("ana@example.com", IP)
    token = token_from(ctx.email.sent[0])

    ctx.clock.advance(minutes=1, seconds=59)
    with pytest.raises(RateLimitError) as exc_info:
        ctx.service.request_reset("ana@example.com", IP)

    assert exc_info.value.message == EMAIL_LIMIT
    assert len(ctx.email.sent) == 1
    ctx.service.reset_password(token, "NuevaClave123")


# SDD: REQ-004 AC-004.3
def test_request_after_exactly_two_minutes_is_accepted_again():
    """A los 2 minutos exactos el limite por correo ya no aplica y se envia otro correo."""
    ctx = make_service([make_user("ana@example.com")])
    ctx.service.request_reset("ana@example.com", IP)

    ctx.clock.advance(minutes=2)
    ctx.service.request_reset("ana@example.com", IP)

    assert len(ctx.email.sent) == 2


# SDD: REQ-004 AC-004.4
def test_email_rate_limit_also_applies_to_emails_without_account():
    """El limite por correo se aplica exista o no la cuenta."""
    ctx = make_service([])
    ctx.service.request_reset("nadie@example.com", IP)

    ctx.clock.advance(minutes=1)
    with pytest.raises(RateLimitError) as exc_info:
        ctx.service.request_reset("nadie@example.com", IP)

    assert exc_info.value.message == EMAIL_LIMIT


# SDD: REQ-004 AC-004.5
def test_email_rate_limit_is_independent_per_email():
    """Una solicitud reciente de ana no bloquea a luis."""
    ctx = make_service([make_user("ana@example.com"), make_user("luis@example.com")])
    ctx.service.request_reset("ana@example.com", IP)

    ctx.clock.advance(minutes=1)
    ctx.service.request_reset("luis@example.com", IP)

    assert [m["to"] for m in ctx.email.sent] == ["ana@example.com", "luis@example.com"]


# ---------------------------------------------------------------- REQ-005

# SDD: REQ-005 AC-005.1 AC-005.2
@pytest.mark.parametrize("bad_email", ["no-es-un-correo", "", None, "   "])
def test_request_reset_rejects_invalid_emails_without_side_effects(bad_email):
    """Un correo invalido da ValidationError, sin correo, sin filas y sin tomar locks."""
    ctx = make_service([make_user("ana@example.com")])

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.request_reset(bad_email, IP)

    assert exc_info.value.message == INVALID_EMAIL
    assert ctx.email.sent == []
    assert ctx.repo.rows == []
    assert "lock_keys" not in ctx.repo.calls


# ---------------------------------------------------------------- REQ-006

# SDD: REQ-006 AC-006.1 NFR-001 AC-N001.2
def test_email_failure_raises_service_unavailable_without_internal_details_or_rows():
    """Si el proveedor falla: 503 con mensaje fijo, sin texto interno, sin filas y con rollback."""
    sender = FakeEmailSender(raise_error=RuntimeError("SMTP-SECRETO-123"))
    ctx = make_service([make_user("ana@example.com")], email_sender=sender)

    with pytest.raises(ServiceUnavailableError) as exc_info:
        ctx.service.request_reset("ana@example.com", IP)

    assert exc_info.value.message == SEND_FAILED
    assert "SMTP-SECRETO-123" not in exc_info.value.message
    assert ctx.repo.rows == []
    assert ctx.uow.rolled_back is True


# SDD: REQ-006 AC-006.2
def test_request_succeeds_right_after_the_email_provider_recovers():
    """Un fallo no consume el limite por correo: al recuperarse el proveedor se acepta."""
    sender = FakeEmailSender(raise_error=RuntimeError("caido"))
    ctx = make_service([make_user("ana@example.com")], email_sender=sender)
    with pytest.raises(ServiceUnavailableError):
        ctx.service.request_reset("ana@example.com", IP)

    sender.raise_error = None
    ctx.service.request_reset("ana@example.com", IP)

    assert len(ctx.email.sent) == 1


# SDD: REQ-006 AC-006.3
def test_previous_link_stays_valid_after_a_failed_later_request():
    """Una solicitud posterior que falla con 503 no invalida el enlace anterior."""
    ctx = make_service([make_user("ana@example.com")])
    ctx.service.request_reset("ana@example.com", IP)
    token_a = token_from(ctx.email.sent[0])

    ctx.clock.advance(minutes=2)
    ctx.email.raise_error = RuntimeError("caido")
    with pytest.raises(ServiceUnavailableError):
        ctx.service.request_reset("ana@example.com", IP)

    ctx.clock.advance(seconds=30)
    ctx.service.reset_password(token_a, "Clave1234")


# ---------------------------------------------------------------- REQ-007

def request_and_get_token(ctx, email="ana@example.com", ip=IP):
    ctx.service.request_reset(email, ip)
    return token_from(ctx.email.sent[-1])


# SDD: REQ-007 AC-007.1 AC-007.2 NFR-003 AC-N003.1
def test_reset_password_stores_a_bcrypt_hash_of_the_new_password():
    """El reset valido cambia el hash (bcrypt, no en claro) y hace commit."""
    user = make_user("ana@example.com")
    ctx = make_service([user])
    token = request_and_get_token(ctx)
    ctx.uow.committed = False

    ctx.service.reset_password(token, "NuevaClave123")

    assert user.password_hash != "NuevaClave123"
    assert bcrypt.checkpw(b"NuevaClave123", user.password_hash.encode("utf-8"))
    assert not bcrypt.checkpw(OLD_PASSWORD.encode("utf-8"), user.password_hash.encode("utf-8"))
    assert ctx.uow.committed is True


# SDD: REQ-007 AC-007.3
def test_reset_link_cannot_be_used_twice():
    """El segundo uso del mismo enlace da enlace no valido y la contraseña no cambia."""
    user = make_user("ana@example.com")
    ctx = make_service([user])
    token = request_and_get_token(ctx)
    ctx.service.reset_password(token, "NuevaClave123")
    hash_after_first = user.password_hash

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password(token, "OtraClave456")

    assert exc_info.value.message == INVALID_LINK
    assert user.password_hash == hash_after_first


# ---------------------------------------------------------------- REQ-008

# SDD: REQ-008 AC-008.1
def test_reset_link_is_valid_at_four_minutes_fifty_nine_seconds():
    """Un segundo antes de los 5 minutos el enlace aun sirve."""
    ctx = make_service([make_user("ana@example.com")])
    token = request_and_get_token(ctx)

    ctx.clock.advance(minutes=4, seconds=59)
    ctx.service.reset_password(token, "NuevaClave123")


# SDD: REQ-008 AC-008.2
def test_reset_link_expires_at_exactly_five_minutes():
    """A los 5 minutos exactos el enlace ya no es valido y la contraseña no cambia."""
    user = make_user("ana@example.com")
    original_hash = user.password_hash
    ctx = make_service([user])
    token = request_and_get_token(ctx)

    ctx.clock.advance(minutes=5)
    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password(token, "NuevaClave123")

    assert exc_info.value.message == INVALID_LINK
    assert user.password_hash == original_hash


# SDD: REQ-008 AC-008.3
def test_a_newer_link_invalidates_the_previous_one():
    """El primer enlace deja de valer cuando se emite el segundo; el segundo si vale."""
    ctx = make_service([make_user("ana@example.com")])
    token_a = request_and_get_token(ctx)
    ctx.clock.advance(minutes=2, seconds=30)
    token_b = request_and_get_token(ctx)

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password(token_a, "NuevaClave123")
    assert exc_info.value.message == INVALID_LINK

    ctx.service.reset_password(token_b, "NuevaClave123")


# SDD: REQ-008 AC-008.4 AC-008.5
@pytest.mark.parametrize("bad_token", ["token-inventado-que-nunca-se-emitio", "", None])
def test_reset_password_rejects_unknown_empty_or_missing_tokens(bad_token):
    """Token inventado, vacio o ausente: enlace no valido."""
    ctx = make_service([make_user("ana@example.com")])

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password(bad_token, "NuevaClave123")

    assert exc_info.value.message == INVALID_LINK


# ---------------------------------------------------------------- REQ-009

# SDD: REQ-009 AC-009.1 AC-009.3
@pytest.mark.parametrize("bad_password", ["corta", None])
def test_reset_password_rejects_short_or_missing_password(bad_password):
    """Contraseña corta o ausente: error de minimo 8 caracteres y el hash no cambia."""
    user = make_user("ana@example.com")
    original_hash = user.password_hash
    ctx = make_service([user])
    token = request_and_get_token(ctx)

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password(token, bad_password)

    assert exc_info.value.message == TOO_SHORT
    assert user.password_hash == original_hash


# SDD: REQ-009 AC-009.2 AC-009.7
@pytest.mark.parametrize("bad_password", ["corta", "a" * 73])
def test_a_rejected_password_does_not_consume_the_token(bad_password):
    """Tras un rechazo por contraseña invalida, el mismo enlace sigue sirviendo."""
    ctx = make_service([make_user("ana@example.com")])
    token = request_and_get_token(ctx)
    with pytest.raises(ValidationError):
        ctx.service.reset_password(token, bad_password)

    ctx.service.reset_password(token, "Clave1234")


# SDD: REQ-009 AC-009.4 AC-009.6 AC-009.9
@pytest.mark.parametrize("password", ["Clave123", "a" * 72, "ñ" * 36])
def test_reset_password_accepts_passwords_at_the_limits(password):
    """8 caracteres, 72 bytes de 'a' y 36 'ñ' (72 bytes) son validos y funcionan con bcrypt."""
    user = make_user("ana@example.com")
    ctx = make_service([user])
    token = request_and_get_token(ctx)

    ctx.service.reset_password(token, password)

    assert bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8"))


# SDD: REQ-009 AC-009.5 AC-009.8
@pytest.mark.parametrize("password", ["a" * 73, "ñ" * 37])
def test_reset_password_rejects_passwords_over_72_bytes_with_validation_error(password):
    """Mas de 72 bytes en UTF-8 da ValidationError (nunca otra excepcion) y no cambia el hash."""
    user = make_user("ana@example.com")
    original_hash = user.password_hash
    ctx = make_service([user])
    token = request_and_get_token(ctx)

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password(token, password)

    assert exc_info.value.message == TOO_LONG
    assert user.password_hash == original_hash


# SDD: REQ-009 AC-008.4
def test_invalid_token_takes_precedence_over_invalid_password():
    """Con token invalido y contraseña corta, prevalece el error del enlace."""
    ctx = make_service([make_user("ana@example.com")])

    with pytest.raises(ValidationError) as exc_info:
        ctx.service.reset_password("token-inventado", "corta")

    assert exc_info.value.message == INVALID_LINK


# ---------------------------------------------------------------- NFR-002

# SDD: NFR-002 AC-N002.1
def test_each_emission_generates_a_different_token_of_at_least_32_chars():
    """Dos emisiones para la misma cuenta dan tokens distintos y largos."""
    ctx = make_service([make_user("ana@example.com")])
    token_1 = request_and_get_token(ctx)
    ctx.clock.advance(minutes=2)
    token_2 = request_and_get_token(ctx)

    assert token_1 != token_2
    assert len(token_1) >= 32
    assert len(token_2) >= 32


# ---------------------------------------------------------------- REQ-012

# SDD: REQ-012 AC-012.1
def test_fourth_accepted_request_from_the_same_ip_is_rate_limited():
    """Con 3 solicitudes aceptadas desde la IP, la cuarta da 429 de IP y no envia correo."""
    ctx = make_service([make_user("luis@example.com")])
    for i in range(3):
        ctx.service.request_reset(f"otro{i}@example.com", IP)
        ctx.clock.advance(seconds=5)

    with pytest.raises(RateLimitError) as exc_info:
        ctx.service.request_reset("luis@example.com", IP)

    assert exc_info.value.message == IP_LIMIT
    assert ctx.email.sent == []


# SDD: REQ-012 AC-012.2
def test_third_request_from_the_same_ip_is_still_accepted():
    """Con 2 solicitudes previas desde la IP, la tercera se acepta y envia el correo."""
    ctx = make_service([make_user("luis@example.com")])
    fill_ip_limit(ctx, count=2)

    ctx.service.request_reset("luis@example.com", IP)

    assert len(ctx.email.sent) == 1


# SDD: REQ-012 AC-012.3
def test_ip_request_stops_counting_after_exactly_ten_minutes():
    """La mas antigua sale de la ventana a los 10 minutos exactos, asi que se acepta otra."""
    ctx = make_service([make_user("luis@example.com")])
    ctx.service.request_reset("uno@example.com", IP)
    ctx.clock.advance(minutes=1)
    ctx.service.request_reset("dos@example.com", IP)
    ctx.clock.advance(minutes=1)
    ctx.service.request_reset("tres@example.com", IP)

    ctx.clock.advance(minutes=8)
    ctx.service.request_reset("luis@example.com", IP)

    assert len(ctx.email.sent) == 1


# SDD: REQ-012 AC-012.4
def test_ip_rate_limit_is_independent_per_ip():
    """Una IP en el limite no afecta a otra IP."""
    ctx = make_service([make_user("luis@example.com")])
    fill_ip_limit(ctx, ip=IP)

    ctx.service.request_reset("luis@example.com", OTHER_IP)

    assert len(ctx.email.sent) == 1


# SDD: REQ-012 AC-012.5
def test_requests_for_emails_without_account_count_towards_the_ip_limit():
    """Las solicitudes para correos sin cuenta tambien cuentan para el limite por IP."""
    ctx = make_service([make_user("luis@example.com")])
    fill_ip_limit(ctx, ip=IP)

    with pytest.raises(RateLimitError) as exc_info:
        ctx.service.request_reset("luis@example.com", IP)

    assert exc_info.value.message == IP_LIMIT
    assert ctx.email.sent == []


# SDD: REQ-012 AC-012.6
def test_only_accepted_requests_count_towards_the_ip_limit():
    """400, 429 por correo y 503 desde la IP no cuentan: despues se acepta una solicitud valida."""
    sender = FakeEmailSender()
    users = [make_user(f"cuenta{i}@example.com") for i in range(4)]
    ctx = make_service(users, email_sender=sender)

    for i in range(3):
        with pytest.raises(ValidationError):
            ctx.service.request_reset(f"invalido{i}", IP)

    for i in range(3):
        ctx.service.request_reset(f"previo{i}@example.com", OTHER_IP)
    for i in range(3):
        with pytest.raises(RateLimitError) as exc_info:
            ctx.service.request_reset(f"previo{i}@example.com", IP)
        assert exc_info.value.message == EMAIL_LIMIT

    sender.raise_error = RuntimeError("caido")
    for i in range(3):
        with pytest.raises(ServiceUnavailableError):
            ctx.service.request_reset(f"cuenta{i}@example.com", IP)

    sender.raise_error = None
    assert [r for r in ctx.repo.rows if r.client_ip == IP] == []

    ctx.service.request_reset("cuenta3@example.com", IP)

    assert [m["to"] for m in sender.sent] == ["cuenta3@example.com"]


# SDD: REQ-012 AC-012.7
def test_request_rejected_by_ip_does_not_consume_the_email_limit():
    """Rechazada por IP, la misma peticion desde otra IP se acepta (sin fila de ese correo)."""
    ctx = make_service([make_user("luis@example.com")])
    fill_ip_limit(ctx, ip=IP)
    with pytest.raises(RateLimitError):
        ctx.service.request_reset("luis@example.com", IP)

    ctx.service.request_reset("luis@example.com", OTHER_IP)

    assert [m["to"] for m in ctx.email.sent] == ["luis@example.com"]


# SDD: REQ-012 AC-012.8
def test_ip_limit_takes_precedence_over_the_email_limit():
    """Si se superan los dos limites, el error es el de IP."""
    ctx = make_service([make_user("ana@example.com")])
    ctx.service.request_reset("ana@example.com", OTHER_IP)
    fill_ip_limit(ctx, ip=IP)

    ctx.clock.advance(minutes=1)
    with pytest.raises(RateLimitError) as exc_info:
        ctx.service.request_reset("ana@example.com", IP)

    assert exc_info.value.message == IP_LIMIT


# SDD: REQ-012
def test_request_reset_takes_email_and_ip_advisory_locks_before_reading():
    """Las claves de lock de correo e IP se toman antes de cualquier lectura."""
    ctx = make_service([make_user("ana@example.com")])

    ctx.service.request_reset("ana@example.com", IP)

    assert "password-reset:email:ana@example.com" in ctx.repo.locked_keys
    assert f"password-reset:ip:{IP}" in ctx.repo.locked_keys
    assert ctx.repo.calls[0] == "lock_keys"
