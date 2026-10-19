"""Tests de INTEGRACIÓN del envío real de correos por Resend (spec 020, REQ-007
y NFR-002): se arranca una app con `MAIL_BACKEND=resend` (fixture `make_app`) y
se comprueba, de la solicitud HTTP a la petición a la API de Resend, el
contenido que saldría. La red se corta sustituyendo la función de red del
transporte por un `FakeOpener` antes de la primera petición: ninguna petición
llega a Resend (Art. B5.4) y todas quedan en `opener.requests`.
"""

import json
import logging
import re

import pytest
from sqlalchemy import select

from extensions import db, email_sender
from models.password_reset_request import PasswordResetRequest
from models.user import User
from tests.fakes import FakeOpener
from utils.email_sender import ConsoleTransport, ResendTransport

API_KEY = "re_test_key"
MAIL_FROM = "fitnerd <no-reply@fitnerd.betofallas.dev>"
BASE_URL = "https://fitnerd.betofallas.dev"
USER_AGENT = "fitnerd/1.0 (+https://fitnerd.betofallas.dev)"
SUBJECT = "Restablece tu contraseña de fitnerd"
ACCEPTED = {
    "message": (
        "Si el correo pertenece a una cuenta con contraseña, "
        "recibirás un enlace para restablecerla."
    )
}
SEND_FAILED = {"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}
IP = "203.0.113.77"


def resend_app(make_app, opener, **overrides):
    """Arranca una app con Resend y le corta la red con `opener` antes de la
    primera petición."""
    settings = {
        "MAIL_BACKEND": "resend",
        "RESEND_API_KEY": API_KEY,
        "MAIL_FROM": MAIL_FROM,
        "FRONTEND_BASE_URL": BASE_URL,
    }
    settings.update(overrides)
    flask_app = make_app("testing", **settings)
    assert isinstance(email_sender.transport, ResendTransport)
    email_sender.transport.opener = opener
    return flask_app


def register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "ClaveVieja123",
            "first_name": "Ana",
            "last_name": "Pérez",
            "date_of_birth": "2000-01-01",
        },
    )
    assert response.status_code == 201


def forgot(client, email="ana@example.com"):
    return client.post(
        "/api/auth/forgot-password",
        json={"email": email},
        headers={"X-Forwarded-For": IP},
    )


def sent_body(opener):
    return json.loads(opener.requests[0].data.decode("utf-8"))


def reset_requests_with_a_link(flask_app, email):
    with flask_app.app_context():
        user = db.session.scalar(select(User).where(User.email == email))
        stmt = select(PasswordResetRequest).where(
            PasswordResetRequest.user_id == user.id,
            PasswordResetRequest.token_hash.is_not(None),
            PasswordResetRequest.used_at.is_(None),
            PasswordResetRequest.invalidated_at.is_(None),
        )
        return list(db.session.scalars(stmt))


# --------------------------------------------------------------------------
# Envío correcto
# --------------------------------------------------------------------------


# SDD: 020 REQ-007 AC-007.1
def test_forgot_password_sends_a_single_post_to_the_resend_api(make_app):
    opener = FakeOpener()
    flask_app = resend_app(make_app, opener)
    client = flask_app.test_client()
    register(client)

    response = forgot(client)

    assert response.status_code == 200
    assert response.get_json() == ACCEPTED
    assert len(opener.requests) == 1
    request = opener.requests[0]
    assert request.get_method() == "POST"
    assert request.full_url == "https://api.resend.com/emails"


# SDD: 020 REQ-007 AC-007.2
def test_the_request_to_resend_carries_the_key_the_user_agent_and_the_body(make_app):
    opener = FakeOpener()
    client = resend_app(make_app, opener).test_client()
    register(client)

    forgot(client)

    request = opener.requests[0]
    assert request.get_header("Authorization") == f"Bearer {API_KEY}"
    assert request.get_header("User-agent") == USER_AGENT
    assert request.get_header("Content-type") == "application/json"
    body = sent_body(opener)
    assert body["from"] == MAIL_FROM
    assert body["to"] == ["ana@example.com"]
    assert body["subject"] == SUBJECT


# SDD: 020 REQ-007 AC-007.2
def test_the_email_text_and_html_contain_the_reset_link_of_the_frontend(make_app):
    opener = FakeOpener()
    client = resend_app(make_app, opener).test_client()
    register(client)

    forgot(client)

    body = sent_body(opener)
    prefix = f"{BASE_URL}/reset-password?token="
    assert prefix in body["text"]
    assert prefix in body["html"]
    assert "localhost" not in body["text"]
    assert "localhost" not in body["html"]


# SDD: 020 REQ-007 AC-007.3
def test_the_token_of_the_intercepted_link_resets_the_password(make_app):
    opener = FakeOpener()
    client = resend_app(make_app, opener).test_client()
    register(client)
    forgot(client)
    match = re.search(r"reset-password\?token=([A-Za-z0-9_-]+)", sent_body(opener)["text"])
    assert match, "el correo interceptado no contiene un enlace con token"

    response = client.post(
        "/api/auth/reset-password",
        json={"token": match.group(1), "password": "NuevaClave456"},
    )

    assert response.status_code == 200
    assert response.get_json() == {"message": "Contraseña actualizada"}


# --------------------------------------------------------------------------
# Fallos y casos sin envío
# --------------------------------------------------------------------------


# SDD: 020 REQ-007 AC-007.4
def test_resend_403_gives_503_without_leaking_the_key_and_leaves_no_valid_link(
    make_app, caplog
):
    opener = FakeOpener(status=403, body=b"error code: 1010")
    flask_app = resend_app(make_app, opener)
    client = flask_app.test_client()
    register(client)
    caplog.set_level(logging.DEBUG)

    response = forgot(client)

    assert response.status_code == 503
    assert response.get_json() == SEND_FAILED
    assert len(opener.requests) == 1
    assert API_KEY not in caplog.text
    assert API_KEY not in response.get_data(as_text=True)
    assert reset_requests_with_a_link(flask_app, "ana@example.com") == []


# SDD: 020 REQ-007 AC-007.5
def test_without_an_api_key_the_reset_gives_503_and_nothing_is_sent(make_app):
    opener = FakeOpener()
    flask_app = resend_app(make_app, opener, RESEND_API_KEY=None)
    client = flask_app.test_client()
    register(client)

    response = forgot(client)

    assert response.status_code == 503
    assert response.get_json() == SEND_FAILED
    assert opener.requests == []
    assert reset_requests_with_a_link(flask_app, "ana@example.com") == []


# SDD: 020 REQ-007 AC-007.6
def test_an_email_without_an_account_gets_200_and_nothing_is_sent(make_app):
    opener = FakeOpener()
    client = resend_app(make_app, opener).test_client()

    response = forgot(client, "nadie@example.com")

    assert response.status_code == 200
    assert response.get_json() == ACCEPTED
    assert opener.requests == []


# SDD: 020 REQ-007 AC-007.7
def test_console_backend_logs_the_email_and_does_not_call_resend(make_app, caplog):
    opener = FakeOpener()
    caplog.set_level(logging.INFO)
    flask_app = make_app("testing", MAIL_BACKEND="console")
    assert isinstance(email_sender.transport, ConsoleTransport)
    client = flask_app.test_client()
    register(client)

    response = forgot(client)

    assert response.status_code == 200
    assert SUBJECT in caplog.text
    assert opener.requests == []
    assert not isinstance(email_sender.transport, ResendTransport)


# SDD: 020 REQ-007 AC-007.8
def test_an_unknown_mail_backend_stops_the_app_from_starting(make_app):
    with pytest.raises(ValueError, match="MAIL_BACKEND desconocido: pigeon"):
        make_app("testing", MAIL_BACKEND="pigeon")


# --------------------------------------------------------------------------
# NFR-002: la red nunca se toca
# --------------------------------------------------------------------------


# SDD: 020 NFR-002 AC-N002.1
def test_every_request_to_resend_is_intercepted_by_the_fake_opener(make_app):
    opener = FakeOpener()
    client = resend_app(make_app, opener).test_client()
    register(client)

    forgot(client)

    assert email_sender.transport.opener is opener
    assert len(opener.requests) == 1
    assert all(r.full_url.startswith("https://api.resend.com/") for r in opener.requests)
