"""Unitarios de CoachService, con foco en el rate limiter nuevo (Redis) -
mismo espiritu que test_progress_analysis_service.py: un FakeRateLimiter
en vez de Redis real, para probar la LOGICA (se corta antes de llamar a
Claude, la key incluye el user_id correcto) sin depender de que haya un
Redis corriendo para poder correr los tests.
"""

import pytest

from services.coach_service import CoachService, MAX_QUESTIONS_PER_WINDOW
from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError
from tests.fakes import FakeLLMClient, FakeRateLimiter


class FakeRetrievalService:
    def __init__(self, chunks=None):
        self.chunks = chunks if chunks is not None else [{"chunk_text": "contexto de prueba"}]
        self.calls = []

    def search(self, query):
        self.calls.append(query)
        return self.chunks


def make_service(chunks=None, llm_client=None, rate_limiter_allowed=True):
    retrieval_service = FakeRetrievalService(chunks)
    llm_client = llm_client or FakeLLMClient()
    rate_limiter = FakeRateLimiter(allowed=rate_limiter_allowed)
    service = CoachService(retrieval_service, llm_client, rate_limiter)
    return service, retrieval_service, llm_client, rate_limiter


def test_raises_rate_limit_error_and_never_touches_retrieval_or_claude_when_over_the_limit():
    service, retrieval_service, llm_client, rate_limiter = make_service(rate_limiter_allowed=False)

    with pytest.raises(RateLimitError):
        service.ask("Como progreso en fuerza?", user_id="user-1")

    # El corte es ANTES de gastar nada - a diferencia de ProgressAnalysisService
    # (que primero chequea si hay datos), aca no hay ningun caso "gratis":
    # si ya se agoto el limite, ni siquiera se busca contexto.
    assert retrieval_service.calls == []
    assert llm_client.calls == []


def test_checks_the_limit_using_a_key_scoped_to_the_user():
    service, _, _, rate_limiter = make_service()

    service.ask("Pregunta cualquiera", user_id="user-42")

    assert len(rate_limiter.calls) == 1
    key, limit, window_seconds = rate_limiter.calls[0]
    assert "user-42" in key
    assert limit == MAX_QUESTIONS_PER_WINDOW


def test_returns_a_message_without_calling_claude_when_no_relevant_context_is_found():
    service, _, llm_client, _ = make_service(chunks=[])

    result = service.ask("Pregunta sin contexto relacionado", user_id="user-1")

    assert "No tengo informacion" in result or "No tengo información" in result
    assert llm_client.calls == []


def test_returns_claudes_answer_when_under_the_limit_and_context_exists():
    fake_llm = FakeLLMClient(answer="Segun tu progreso, vas bien.")
    service, _, llm_client, _ = make_service(llm_client=fake_llm)

    result = service.ask("Como progreso?", user_id="user-1")

    assert result == "Segun tu progreso, vas bien."
    assert len(llm_client.calls) == 1


def test_a_claude_failure_becomes_a_clean_service_unavailable_error():
    fake_llm = FakeLLMClient(raise_error=ConnectionError("Anthropic esta caido"))
    service, _, _, _ = make_service(llm_client=fake_llm)

    with pytest.raises(ServiceUnavailableError):
        service.ask("Pregunta cualquiera", user_id="user-1")
