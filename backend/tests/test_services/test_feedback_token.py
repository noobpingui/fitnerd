"""FeedbackTokenSigner (utils/feedback_token.py, ADR-0018): el `feedback_id` es
`<trace_id>.<firma>`, ligado al usuario. Sin red ni servicios externos."""

import pytest

from utils.feedback_token import FeedbackTokenSigner

SECRET = "test-secret"
TRACE_ID = "0123456789abcdef0123456789abcdef"


def make_signer(secret=SECRET):
    return FeedbackTokenSigner(secret)


def flip_char(text, index):
    """Devuelve `text` con el carácter de `index` cambiado por otro válido."""
    original = text[index]
    replacement = "0" if original != "0" else "1"
    return text[:index] + replacement + text[index + 1 :]


# SDD: REQ-005 AC-005.1
def test_verify_returns_the_trace_id_for_the_same_user():
    """Un token firmado para un usuario se verifica con ese mismo usuario y
    devuelve el trace_id original."""
    signer = make_signer()

    token = signer.sign(42, TRACE_ID)

    assert signer.verify(42, token) == TRACE_ID


# SDD: REQ-005 AC-005.1
def test_verify_returns_none_for_a_different_user():
    """Un token emitido para el usuario 42 no se acepta para el usuario 7."""
    signer = make_signer()
    token = signer.sign(42, TRACE_ID)

    assert signer.verify(7, token) is None


# SDD: REQ-005 AC-005.1
def test_verify_returns_none_with_a_different_secret():
    """Un token firmado con otra clave secreta no se verifica."""
    token = make_signer("otra-clave").sign(42, TRACE_ID)

    assert make_signer().verify(42, token) is None


# SDD: REQ-005 AC-005.2
@pytest.mark.parametrize(
    "token",
    ["abc", "", None, 12345, "x" * 5000, "a" * 32 + "." + "b" * 43],
    ids=["invented", "empty", "none", "not-a-string", "very-long", "well-formed-fake-signature"],
)
def test_verify_returns_none_for_invented_or_malformed_tokens(token):
    """Textos inventados, vacíos, `None`, que no son texto, demasiado largos o
    con la forma correcta pero sin firma válida devuelven `None`."""
    assert make_signer().verify(42, token) is None


# SDD: REQ-005 AC-005.3
def test_verify_returns_none_when_a_character_of_the_signature_changes():
    """Cambiar un carácter de la firma invalida el token."""
    signer = make_signer()
    token = signer.sign(42, TRACE_ID)
    separator = token.index(".")

    tampered = flip_char(token, separator + 5)

    assert tampered != token
    assert signer.verify(42, tampered) is None


# SDD: REQ-005 AC-005.3
def test_verify_returns_none_when_a_character_of_the_trace_id_changes():
    """Cambiar un carácter del trace_id invalida el token."""
    signer = make_signer()
    token = signer.sign(42, TRACE_ID)

    tampered = flip_char(token, 3)

    assert tampered != token
    assert signer.verify(42, tampered) is None


# SDD: NFR-001 AC-N001.1
def test_signed_token_does_not_contain_the_email_or_the_name_of_the_user():
    """El `feedback_id` solo lleva el trace_id y la firma: ni email ni nombre."""
    token = make_signer().sign(42, TRACE_ID)

    assert "ana@example.com" not in token
    assert "Ana Pérez" not in token
    assert token.startswith(TRACE_ID + ".")
