"""Unitarios de ProgressAnalysisService, con foco en MOCKEAR una dependencia
externa real (Claude/Anthropic, via LLMClient). Sin esto, un test que
llamara al servicio de verdad: seria lento, costaria dinero real cada vez
que corren los tests, y fallaria sin internet o si Anthropic tiene un
problema - nada de eso tiene que ver con si NUESTRA logica esta bien.

Esto es posible sin librerias de mocking (unittest.mock, etc.) porque
ProgressAnalysisService ya recibe su LLMClient por parametro en el
constructor (inyeccion de dependencias, ver utils/llm_client.py) - el
servicio no sabe ni le importa si el objeto que le pasamos habla con
Anthropic de verdad o es este FakeLLMClient de aca abajo.
"""

from datetime import date

import pytest

from services.progress_analysis_service import ProgressAnalysisService, MAX_ANALYSES_PER_WINDOW
from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError
from tests.fakes import FakeUnitOfWork


class FakeBodyMetricRepository:
    def __init__(self, metrics=None):
        self.metrics = metrics or []

    def list_by_user(self, user_id):
        return self.metrics


class FakeProgressAnalysisRepository:
    def __init__(self, count_since_value=0):
        self.count_since_value = count_since_value
        self.created = []

    def count_since(self, user_id, window):
        return self.count_since_value

    def create(self, analysis):
        self.created.append(analysis)


class FakeLLMClient:
    """El doble de Anthropic. `raise_error` simula una falla real del
    proveedor (rate limit, timeout, lo que sea); si es None, generate()
    simplemente devuelve `answer` como si Claude hubiera respondido bien."""
    def __init__(self, answer="Analisis de mentira, generado sin tocar Anthropic", raise_error=None):
        self.answer = answer
        self.raise_error = raise_error
        self.calls = []

    def generate(self, system_prompt, messages):
        self.calls.append((system_prompt, messages))
        if self.raise_error:
            raise self.raise_error
        return self.answer


def make_metric(**overrides):
    defaults = dict(
        weight=70.0,
        body_fat_percentage=None,
        muscle_mass_percentage=None,
        notes=None,
        recorded_at=date.today(),
    )
    defaults.update(overrides)
    from types import SimpleNamespace
    return SimpleNamespace(**defaults)


def make_service(metrics=None, count_since_value=0, llm_client=None):
    body_metric_repository = FakeBodyMetricRepository(metrics)
    progress_analysis_repository = FakeProgressAnalysisRepository(count_since_value)
    llm_client = llm_client or FakeLLMClient()
    service = ProgressAnalysisService(
        body_metric_repository,
        progress_analysis_repository,
        FakeUnitOfWork(),
        llm_client,
    )
    return service, progress_analysis_repository, llm_client


def test_returns_a_friendly_message_and_never_calls_claude_when_there_is_no_data():
    service, progress_analysis_repository, llm_client = make_service(metrics=[])

    result = service.analyze(user_id="user-1")

    assert "Todavía no hay registros" in result or "Todavia no hay registros" in result
    # Lo importante: sin datos, ni siquiera se llega a gastar una llamada a
    # Claude ni a contar contra el limite diario.
    assert llm_client.calls == []
    assert progress_analysis_repository.created == []


def test_raises_rate_limit_error_and_never_calls_claude_when_quota_is_reached():
    service, progress_analysis_repository, llm_client = make_service(
        metrics=[make_metric()],
        count_since_value=MAX_ANALYSES_PER_WINDOW,
    )

    with pytest.raises(RateLimitError):
        service.analyze(user_id="user-1")

    # El chequeo de limite corta ANTES de llamar a Claude - un usuario que
    # ya gasto sus 2 corridas del dia no debe generar una tercera llamada
    # real (y su costo) solo para despues rechazarla.
    assert llm_client.calls == []


def test_calls_claude_and_returns_its_answer_when_under_the_limit():
    fake_llm = FakeLLMClient(answer="Vas progresando bien segun tus ultimos registros.")
    service, progress_analysis_repository, llm_client = make_service(
        metrics=[make_metric()],
        count_since_value=0,
        llm_client=fake_llm,
    )

    result = service.analyze(user_id="user-1")

    assert result == "Vas progresando bien segun tus ultimos registros."
    assert len(llm_client.calls) == 1
    # El intento se logueo (cuenta contra el limite de manana) y se confirmo
    # la transaccion.
    assert len(progress_analysis_repository.created) == 1


def test_a_claude_failure_becomes_a_clean_service_unavailable_error():
    fake_llm = FakeLLMClient(raise_error=ConnectionError("Anthropic esta caido"))
    service, _, _ = make_service(metrics=[make_metric()], llm_client=fake_llm)

    # El error crudo de Anthropic (ConnectionError, o el que sea) nunca
    # deberia llegarle al caller - queda envuelto en un ServiceUnavailableError
    # prolijo, con un mensaje que tiene sentido mostrarle al usuario.
    with pytest.raises(ServiceUnavailableError):
        service.analyze(user_id="user-1")
