from models import Food

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
RATE_LIMIT_MESSAGE = "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
UNAVAILABLE_MESSAGE = "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."


def normalize_query(raw_query: str | None) -> str:
    raise NotImplementedError("not implemented")


def fuse_rankings(text_ids: list[int], semantic_ids: list[int],
                  limit: int = MAX_RESULTS, k: int = RRF_K) -> list[int]:
    raise NotImplementedError("not implemented")


class FoodSearchService:
    def __init__(self, food_repository, embedding_client, rate_limiter,
                 max_distance: float = DEFAULT_MAX_DISTANCE):
        self.food_repository = food_repository
        self.embedding_client = embedding_client
        self.rate_limiter = rate_limiter
        self.max_distance = max_distance

    def search(self, user_id: str, raw_query: str | None) -> list[Food]:
        raise NotImplementedError("not implemented")
