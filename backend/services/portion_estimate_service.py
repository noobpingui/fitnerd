"""Servicio de estimación de porciones del diario (spec 030, ADR-0037)."""

import logging

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError
from services.portion_estimate_rules import (
    MAX_OUTPUT_TOKENS,
    PORTION_TOOL,
    SYSTEM_PROMPT,
    TEMPERATURE,
    PortionEstimate,
    build_estimate,
    parse_question,
)
from utils.tracing import Tracer, format_error

MAX_QUESTIONS_PER_WINDOW = 10
RATE_LIMIT_WINDOW_SECONDS = 6 * 60 * 60  # 21.600
RATE_LIMIT_KEY_PREFIX = "ratelimit:meals:portion-estimate:"
RATE_LIMIT_MESSAGE = (
    "Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a intentarlo más tarde."
)
PROVIDER_UNAVAILABLE_MESSAGE = (
    "No se pudo estimar el peso en este momento. Vuelve a intentarlo en unos minutos."
)
TRACE_NAME = "meal-portion-estimate"


class PortionEstimateService:
    def __init__(self, llm_client, rate_limiter, tracer=None, logger=None):
        self.llm_client = llm_client
        self.rate_limiter = rate_limiter
        self.tracer = tracer
        self.logger = logger

    def estimate(self, user_id: str, data: object) -> PortionEstimate:
        question = parse_question(data)

        tracer = self.tracer or Tracer()
        logger = self.logger or logging.getLogger(__name__)
        try:
            allowed = self.rate_limiter.check_and_increment(
                f"{RATE_LIMIT_KEY_PREFIX}{user_id}",
                MAX_QUESTIONS_PER_WINDOW,
                RATE_LIMIT_WINDOW_SECONDS,
            )
        except Exception as exc:
            logger.error("Falló el límite de preguntas de porciones: %s", format_error(exc))
            raise ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE) from None
        if not allowed:
            raise RateLimitError(RATE_LIMIT_MESSAGE)

        trace = tracer.start_trace(TRACE_NAME, user_id=str(user_id), input=question)

        messages = [{"role": "user", "content": question}]
        step = trace.start_step(
            "generation", "generation", messages, getattr(self.llm_client, "model", None)
        )
        try:
            result = self.llm_client.generate_structured(
                SYSTEM_PROMPT, messages, PORTION_TOOL, MAX_OUTPUT_TOKENS, TEMPERATURE
            )
        except Exception as exc:
            step.fail(exc)
            logger.error("Falló la estimación de una porción: %s", format_error(exc))
            trace.add_score("outcome", "error", "CATEGORICAL")
            trace.finish({"outcome": "error"})
            raise ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE) from None

        step.end(
            {"stop_reason": result.stop_reason, "data": result.data},
            {"input": result.input_tokens, "output": result.output_tokens},
        )
        estimate = build_estimate(result.data)
        trace.add_score("outcome", estimate.status, "CATEGORICAL")
        trace.finish(
            {
                "status": estimate.status,
                "grams": estimate.grams,
                "unit": estimate.unit,
                "note": estimate.note,
                "message": estimate.message,
            }
        )
        return estimate
