"""Servicio del análisis de la foto de una comida (spec 024)."""

from services.meal_image_rules import MealImageAnalysis

MAX_ANALYSES_PER_WINDOW = 10
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
RATE_LIMIT_MESSAGE = (
    "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."
)
PROVIDER_UNAVAILABLE_MESSAGE = (
    "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."
)
TRACE_NAME = "meal-image-analysis"


class MealImageAnalysisService:
    def __init__(self, catalog_repository, vision_client, rate_limiter, tracer=None, logger=None):
        self.catalog_repository = catalog_repository
        self.vision_client = vision_client
        self.rate_limiter = rate_limiter
        self.tracer = tracer
        self.logger = logger

    def analyze(self, _user_id: str, _images: list[bytes]) -> MealImageAnalysis:
        raise NotImplementedError("not implemented")
