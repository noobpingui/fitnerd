"""Servicio del análisis de la foto de una comida (spec 024)."""

import logging

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError
from services.meal_image_rules import (
    SYSTEM_PROMPT,
    MealImageAnalysis,
    build_analysis,
    build_user_prompt,
)
from services.meal_photo import prepare_photo
from utils.tracing import Tracer
from utils.vision_client import VisionProviderError, describe_vision_error

MAX_ANALYSES_PER_WINDOW = 10
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
RATE_LIMIT_MESSAGE = (
    "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."
)
PROVIDER_UNAVAILABLE_MESSAGE = (
    "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."
)
TRACE_NAME = "meal-image-analysis"
RATE_LIMIT_KEY_PREFIX = "ratelimit:meals:analyze:"


class MealImageAnalysisService:
    def __init__(self, catalog_repository, vision_client, rate_limiter, tracer=None, logger=None):
        self.catalog_repository = catalog_repository
        self.vision_client = vision_client
        self.rate_limiter = rate_limiter
        self.tracer = tracer
        self.logger = logger

    def analyze(self, user_id: str, images: list[bytes]) -> MealImageAnalysis:
        photo = prepare_photo(images)
        allowed = self.rate_limiter.check_and_increment(
            f"{RATE_LIMIT_KEY_PREFIX}{user_id}",
            MAX_ANALYSES_PER_WINDOW,
            RATE_LIMIT_WINDOW_SECONDS,
        )
        if not allowed:
            raise RateLimitError(RATE_LIMIT_MESSAGE)

        tracer = self.tracer or Tracer()
        logger = self.logger or logging.getLogger(__name__)
        trace = tracer.start_trace(
            TRACE_NAME,
            user_id=str(user_id),
            input={"format": photo.format, "size_bytes": photo.size_bytes},
        )
        try:
            catalog = self.catalog_repository.list_all()
            if not catalog:
                raise VisionProviderError("empty catalog")
            step = trace.start_step(
                "vision",
                "generation",
                {
                    "format": photo.format,
                    "size_bytes": photo.size_bytes,
                    "catalog_size": len(catalog),
                },
                getattr(self.vision_client, "model_id", None),
            )
            try:
                result = self.vision_client.recognize_foods(
                    photo.data, photo.format, SYSTEM_PROMPT, build_user_prompt(catalog)
                )
            except Exception as exc:
                # Nunca la excepción original: su mensaje puede llevar los bytes de la imagen.
                step.fail(VisionProviderError(describe_vision_error(exc)))
                raise
            step.end(
                {"foods": len(result.foods)},
                {"input": result.input_tokens, "output": result.output_tokens},
            )
            analysis = build_analysis(result.foods, {food.id: food for food in catalog})
        except Exception as exc:
            logger.error(
                "Falló el análisis de la foto de una comida: %s", describe_vision_error(exc)
            )
            trace.add_score("outcome", "error", "CATEGORICAL")
            trace.finish({"outcome": "error"})
            raise ServiceUnavailableError(PROVIDER_UNAVAILABLE_MESSAGE) from None

        outcome = "answered" if analysis.items or analysis.unmatched else "empty"
        trace.add_score("outcome", outcome, "CATEGORICAL")
        trace.add_score("items_count", len(analysis.items), "NUMERIC")
        trace.add_score("unmatched_count", len(analysis.unmatched), "NUMERIC")
        trace.finish({"items": len(analysis.items), "unmatched": len(analysis.unmatched)})
        return analysis
