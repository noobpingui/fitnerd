import logging

from exceptions.custom_exceptions import RateLimitError, ServiceUnavailableError, ValidationError
from models import Food

logger = logging.getLogger(__name__)

MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 100
MAX_RESULTS = 20
MAX_SEARCHES_PER_WINDOW = 30
RATE_LIMIT_WINDOW_SECONDS = 60
TEXT_CANDIDATES = 40
SEMANTIC_CANDIDATES = 40
RRF_K = 60
DEFAULT_MAX_DISTANCE = 0.6
EMPTY_QUERY_MESSAGE = "Escribe qué alimento quieres buscar."
SHORT_QUERY_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
LONG_QUERY_MESSAGE = "La búsqueda no puede superar los 100 caracteres."
RATE_LIMIT_MESSAGE = (
    "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
)
UNAVAILABLE_MESSAGE = (
    "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."
)


def normalize_query(raw_query: str | None) -> str:
    query = (raw_query or "").strip()
    if not query:
        raise ValidationError(EMPTY_QUERY_MESSAGE)
    if len(query) < MIN_QUERY_LENGTH:
        raise ValidationError(SHORT_QUERY_MESSAGE)
    if len(query) > MAX_QUERY_LENGTH:
        raise ValidationError(LONG_QUERY_MESSAGE)
    return query


def fuse_rankings(text_ids: list[int], semantic_ids: list[int],
                  limit: int = MAX_RESULTS, k: int = RRF_K) -> list[int]:
    scores: dict[int, float] = {}
    for ranking in (text_ids, semantic_ids):
        for position, fdc_id in enumerate(ranking, start=1):
            scores[fdc_id] = scores.get(fdc_id, 0.0) + 1.0 / (k + position)
    ordered = sorted(scores, key=lambda fdc_id: (-scores[fdc_id], fdc_id))
    return ordered[:limit]


class FoodSearchService:
    def __init__(self, food_repository, embedding_client, rate_limiter,
                 max_distance: float = DEFAULT_MAX_DISTANCE):
        self.food_repository = food_repository
        self.embedding_client = embedding_client
        self.rate_limiter = rate_limiter
        self.max_distance = max_distance

    def search(self, user_id: str, raw_query: str | None) -> list[Food]:
        query = normalize_query(raw_query)

        allowed = self.rate_limiter.check_and_increment(
            key=f"ratelimit:foods:search:{user_id}",
            limit=MAX_SEARCHES_PER_WINDOW,
            window_seconds=RATE_LIMIT_WINDOW_SECONDS,
        )
        if not allowed:
            raise RateLimitError(RATE_LIMIT_MESSAGE)

        try:
            vector = self.embedding_client.embed_query(query)
        except Exception:
            logger.exception("Falló el proveedor de embeddings en la búsqueda de alimentos")
            raise ServiceUnavailableError(UNAVAILABLE_MESSAGE)

        text_ids = self.food_repository.find_text_matches(query, TEXT_CANDIDATES)
        semantic_ids = self.food_repository.find_semantic_matches(
            vector, self.max_distance, SEMANTIC_CANDIDATES
        )
        ordered_ids = fuse_rankings(text_ids, semantic_ids)
        if not ordered_ids:
            return []

        by_id = {food.fdc_id: food for food in self.food_repository.get_by_fdc_ids(ordered_ids)}
        return [by_id[fdc_id] for fdc_id in ordered_ids if fdc_id in by_id]
