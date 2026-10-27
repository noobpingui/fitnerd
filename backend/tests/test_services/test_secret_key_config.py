"""Tests de `SECRET_KEY` (spec 027, REQ-001..003): la función `resolve_secret_key`
y el arranque de `create_app` con las configuraciones de producción, desarrollo y
pruebas. Las apps extra se crean con el fixture `make_app`; «sin variable» se
expresa con `SECRET_KEY=None`, que es lo que devuelve `os.getenv` cuando falta.
"""

import re

import pytest

from config import (
    DEFAULT_SECRET_KEY,
    KNOWN_DEFAULT_SECRET_KEYS,
    SECRET_KEY_REQUIRED_MESSAGE,
    DevelopmentConfig,
    ProductionConfig,
    TestingConfig,
    resolve_secret_key,
)

MESSAGE = "SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto"
FRONTEND_MESSAGE = "FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://"
PROD_URL = "https://fitnerd.betofallas.dev"

# Claves que producción debe rechazar (AC-001.1 a AC-001.5).
INVALID_KEYS = [
    None,
    "DEFAULT SECRET",
    "change-me",
    "",
    "   ",
    "\t\n",
    " DEFAULT SECRET ",
    "DEFAULT SECRET\n",
    "\tchange-me ",
]


def message_match():
    return re.escape(MESSAGE)


# SDD: 027 REQ-001 AC-001.1
def test_only_the_production_config_requires_its_own_secret_key():
    """`ProductionConfig.SECRET_KEY_REQUIRED` es verdadero; el resto, falso. Las
    constantes (mensaje, valor por defecto y valores conocidos) son las de la spec."""
    assert SECRET_KEY_REQUIRED_MESSAGE == MESSAGE
    assert DEFAULT_SECRET_KEY == "DEFAULT SECRET"
    assert KNOWN_DEFAULT_SECRET_KEYS == {"DEFAULT SECRET", "change-me"}
    assert ProductionConfig.SECRET_KEY_REQUIRED is True
    assert DevelopmentConfig.SECRET_KEY_REQUIRED is False
    assert TestingConfig.SECRET_KEY_REQUIRED is False


# --------------------------------------------------------------------------
# resolve_secret_key
# --------------------------------------------------------------------------


# SDD: 027 REQ-001 AC-001.1
def test_resolve_rejects_in_production_a_missing_key():
    with pytest.raises(ValueError, match=message_match()):
        resolve_secret_key(None, required=True)


# SDD: 027 REQ-001 AC-001.2
# SDD: 027 REQ-001 AC-001.3
@pytest.mark.parametrize("value", ["DEFAULT SECRET", "change-me"])
def test_resolve_rejects_in_production_the_known_default_values(value):
    with pytest.raises(ValueError, match=message_match()):
        resolve_secret_key(value, required=True)


# SDD: 027 REQ-001 AC-001.4
@pytest.mark.parametrize("value", ["", "   ", "\t\n"])
def test_resolve_rejects_in_production_an_empty_or_blank_key(value):
    with pytest.raises(ValueError, match=message_match()):
        resolve_secret_key(value, required=True)


# SDD: 027 REQ-001 AC-001.5
@pytest.mark.parametrize("value", [" DEFAULT SECRET ", "DEFAULT SECRET\n", "\tchange-me "])
def test_resolve_rejects_in_production_a_default_value_with_surrounding_spaces(value):
    with pytest.raises(ValueError, match=message_match()):
        resolve_secret_key(value, required=True)


# SDD: 027 REQ-002 AC-002.1
# SDD: 027 REQ-002 AC-002.2
@pytest.mark.parametrize("value", ["una-clave-propia-de-produccion", "  clave con espacios  "])
def test_resolve_returns_a_valid_production_key_unchanged(value):
    """La clave válida se devuelve idéntica, sin recortar."""
    assert resolve_secret_key(value, required=True) == value


# SDD: 027 REQ-003 AC-003.1
def test_resolve_uses_the_default_when_not_required_and_missing():
    assert resolve_secret_key(None, required=False) == "DEFAULT SECRET"


# SDD: 027 REQ-003 AC-003.2
@pytest.mark.parametrize("value", ["change-me", "DEFAULT SECRET", ""])
def test_resolve_keeps_the_value_when_not_required(value):
    assert resolve_secret_key(value, required=False) == value


# --------------------------------------------------------------------------
# create_app
# --------------------------------------------------------------------------


# SDD: 027 REQ-001 AC-001.1
# SDD: 027 REQ-001 AC-001.2
# SDD: 027 REQ-001 AC-001.3
# SDD: 027 REQ-001 AC-001.4
# SDD: 027 REQ-001 AC-001.5
@pytest.mark.parametrize("value", INVALID_KEYS)
def test_production_app_does_not_start_with_an_invalid_secret_key(make_app, value):
    with pytest.raises(ValueError, match=message_match()):
        make_app("production", FRONTEND_BASE_URL=PROD_URL, SECRET_KEY=value)


# Guarda de regresión de la 020: pasa sin implementar la 027.
# SDD: 027 REQ-001 AC-001.6
def test_production_app_does_not_start_when_both_variables_are_invalid(make_app):
    """Con las dos variables mal falla con el mensaje de cualquiera de las dos."""
    either = f"{re.escape(FRONTEND_MESSAGE)}|{message_match()}"
    with pytest.raises(ValueError, match=either):
        make_app("production", FRONTEND_BASE_URL="http://localhost:5173", SECRET_KEY=None)


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-002 AC-002.1
# SDD: 027 REQ-002 AC-002.2
@pytest.mark.parametrize("value", ["una-clave-propia-de-produccion", "  clave con espacios  "])
def test_production_app_starts_and_keeps_the_exact_secret_key(make_app, value):
    flask_app = make_app("production", FRONTEND_BASE_URL=PROD_URL, SECRET_KEY=value)

    assert flask_app.config["SECRET_KEY"] == value


# Guarda de regresión de la 020: pasa sin implementar la 027.
# SDD: 027 NFR-002 AC-N002.1
def test_production_app_starts_in_tests_without_secret_key_in_the_environment(make_app):
    """Los tests de producción de la 020 no necesitan `SECRET_KEY` en el entorno:
    sin override, el fixture `make_app` aporta una propia de pruebas, así que el
    arranque no depende de lo que haya en `os.environ`."""
    flask_app = make_app("production", FRONTEND_BASE_URL=PROD_URL)

    assert flask_app.config["SECRET_KEY"] == "test-production-secret-key"


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 NFR-001 AC-N001.2
def test_restore_token_round_trip_still_works_with_the_026_signer():
    """El firmante de la 026 no cambia: firma y verifica un payload del snapshot."""
    from utils.restore_token import RestoreTokenSigner

    payload = {"v": 1, "d": "2026-10-20", "t": "breakfast", "p": 1, "s": "custom"}
    signer = RestoreTokenSigner("test-secret")

    assert signer.verify(7, signer.sign(7, payload)) == payload


# SDD: 027 REQ-003 AC-003.1
def test_development_app_starts_without_the_variable_with_the_default(make_app):
    flask_app = make_app("development", FRONTEND_BASE_URL=None, SECRET_KEY=None)

    assert flask_app.config["SECRET_KEY"] == "DEFAULT SECRET"


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-003 AC-003.2
def test_development_app_starts_with_a_default_looking_value(make_app):
    flask_app = make_app("development", FRONTEND_BASE_URL=None, SECRET_KEY="change-me")

    assert flask_app.config["SECRET_KEY"] == "change-me"


# Guarda de regresión de la 026: pasa sin implementar la 027.
# SDD: 027 REQ-003 AC-003.3
@pytest.mark.parametrize("value", [None, "DEFAULT SECRET"])
def test_testing_app_starts_without_its_own_secret_key(make_app, value):
    flask_app = make_app("testing", SECRET_KEY=value)

    assert flask_app is not None
