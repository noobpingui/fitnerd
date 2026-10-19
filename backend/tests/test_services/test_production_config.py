"""Tests de `FRONTEND_BASE_URL` (spec 020, REQ-006, ADR-0028): la función
`resolve_frontend_base_url` y el arranque de `create_app` con las
configuraciones de producción, desarrollo y pruebas. Las apps extra se crean
con el fixture `make_app` (base de datos de pruebas, sin Langfuse ni correo
real); «sin variable» se expresa con `FRONTEND_BASE_URL=None`, que es lo que
devuelve `os.getenv` cuando falta.
"""

import re

import pytest

from app import create_app
from config import (
    DEFAULT_FRONTEND_BASE_URL,
    FRONTEND_BASE_URL_REQUIRED_MESSAGE,
    resolve_frontend_base_url,
)

MESSAGE = "FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://"
PROD_URL = "https://fitnerd.betofallas.dev"
LOCAL_URL = "http://localhost:5173"


def message_match():
    return re.escape(MESSAGE)


def test_the_required_message_and_the_default_match_the_spec():
    assert FRONTEND_BASE_URL_REQUIRED_MESSAGE == MESSAGE
    assert DEFAULT_FRONTEND_BASE_URL == LOCAL_URL


# --------------------------------------------------------------------------
# resolve_frontend_base_url
# --------------------------------------------------------------------------


# SDD: 020 REQ-006 AC-006.1
def test_resolve_requires_a_value_in_production_when_it_is_missing():
    with pytest.raises(ValueError, match=message_match()):
        resolve_frontend_base_url(None, required=True)


# SDD: 020 REQ-006 AC-006.2
@pytest.mark.parametrize("value", ["", "   ", "\t\n"])
def test_resolve_requires_a_value_in_production_when_it_is_empty_or_blank(value):
    with pytest.raises(ValueError, match=message_match()):
        resolve_frontend_base_url(value, required=True)


# SDD: 020 REQ-006 AC-006.3
@pytest.mark.parametrize(
    "value", ["http://localhost:5173", "http://fitnerd.betofallas.dev", "fitnerd.betofallas.dev", "ftp://x"]
)
def test_resolve_rejects_in_production_a_value_that_is_not_https(value):
    with pytest.raises(ValueError, match=message_match()):
        resolve_frontend_base_url(value, required=True)


# SDD: 020 REQ-006 AC-006.4
def test_resolve_accepts_an_https_value_in_production():
    assert resolve_frontend_base_url(PROD_URL, required=True) == PROD_URL


# SDD: 020 REQ-006 AC-006.4
def test_resolve_strips_the_spaces_of_a_valid_value_in_production():
    assert resolve_frontend_base_url(f"  {PROD_URL}  ", required=True) == PROD_URL


# SDD: 020 REQ-006 AC-006.5
def test_resolve_uses_the_local_default_when_not_required_and_missing():
    assert resolve_frontend_base_url(None, required=False) == LOCAL_URL


# SDD: 020 REQ-006 AC-006.5
def test_resolve_keeps_the_given_value_when_not_required():
    assert resolve_frontend_base_url("http://otro:3000", required=False) == "http://otro:3000"


# --------------------------------------------------------------------------
# create_app
# --------------------------------------------------------------------------


# SDD: 020 REQ-006 AC-006.1
def test_production_app_does_not_start_without_the_variable(make_app):
    with pytest.raises(ValueError, match=message_match()):
        make_app("production", FRONTEND_BASE_URL=None)


# SDD: 020 REQ-006 AC-006.2
@pytest.mark.parametrize("value", ["", "   "])
def test_production_app_does_not_start_with_an_empty_or_blank_value(make_app, value):
    with pytest.raises(ValueError, match=message_match()):
        make_app("production", FRONTEND_BASE_URL=value)


# SDD: 020 REQ-006 AC-006.3
def test_production_app_does_not_start_with_a_local_http_value(make_app):
    with pytest.raises(ValueError, match=message_match()):
        make_app("production", FRONTEND_BASE_URL="http://localhost:5173")


# SDD: 020 REQ-006 AC-006.4
def test_production_app_starts_with_an_https_value(make_app):
    flask_app = make_app("production", FRONTEND_BASE_URL=PROD_URL)

    assert flask_app.config["FRONTEND_BASE_URL"] == PROD_URL


# SDD: 020 REQ-006 AC-006.5
def test_development_app_starts_without_the_variable_with_the_local_default(make_app):
    flask_app = make_app("development", FRONTEND_BASE_URL=None)

    assert flask_app.config["FRONTEND_BASE_URL"] == LOCAL_URL


# SDD: 020 REQ-006 AC-006.5
def test_development_app_keeps_a_value_that_is_not_https(make_app):
    flask_app = make_app("development", FRONTEND_BASE_URL="http://192.168.1.5:5173")

    assert flask_app.config["FRONTEND_BASE_URL"] == "http://192.168.1.5:5173"


# SDD: 020 REQ-006 AC-006.6
def test_testing_app_always_uses_the_local_default():
    flask_app = create_app("testing")

    assert flask_app.config["FRONTEND_BASE_URL"] == LOCAL_URL


# SDD: 020 REQ-006 AC-006.6
def test_testing_app_ignores_the_value_of_the_environment_variable():
    """La configuración de pruebas fija el valor en su clase, no lo lee del
    entorno: la app de pruebas de la sesión (creada con el `.env` local)
    siempre usa el valor local."""
    flask_app = create_app("testing")

    assert flask_app.config["FRONTEND_BASE_URL"] == LOCAL_URL
    assert flask_app.config["TESTING"] is True
