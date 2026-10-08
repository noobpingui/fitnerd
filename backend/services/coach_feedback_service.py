from exceptions.custom_exceptions import RateLimitError, ResourceNotFoundError, ValidationError
from utils.feedback_token import FeedbackTokenSigner
from utils.rate_limiter import RateLimiter
from utils.tracing import Tracer

MAX_FEEDBACK_PER_WINDOW = 60
FEEDBACK_WINDOW_SECONDS = 60 * 60
SCORE_NAME = "user_feedback"
ALLOWED_RATINGS = {"up", "down"}

MISSING_ID_MESSAGE = "Falta el identificador de la respuesta"
INVALID_RATING_MESSAGE = "La valoración debe ser 'up' o 'down'"
NOT_FOUND_MESSAGE = "No se encontró la respuesta que quieres valorar"
RATE_LIMIT_MESSAGE = (
    f"Alcanzaste el límite de {MAX_FEEDBACK_PER_WINDOW} valoraciones por hora. "
    "Vuelve a intentarlo en un rato."
)


class CoachFeedbackService:
    def __init__(self, signer: FeedbackTokenSigner, rate_limiter: RateLimiter, tracer: Tracer):
        self.signer = signer
        self.rate_limiter = rate_limiter
        self.tracer = tracer

    def submit(self, user_id, feedback_id, rating) -> None:
        # El orden importa: los 400 y 404 no cuentan para el límite.
        if not isinstance(feedback_id, str) or not feedback_id.strip():
            raise ValidationError(MISSING_ID_MESSAGE)

        if not isinstance(rating, str) or rating not in ALLOWED_RATINGS:
            raise ValidationError(INVALID_RATING_MESSAGE)

        trace_id = self.signer.verify(user_id, feedback_id)
        if trace_id is None:
            raise ResourceNotFoundError(NOT_FOUND_MESSAGE)

        allowed = self.rate_limiter.check_and_increment(
            key=f"ratelimit:coach:feedback:{user_id}",
            limit=MAX_FEEDBACK_PER_WINDOW,
            window_seconds=FEEDBACK_WINDOW_SECONDS,
        )
        if not allowed:
            raise RateLimitError(RATE_LIMIT_MESSAGE)

        # score_id determinista: Langfuse sustituye el voto anterior en vez de duplicarlo.
        self.tracer.score_trace(
            trace_id,
            SCORE_NAME,
            1 if rating == "up" else 0,
            "BOOLEAN",
            f"{trace_id}-{SCORE_NAME}",
        )
