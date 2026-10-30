"""Servicio de estimación de porciones del diario (spec 030, ADR-0037)."""

from services.portion_estimate_rules import PortionEstimate

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
        raise NotImplementedError("not implemented")
