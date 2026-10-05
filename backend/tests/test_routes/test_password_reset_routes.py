"""Tests de INTEGRACION de los endpoints de restablecimiento de contraseña:
cliente HTTP real contra la app, el service y el repository reales y
Postgres de test. El correo sale por el transporte "memory" (bandeja
`email_sender.transport.outbox`), nunca por la red. El test client siempre
conecta desde 127.0.0.1 y hace de "Caddy": la IP del cliente se indica con
la cabecera X-Forwarded-For (TestingConfig.PROXY_FIX_X_FOR = 1).
"""

import itertools
import re
from datetime import timedelta

import bcrypt
from sqlalchemy import select, update

from extensions import db, email_sender
from models.password_reset_request import PasswordResetRequest
from models.user import User

ACCEPTED = {"message": "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."}
EMAIL_LIMIT = {"error": "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."}
IP_LIMIT = {"error": "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."}
SEND_FAILED = {"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}
INVALID_LINK = {"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}
TOO_SHORT = {"error": "La contraseña debe tener al menos 8 caracteres"}
TOO_LONG = {"error": "La contraseña es demasiado larga"}
OLD_PASSWORD = "ClaveVieja123"
IP = "203.0.113.10"
OTHER_IP = "198.51.100.20"

_ip_counter = itertools.count(1)


def fresh_ip():
    """IP distinta en cada llamada, para que los tests que encadenan varias
    solicitudes no tropiecen con el limite de 3 por IP."""
    n = next(_ip_counter)
    return f"10.9.{n // 250}.{n % 250 + 1}"


def outbox():
    return email_sender.transport.outbox


def token_from(message):
    match = re.search(r"token=([A-Za-z0-9_-]+)", message.text)
    assert match, "el correo no contiene un enlace con token"
    return match.group(1)


def register(client, email, password=OLD_PASSWORD):
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
        },
    )
    assert response.status_code == 201


def forgot(client, email, ip=None):
    return client.post(
        "/api/auth/forgot-password",
        json={"email": email},
        headers={"X-Forwarded-For": ip or fresh_ip()},
    )


def reset(client, token, password):
    return client.post("/api/auth/reset-password", json={"token": token, "password": password})


def login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def create_google_only_user(app, email):
    with app.app_context():
        db.session.add(User(email=email, password_hash=None, google_id="g-1", first_name="G"))
        db.session.commit()


def age_requests(app, email, **delta):
    """Envejece las filas de un correo sin esperar de verdad."""
    with app.app_context():
        db.session.execute(
            update(PasswordResetRequest)
            .where(PasswordResetRequest.email == email)
            .values(created_at=PasswordResetRequest.created_at - timedelta(**delta))
        )
        db.session.commit()


def fill_ip_limit(client, ip=IP, count=3):
    for i in range(count):
        response = forgot(client, f"relleno{i}-{ip}@example.com", ip=ip)
        assert response.status_code == 200


# ---------------------------------------------------------------- REQ-002 / REQ-003

# SDD: REQ-002 AC-002.1 NFR-001 AC-N001.1
def test_forgot_password_returns_the_exact_generic_body_and_never_the_token(client):
    """200 con el cuerpo exacto, y el token del correo no aparece en la respuesta."""
    register(client, "ana@example.com")

    response = forgot(client, "ana@example.com")

    assert response.status_code == 200
    assert response.get_json() == ACCEPTED
    assert token_from(outbox()[0]) not in response.get_data(as_text=True)


# SDD: REQ-002 AC-002.2 AC-002.3
def test_forgot_password_sends_one_spanish_email_with_the_reset_link(client):
    """Un correo a la cuenta, con asunto, remitente, enlace a /reset-password y aviso de 5 minutos."""
    register(client, "ana@example.com")

    forgot(client, "ana@example.com")

    assert len(outbox()) == 1
    message = outbox()[0]
    assert message.to == "ana@example.com"
    assert message.subject == "Restablece tu contraseña de fitnerd"
    assert message.sender == "fitnerd <no-reply@fitnerd.betofallas.dev>"
    assert "http://localhost:5173/reset-password?token=" in message.text
    assert "5 minutos" in message.text


# SDD: REQ-003 AC-003.1
def test_forgot_password_for_unknown_email_looks_the_same_and_sends_nothing(client):
    """Sin cuenta: mismo 200 y mismo cuerpo, pero la bandeja queda vacia."""
    response = forgot(client, "nadie@example.com")

    assert response.status_code == 200
    assert response.get_json() == ACCEPTED
    assert outbox() == []


# SDD: REQ-003 AC-003.2
def test_forgot_password_for_google_only_account_looks_the_same_and_sends_nothing(client, app):
    """Cuenta solo de Google: mismo 200 y mismo cuerpo, sin correo."""
    create_google_only_user(app, "google@example.com")

    response = forgot(client, "google@example.com")

    assert response.status_code == 200
    assert response.get_json() == ACCEPTED
    assert outbox() == []


# ---------------------------------------------------------------- REQ-004 / REQ-005

# SDD: REQ-004 AC-004.1
def test_second_forgot_password_request_within_two_minutes_returns_429(client):
    """La segunda solicitud inmediata para el mismo correo da 429 y no envia otro correo."""
    register(client, "ana@example.com")
    forgot(client, "ana@example.com")

    response = forgot(client, "ana@example.com")

    assert response.status_code == 429
    assert response.get_json() == EMAIL_LIMIT
    assert len(outbox()) == 1


# SDD: REQ-004 AC-004.3
def test_forgot_password_is_accepted_again_after_two_minutes(client, app):
    """Envejecida la fila 2 minutos, se vuelve a aceptar y se envia otro correo."""
    register(client, "ana@example.com")
    forgot(client, "ana@example.com")
    age_requests(app, "ana@example.com", minutes=2)

    response = forgot(client, "ana@example.com")

    assert response.status_code == 200
    assert len(outbox()) == 2


# SDD: REQ-004 AC-004.4
def test_email_rate_limit_also_applies_to_unknown_emails(client):
    """El limite por correo se aplica aunque no exista la cuenta."""
    forgot(client, "nadie@example.com")

    response = forgot(client, "nadie@example.com")

    assert response.status_code == 429
    assert response.get_json() == EMAIL_LIMIT
    assert outbox() == []


# SDD: REQ-004 AC-004.5
def test_email_rate_limit_is_independent_per_email(client):
    """Tras pedir ana, luis tambien recibe su correo."""
    register(client, "ana@example.com")
    register(client, "luis@example.com")
    forgot(client, "ana@example.com")

    response = forgot(client, "luis@example.com")

    assert response.status_code == 200
    assert [m.to for m in outbox()] == ["ana@example.com", "luis@example.com"]


# SDD: REQ-005 AC-005.1 AC-005.2
def test_forgot_password_rejects_missing_empty_or_malformed_email(client):
    """Formato invalido, sin campo, vacio o sin cuerpo JSON: 400 Email inválido y sin correo."""
    expected = {"error": "Email inválido"}
    headers = {"X-Forwarded-For": fresh_ip()}

    responses = [
        client.post("/api/auth/forgot-password", json={"email": "no-es-un-correo"}, headers=headers),
        client.post("/api/auth/forgot-password", json={}, headers=headers),
        client.post("/api/auth/forgot-password", json={"email": ""}, headers=headers),
        client.post("/api/auth/forgot-password", data="esto no es json", headers=headers),
    ]

    for response in responses:
        assert response.status_code == 400
        assert response.get_json() == expected
    assert outbox() == []


# ---------------------------------------------------------------- REQ-006

# SDD: REQ-006 AC-006.1 NFR-001 AC-N001.2
def test_email_provider_failure_returns_503_without_internal_details(client):
    """El fallo del transporte da 503 con el cuerpo exacto, sin el texto del error interno."""
    register(client, "ana@example.com")
    email_sender.transport.fail_with = RuntimeError("SMTP-SECRETO-123")

    response = forgot(client, "ana@example.com")

    assert response.status_code == 503
    assert response.get_json() == SEND_FAILED
    assert "SMTP-SECRETO-123" not in response.get_data(as_text=True)


# SDD: REQ-006 AC-006.2
def test_request_is_accepted_immediately_after_the_provider_recovers(client):
    """Un 503 no consume el limite por correo: al recuperarse, 200 y un correo."""
    register(client, "ana@example.com")
    email_sender.transport.fail_with = RuntimeError("caido")
    assert forgot(client, "ana@example.com").status_code == 503

    email_sender.transport.fail_with = None
    response = forgot(client, "ana@example.com")

    assert response.status_code == 200
    assert len(outbox()) == 1


# ---------------------------------------------------------------- REQ-007 / REQ-008

def request_token(client, email="ana@example.com", ip=None):
    assert forgot(client, email, ip=ip).status_code == 200
    return token_from(outbox()[-1])


# SDD: REQ-007 AC-007.1 AC-007.2
def test_reset_password_changes_the_password_and_the_login_follows(client):
    """Reset valido: 200 con el mensaje, login con la nueva y 401 con la anterior."""
    register(client, "ana@example.com")
    token = request_token(client)

    response = reset(client, token, "NuevaClave123")

    assert response.status_code == 200
    assert response.get_json() == {"message": "Contraseña actualizada"}
    assert login(client, "ana@example.com", "NuevaClave123").status_code == 200
    assert login(client, "ana@example.com", OLD_PASSWORD).status_code == 401


# SDD: REQ-007 AC-007.3
def test_reset_link_cannot_be_reused(client):
    """Reutilizar un enlace ya usado da 400 de enlace no valido."""
    register(client, "ana@example.com")
    token = request_token(client)
    reset(client, token, "NuevaClave123")

    response = reset(client, token, "OtraClave456")

    assert response.status_code == 400
    assert response.get_json() == INVALID_LINK


# SDD: REQ-008 AC-008.3
def test_a_newer_link_invalidates_the_older_one(client, app):
    """El primer token da 400 cuando se emitio un segundo; el segundo da 200."""
    register(client, "ana@example.com")
    token_a = request_token(client)
    age_requests(app, "ana@example.com", minutes=2)
    token_b = request_token(client)

    assert reset(client, token_a, "NuevaClave123").status_code == 400
    assert reset(client, token_b, "NuevaClave123").status_code == 200


# SDD: REQ-008 AC-008.4 AC-008.5
def test_reset_password_rejects_unknown_missing_and_empty_tokens(client):
    """Token inventado, ausente o vacio: 400 con el mensaje de enlace no valido."""
    responses = [
        reset(client, "token-inventado-que-nunca-se-emitio", "NuevaClave123"),
        client.post("/api/auth/reset-password", json={"password": "NuevaClave123"}),
        reset(client, "", "NuevaClave123"),
    ]

    for response in responses:
        assert response.status_code == 400
        assert response.get_json() == INVALID_LINK


# SDD: NFR-003 AC-N003.1
def test_stored_password_hash_is_bcrypt_and_not_plain_text(client, app):
    """Tras el reset, el hash guardado no es la contraseña y bcrypt la reconoce."""
    register(client, "ana@example.com")
    token = request_token(client)
    reset(client, token, "NuevaClave123")

    with app.app_context():
        stored = db.session.execute(select(User.password_hash).where(User.email == "ana@example.com")).scalar_one()

    assert stored != "NuevaClave123"
    assert bcrypt.checkpw(b"NuevaClave123", stored.encode("utf-8"))


# ---------------------------------------------------------------- REQ-009 / NFR-002

# SDD: REQ-009 AC-009.1 AC-009.5 AC-009.8
def test_invalid_passwords_return_exact_400_and_keep_the_link_alive(client):
    """Corta, de 73 y de 74 bytes: 400 exactos (nunca 5xx); despues el mismo token con una valida da 200."""
    register(client, "ana@example.com")
    token = request_token(client)

    short = reset(client, token, "corta")
    long_ascii = reset(client, token, "a" * 73)
    long_enye = reset(client, token, "ñ" * 37)

    assert (short.status_code, short.get_json()) == (400, TOO_SHORT)
    assert (long_ascii.status_code, long_ascii.get_json()) == (400, TOO_LONG)
    assert (long_enye.status_code, long_enye.get_json()) == (400, TOO_LONG)
    assert reset(client, token, "Clave1234").status_code == 200


# SDD: REQ-009 AC-009.6
def test_password_of_exactly_72_bytes_is_accepted(client):
    """72 'a' dan 200 y el login con esa contraseña funciona."""
    register(client, "ana@example.com")
    token = request_token(client)

    assert reset(client, token, "a" * 72).status_code == 200
    assert login(client, "ana@example.com", "a" * 72).status_code == 200


# SDD: REQ-009 AC-009.9
def test_password_of_36_enyes_72_bytes_is_accepted(client):
    """36 'ñ' (72 bytes en UTF-8) dan 200 y el login funciona."""
    register(client, "luis@example.com")
    token = request_token(client, "luis@example.com")

    assert reset(client, token, "ñ" * 36).status_code == 200
    assert login(client, "luis@example.com", "ñ" * 36).status_code == 200


# SDD: NFR-002 AC-N002.1
def test_two_emissions_produce_different_tokens_of_at_least_32_chars(client, app):
    """Los tokens de dos correos distintos para la misma cuenta son distintos y largos."""
    register(client, "ana@example.com")
    token_1 = request_token(client)
    age_requests(app, "ana@example.com", minutes=2)
    token_2 = request_token(client)

    assert token_1 != token_2
    assert len(token_1) >= 32
    assert len(token_2) >= 32


# ---------------------------------------------------------------- REQ-012

# SDD: REQ-012 AC-012.1 AC-012.5
def test_fourth_request_from_one_ip_returns_429_even_if_the_first_three_had_no_account(client):
    """3 solicitudes aceptadas (correos sin cuenta) desde una IP bloquean la cuarta, para una cuenta real."""
    register(client, "luis@example.com")
    fill_ip_limit(client, ip=IP)

    response = forgot(client, "luis@example.com", ip=IP)

    assert response.status_code == 429
    assert response.get_json() == IP_LIMIT
    assert outbox() == []


# SDD: REQ-012 AC-012.2
def test_third_request_from_one_ip_is_still_accepted(client):
    """Con 2 solicitudes previas, la tercera desde la IP da 200 y un correo."""
    register(client, "luis@example.com")
    fill_ip_limit(client, ip=IP, count=2)

    response = forgot(client, "luis@example.com", ip=IP)

    assert response.status_code == 200
    assert len(outbox()) == 1


# SDD: REQ-012 AC-012.3
def test_ip_request_leaves_the_window_after_ten_minutes(client, app):
    """Envejecida la mas antigua fuera de los 10 minutos, se acepta otra solicitud."""
    register(client, "luis@example.com")
    fill_ip_limit(client, ip=IP)
    oldest = f"relleno0-{IP}@example.com"
    age_requests(app, oldest, minutes=10, seconds=1)

    response = forgot(client, "luis@example.com", ip=IP)

    assert response.status_code == 200
    assert len(outbox()) == 1


# SDD: REQ-012 AC-012.4
def test_ip_limit_is_independent_per_ip(client):
    """Con una IP en el limite, otra IP sigue obteniendo 200 y su correo."""
    register(client, "luis@example.com")
    fill_ip_limit(client, ip=IP)

    response = forgot(client, "luis@example.com", ip=OTHER_IP)

    assert response.status_code == 200
    assert len(outbox()) == 1


# SDD: REQ-012 AC-012.6
def test_only_accepted_requests_count_towards_the_ip_limit(client):
    """3 x 400, 3 x 429 por correo y 3 x 503 desde la IP no cuentan: despues, 200 y un correo."""
    for i in range(4):
        register(client, f"cuenta{i}@example.com")
    for i in range(3):
        forgot(client, f"previo{i}@example.com", ip=fresh_ip())

    for _ in range(3):
        assert forgot(client, "invalido", ip=IP).status_code == 400
    for i in range(3):
        response = forgot(client, f"previo{i}@example.com", ip=IP)
        assert (response.status_code, response.get_json()) == (429, EMAIL_LIMIT)
    email_sender.transport.fail_with = RuntimeError("caido")
    for i in range(3):
        assert forgot(client, f"cuenta{i}@example.com", ip=IP).status_code == 503
    email_sender.transport.fail_with = None

    response = forgot(client, "cuenta3@example.com", ip=IP)

    assert response.status_code == 200
    assert [m.to for m in outbox()] == ["cuenta3@example.com"]


# SDD: REQ-012 AC-012.7
def test_request_rejected_by_ip_does_not_consume_the_email_limit(client):
    """Tras el 429 por IP, la misma peticion desde otra IP da 200 y correo a luis."""
    register(client, "luis@example.com")
    fill_ip_limit(client, ip=IP)
    assert forgot(client, "luis@example.com", ip=IP).status_code == 429

    response = forgot(client, "luis@example.com", ip=OTHER_IP)

    assert response.status_code == 200
    assert [m.to for m in outbox()] == ["luis@example.com"]


# SDD: REQ-012 AC-012.8
def test_ip_limit_takes_precedence_over_the_email_limit(client):
    """Con los dos limites superados, el cuerpo del 429 es el de IP."""
    register(client, "ana@example.com")
    assert forgot(client, "ana@example.com", ip=OTHER_IP).status_code == 200
    fill_ip_limit(client, ip=IP)

    response = forgot(client, "ana@example.com", ip=IP)

    assert response.status_code == 429
    assert response.get_json() == IP_LIMIT


# SDD: REQ-012 AC-012.9
def test_limit_counts_the_original_client_ip_and_not_the_proxy_ip(client):
    """Todas las peticiones salen de 127.0.0.1 (el proxy): se cuenta X-Forwarded-For, no esa IP."""
    register(client, "luis@example.com")
    fill_ip_limit(client, ip=IP)
    assert forgot(client, "otro@example.com", ip=IP).status_code == 429

    response = forgot(client, "luis@example.com", ip=OTHER_IP)

    assert response.status_code == 200
    # Las filas guardaron la IP original y no la del proxy.
    with client.application.app_context():
        ips = set(db.session.execute(select(PasswordResetRequest.client_ip)).scalars())
    assert "127.0.0.1" not in ips
    assert {IP, OTHER_IP} <= ips
