"""RestoreTokenSigner (utils/restore_token.py, ADR-0035): el token de restauración
es `<payload>.<firma>`, ligado al usuario. Sin red ni servicios externos."""

import pytest

from utils.feedback_token import FeedbackTokenSigner
from utils.restore_token import MAX_RESTORE_TOKEN_LENGTH, RestoreTokenSigner

SECRET = "test-secret"
PAYLOAD = {
    "v": 1,
    "d": "2026-10-20",
    "t": "breakfast",
    "p": 1,
    "s": "catalog",
    "c": "platano",
    "f": None,
    "n": "Plátano",
    "dt": None,
    "g": "120.0",
    "per": {"calories_kcal": 89.0, "protein_g": 1.1, "carbs_g": 22.8, "fat_g": 0.3},
    "exp": 1792979000,
}


def make_signer(secret=SECRET):
    return RestoreTokenSigner(secret)


def flip_char(text, index):
    """Devuelve `text` con el carácter de `index` cambiado por otro."""
    replacement = "A" if text[index] != "A" else "B"
    return text[:index] + replacement + text[index + 1 :]


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_the_payload_for_the_same_user():
    """Un token firmado para un usuario se verifica con él y devuelve el payload."""
    signer = make_signer()

    token = signer.sign(42, PAYLOAD)

    assert signer.verify(42, token) == PAYLOAD


# SDD: 026 NFR-002 AC-N002.2
def test_sign_returns_two_url_safe_parts_separated_by_a_dot():
    """El token tiene exactamente un punto y no lleva relleno `=`."""
    token = make_signer().sign(42, PAYLOAD)

    assert token.count(".") == 1
    assert "=" not in token
    assert all(part for part in token.split("."))


# SDD: 026 NFR-002 AC-N002.2
def test_verify_keeps_non_ascii_text_in_the_payload():
    """El payload con tildes y eñes vuelve idéntico."""
    signer = make_signer()
    payload = {**PAYLOAD, "n": "Piña colada ñoña"}

    assert signer.verify("u", signer.sign("u", payload)) == payload


# SDD: 026 NFR-002 AC-N002.2
def test_verify_accepts_a_uuid_user_id_as_text_or_object():
    """El id del usuario se liga por su representación en texto."""
    from uuid import uuid4

    signer = make_signer()
    user_id = uuid4()

    token = signer.sign(user_id, PAYLOAD)

    assert signer.verify(user_id, token) == PAYLOAD
    assert signer.verify(str(user_id), token) == PAYLOAD


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_none_for_a_different_user():
    """Un token del usuario 42 no se acepta para el usuario 7."""
    signer = make_signer()
    token = signer.sign(42, PAYLOAD)

    assert signer.verify(7, token) is None


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_none_with_a_different_secret():
    """Otra clave de firma no verifica el token."""
    token = make_signer("una-clave").sign(42, PAYLOAD)

    assert make_signer("otra-clave").verify(42, token) is None


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_none_if_the_payload_was_altered():
    """Cambiar un carácter del payload invalida la firma."""
    signer = make_signer()
    token = signer.sign(42, PAYLOAD)
    payload, signature = token.split(".")

    assert signer.verify(42, flip_char(payload, 3) + "." + signature) is None


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_none_if_the_signature_was_altered():
    """Cambiar un carácter de la firma invalida el token."""
    signer = make_signer()
    token = signer.sign(42, PAYLOAD)
    payload, signature = token.split(".")

    assert signer.verify(42, payload + "." + flip_char(signature, 0)) is None


# SDD: 026 NFR-002 AC-N002.2
@pytest.mark.parametrize(
    "token",
    ["", "sin-punto", "a.b.c", ".", "abc.", ".abc", "no es un token.ni firma"],
)
def test_verify_returns_none_for_a_token_with_the_wrong_shape(token):
    """Sin punto, con varios, con partes vacías o texto cualquiera."""
    assert make_signer().verify(42, token) is None


# SDD: 026 NFR-002 AC-N002.2
@pytest.mark.parametrize("token", [None, 42, 3.5, ["a.b"], {"a": "b"}, b"a.b", True])
def test_verify_returns_none_for_a_token_that_is_not_text(token):
    """Un valor que no es texto nunca se acepta."""
    assert make_signer().verify(42, token) is None


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_none_for_a_token_longer_than_the_maximum():
    """Un token de más de `MAX_RESTORE_TOKEN_LENGTH` caracteres se rechaza."""
    signer = make_signer()
    token = signer.sign(42, {**PAYLOAD, "n": "x" * (MAX_RESTORE_TOKEN_LENGTH + 10)})

    assert len(token) > MAX_RESTORE_TOKEN_LENGTH
    assert signer.verify(42, token) is None


# SDD: 026 NFR-002 AC-N002.2
def test_verify_returns_none_for_a_feedback_id_with_the_same_secret():
    """Un `feedback_id` de `FeedbackTokenSigner` (otro dominio) no se acepta."""
    feedback_id = FeedbackTokenSigner(SECRET).sign(42, "0123456789abcdef0123456789abcdef")

    assert make_signer().verify(42, feedback_id) is None


# SDD: 026 NFR-002 AC-N002.2
def test_a_restore_token_is_not_accepted_as_a_feedback_id():
    """Y al revés: el token de restauración no sirve como `feedback_id`."""
    token = make_signer().sign(42, PAYLOAD)

    assert FeedbackTokenSigner(SECRET).verify(42, token) is None
