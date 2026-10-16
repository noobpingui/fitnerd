"""Unitarios de las reglas de correo y contraseña compartidas (spec 014).
Son funciones puras: no hay dependencias que aislar.
"""

import pytest

from exceptions.custom_exceptions import ValidationError
from services.credential_rules import (
    exceeds_bcrypt_limit,
    normalize_email,
    validate_email,
    validate_new_password,
)

INVALID_EMAIL = "Email inválido"
TOO_SHORT = "La contraseña debe tener al menos 8 caracteres"
TOO_LONG = "La contraseña es demasiado larga"


# SDD: 014 REQ-001 AC-001.1
def test_normalize_email_strips_spaces_and_lowercases():
    """Quita espacios al principio y al final y pasa todo a minúsculas."""
    assert normalize_email("  Ana@Example.COM ") == "ana@example.com"


# SDD: 014 REQ-001 AC-001.1
def test_validate_email_returns_the_normalized_email():
    """Un correo válido con espacios y mayúsculas se devuelve normalizado."""
    assert validate_email("  Ana@Example.COM ") == "ana@example.com"


# SDD: 014 REQ-007 AC-007.1
def test_validate_email_rejects_a_missing_email():
    """Un correo ausente (None) lanza 'Email inválido'."""
    with pytest.raises(ValidationError) as exc_info:
        validate_email(None)

    assert str(exc_info.value) == INVALID_EMAIL


# SDD: 014 REQ-007 AC-007.2
def test_validate_email_rejects_text_without_email_format():
    """Un texto sin formato de correo lanza 'Email inválido'."""
    for value in ["no-es-un-correo", "", "   ", "a@b", "a b@c.com", "@x.com"]:
        with pytest.raises(ValidationError) as exc_info:
            validate_email(value)
        assert str(exc_info.value) == INVALID_EMAIL


# SDD: 014 REQ-007 AC-007.4
def test_validate_email_rejects_a_non_text_email():
    """Un correo que no es texto (número, lista) lanza 'Email inválido'."""
    for value in [123, ["a@b.com"], {"a": 1}]:
        with pytest.raises(ValidationError) as exc_info:
            validate_email(value)
        assert str(exc_info.value) == INVALID_EMAIL


# SDD: 014 REQ-006 AC-006.1
def test_validate_new_password_rejects_a_short_password():
    """Una contraseña de 5 caracteres lanza el mensaje de mínimo."""
    with pytest.raises(ValidationError) as exc_info:
        validate_new_password("corta")

    assert str(exc_info.value) == TOO_SHORT


# SDD: 014 REQ-006 AC-006.2
def test_validate_new_password_rejects_a_missing_password():
    """Una contraseña ausente (None) lanza el mensaje de mínimo."""
    with pytest.raises(ValidationError) as exc_info:
        validate_new_password(None)

    assert str(exc_info.value) == TOO_SHORT


# SDD: 014 REQ-006 AC-006.3
def test_validate_new_password_rejects_a_non_text_password():
    """Un número como contraseña lanza el mensaje de mínimo."""
    with pytest.raises(ValidationError) as exc_info:
        validate_new_password(12345678)

    assert str(exc_info.value) == TOO_SHORT


# SDD: 014 REQ-006 AC-006.4
def test_validate_new_password_accepts_exactly_8_characters():
    """Ocho caracteres exactos se aceptan y se devuelven sin cambios."""
    assert validate_new_password("Clave123") == "Clave123"


# SDD: 014 REQ-006 AC-006.4
def test_validate_new_password_does_not_trim_spaces():
    """Los espacios forman parte de la contraseña y no se recortan."""
    assert validate_new_password("  Clave1 ") == "  Clave1 "


# SDD: 014 REQ-006 AC-006.5
def test_validate_new_password_rejects_73_bytes():
    """73 bytes lanzan el mensaje de demasiado larga."""
    with pytest.raises(ValidationError) as exc_info:
        validate_new_password("a" * 73)

    assert str(exc_info.value) == TOO_LONG


# SDD: 014 REQ-006 AC-006.6
def test_validate_new_password_accepts_72_bytes():
    """72 bytes exactos se aceptan."""
    assert validate_new_password("a" * 72) == "a" * 72


# SDD: 014 REQ-006 AC-006.7
def test_validate_new_password_rejects_37_enyes_that_are_74_bytes():
    """37 'ñ' son 37 caracteres pero 74 bytes: demasiado larga."""
    with pytest.raises(ValidationError) as exc_info:
        validate_new_password("ñ" * 37)

    assert str(exc_info.value) == TOO_LONG


# SDD: 014 REQ-006 AC-006.8
def test_validate_new_password_accepts_36_enyes_that_are_72_bytes():
    """36 'ñ' son exactamente 72 bytes: se aceptan."""
    assert validate_new_password("ñ" * 36) == "ñ" * 36


# SDD: 014 REQ-006 AC-006.9
def test_validate_new_password_counts_emojis_as_one_character():
    """7 emojis son 7 caracteres (28 bytes): menos de 8, mínimo no cumplido."""
    with pytest.raises(ValidationError) as exc_info:
        validate_new_password("😀" * 7)

    assert str(exc_info.value) == TOO_SHORT


# SDD: 014 REQ-006 AC-006.9
def test_validate_new_password_accepts_8_emojis():
    """8 emojis son 8 caracteres (32 bytes): se aceptan."""
    assert validate_new_password("😀" * 8) == "😀" * 8


# SDD: 014 REQ-009 AC-009.1
def test_exceeds_bcrypt_limit_is_measured_in_utf8_bytes():
    """El límite de bcrypt se mide en bytes UTF-8, no en caracteres."""
    assert exceeds_bcrypt_limit("a" * 72) is False
    assert exceeds_bcrypt_limit("a" * 73) is True
    assert exceeds_bcrypt_limit("ñ" * 36) is False
    assert exceeds_bcrypt_limit("ñ" * 37) is True
