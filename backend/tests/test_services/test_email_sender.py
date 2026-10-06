"""Tests UNITARIOS de ResendTransport: la red se aisla con un FakeOpener
inyectado por constructor y el log con un FakeLogger. Nada llama a Resend.
"""

import json

import pytest

from tests.fakes import FakeLogger, FakeOpener
from utils.email_sender import EmailMessage, EmailSendError, ResendTransport

API_KEY = "re_test_123"
USER_AGENT = "fitnerd/1.0 (+https://fitnerd.betofallas.dev)"


def make_transport(api_key=API_KEY, **opener_kwargs):
    opener = FakeOpener(**opener_kwargs)
    logger = FakeLogger()
    return ResendTransport(api_key, opener=opener, logger=logger), opener, logger


def make_message(to="ana@example.com"):
    return EmailMessage(
        sender="fitnerd <no-reply@example.com>",
        to=to,
        subject="Asunto",
        text="Texto",
        html="<p>Texto</p>",
    )


def user_agents(request):
    return [v for k, v in request.header_items() if k.lower() == "user-agent"]


# SDD: REQ-001 AC-001.1
def test_resend_request_has_fitnerd_user_agent():
    """La peticion lleva el User-Agent exacto de fitnerd."""
    transport, opener, _ = make_transport()

    transport.send(make_message())

    assert opener.requests[0].get_header("User-agent") == USER_AGENT


# SDD: REQ-001 AC-001.2
def test_resend_request_has_single_user_agent_without_python_urllib():
    """Hay una unica cabecera User-Agent y no contiene Python-urllib."""
    transport, opener, _ = make_transport()

    transport.send(make_message())

    values = user_agents(opener.requests[0])
    assert len(values) == 1
    assert "Python-urllib" not in values[0]


# SDD: REQ-001 AC-001.3
def test_consecutive_sends_keep_user_agent():
    """Dos envios a destinatarios distintos llevan el mismo User-Agent."""
    transport, opener, _ = make_transport()

    transport.send(make_message("ana@example.com"))
    transport.send(make_message("luis@example.com"))

    assert len(opener.requests) == 2
    for request in opener.requests:
        assert request.get_header("User-agent") == USER_AGENT


# SDD: REQ-002 AC-002.1
def test_resend_request_method_url_and_auth_unchanged():
    """POST a la URL de Resend con Authorization Bearer y Content-Type JSON."""
    transport, opener, _ = make_transport()

    transport.send(make_message())

    request = opener.requests[0]
    assert request.get_method() == "POST"
    assert request.full_url == "https://api.resend.com/emails"
    assert request.get_header("Authorization") == "Bearer re_test_123"
    assert request.get_header("Content-type") == "application/json"


# SDD: REQ-002 AC-002.2
def test_resend_request_body_unchanged():
    """El cuerpo JSON es exactamente el definido en la spec."""
    transport, opener, _ = make_transport()

    transport.send(make_message())

    assert json.loads(opener.requests[0].data) == {
        "from": "fitnerd <no-reply@example.com>",
        "to": ["ana@example.com"],
        "subject": "Asunto",
        "text": "Texto",
        "html": "<p>Texto</p>",
    }


# SDD: REQ-003 AC-003.1
def test_http_error_raises_email_send_error_with_code_without_key():
    """Un 403 lanza EmailSendError con el codigo y sin la API key."""
    transport, _, _ = make_transport(status=403, body=b"error code: 1010")

    with pytest.raises(EmailSendError) as exc_info:
        transport.send(make_message())

    assert "403" in str(exc_info.value)
    assert API_KEY not in str(exc_info.value)


# SDD: REQ-003 AC-003.2
def test_connection_error_raises_email_send_error_without_key():
    """Sin conexion lanza EmailSendError sin la API key."""
    transport, _, _ = make_transport(no_connection=True)

    with pytest.raises(EmailSendError) as exc_info:
        transport.send(make_message())

    assert API_KEY not in str(exc_info.value)


# SDD: REQ-003 AC-003.3
def test_missing_api_key_raises_without_network():
    """Sin API key lanza EmailSendError y no se hace ninguna peticion."""
    transport, opener, _ = make_transport(api_key=None)

    with pytest.raises(EmailSendError):
        transport.send(make_message())

    assert opener.requests == []


# SDD: REQ-004 AC-004.1
def test_http_error_body_is_logged_with_code():
    """El cuerpo del error de Resend queda en el log junto al codigo."""
    transport, _, logger = make_transport(status=403, body=b"error code: 1010")

    with pytest.raises(EmailSendError):
        transport.send(make_message())

    assert any("403" in r and "error code: 1010" in r for r in logger.records)


# SDD: REQ-004 AC-004.2
def test_logged_error_body_is_truncated_to_200_chars():
    """Del cuerpo solo se registran los primeros 200 caracteres."""
    body = ("a" * 200 + "b" * 300).encode()
    transport, _, logger = make_transport(status=403, body=body)

    with pytest.raises(EmailSendError):
        transport.send(make_message())

    entries = [r for r in logger.records if "a" * 200 in r]
    assert entries
    for entry in entries:
        # Se aisla el fragmento del cuerpo para no depender del texto fijo del log.
        assert "b" not in entry.split(": ", 1)[1]


# SDD: REQ-004 AC-004.3
def test_logged_error_body_never_contains_api_key():
    """Un cuerpo de error que repite la API key no la deja en el log."""
    body = f"clave invalida {API_KEY}".encode()
    transport, _, logger = make_transport(status=401, body=body)

    with pytest.raises(EmailSendError):
        transport.send(make_message())

    assert all(API_KEY not in r for r in logger.records)


# SDD: REQ-004 AC-004.4
def test_error_message_does_not_include_response_body():
    """El mensaje del EmailSendError no incluye el cuerpo de la respuesta."""
    transport, _, _ = make_transport(status=403, body=b"error code: 1010")

    with pytest.raises(EmailSendError) as exc_info:
        transport.send(make_message())

    assert "error code: 1010" not in str(exc_info.value)


# SDD: REQ-004 AC-004.5
def test_empty_error_body_still_raises_email_send_error_and_logs_code():
    """Un 500 con cuerpo vacio lanza exactamente EmailSendError y registra el codigo."""
    transport, _, logger = make_transport(status=500, body=b"")

    with pytest.raises(EmailSendError) as exc_info:
        transport.send(make_message())

    assert type(exc_info.value) is EmailSendError
    assert any("500" in r for r in logger.records)
