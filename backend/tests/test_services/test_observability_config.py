"""Configuración de la observabilidad (config.py): URL por defecto de Langfuse,
activación solo con las dos claves, inactividad en tests y etiqueta de entorno.
"""

import pytest

from config import (
    DevelopmentConfig,
    ProductionConfig,
    TestingConfig,
    observability_enabled,
    resolve_langfuse_base_url,
)

KEYS = {"LANGFUSE_PUBLIC_KEY": "pk-lf-1", "LANGFUSE_SECRET_KEY": "sk-lf-1"}


# SDD: REQ-009 AC-009.4
@pytest.mark.parametrize("value", [None, ""])
def test_base_url_defaults_to_the_us_cloud_when_not_configured(value):
    """Sin URL configurada se usa Langfuse Cloud en la region de EE. UU."""
    assert resolve_langfuse_base_url(value) == "https://us.cloud.langfuse.com"


# SDD: REQ-009 AC-009.5
@pytest.mark.parametrize(
    "value",
    ["https://cloud.langfuse.com", "https://cloud.langfuse.com/"],
)
def test_configured_base_url_is_used_without_trailing_slash(value):
    """Una URL configurada se respeta, sin la barra final."""
    assert resolve_langfuse_base_url(value) == "https://cloud.langfuse.com"


# SDD: REQ-009 AC-009.3
def test_testing_config_has_no_keys_regardless_of_the_environment():
    """TestingConfig fija las claves en `None`, sin leer el entorno."""
    assert TestingConfig.LANGFUSE_PUBLIC_KEY is None
    assert TestingConfig.LANGFUSE_SECRET_KEY is None


# SDD: REQ-009 AC-009.3
def test_observability_is_disabled_when_testing_even_with_both_keys():
    """Con `TESTING` verdadero la observabilidad está inactiva aunque haya
    claves."""
    assert observability_enabled({**KEYS, "TESTING": True}) is False


# SDD: REQ-009 AC-009.3
def test_the_tracer_singleton_is_inactive_in_the_test_app(app):
    """En la app de tests el singleton `extensions.tracer` está inactivo."""
    from extensions import tracer

    assert app.config["LANGFUSE_PUBLIC_KEY"] is None
    assert tracer.enabled is False


# SDD: REQ-009 AC-009.2
def test_observability_is_enabled_with_both_keys_and_testing_false():
    """Con las dos claves y fuera de tests la observabilidad se activa."""
    assert observability_enabled({**KEYS, "TESTING": False}) is True
    assert observability_enabled(dict(KEYS)) is True


# SDD: REQ-009 AC-009.1
@pytest.mark.parametrize(
    "config",
    [
        {"LANGFUSE_PUBLIC_KEY": "pk-lf-1"},
        {"LANGFUSE_SECRET_KEY": "sk-lf-1"},
        {"LANGFUSE_PUBLIC_KEY": "pk-lf-1", "LANGFUSE_SECRET_KEY": None},
        {"LANGFUSE_PUBLIC_KEY": "", "LANGFUSE_SECRET_KEY": "sk-lf-1"},
        {},
    ],
)
def test_observability_is_disabled_without_both_keys(config):
    """Con una sola clave, claves vacías o ninguna, queda inactiva."""
    assert observability_enabled({**config, "TESTING": False}) is False


# SDD: REQ-010 AC-010.1
def test_production_config_labels_traces_as_production():
    """ProductionConfig etiqueta las trazas con `production`."""
    assert ProductionConfig.OBSERVABILITY_ENVIRONMENT == "production"


# SDD: REQ-010 AC-010.2
def test_development_config_labels_traces_as_development():
    """DevelopmentConfig etiqueta las trazas con `development`."""
    assert DevelopmentConfig.OBSERVABILITY_ENVIRONMENT == "development"
