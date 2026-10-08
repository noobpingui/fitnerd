from utils.feedback_token import FeedbackTokenSigner
from utils.rate_limiter import RateLimiter
from utils.tracing import Tracer


class CoachFeedbackService:
    def __init__(self, signer: FeedbackTokenSigner, rate_limiter: RateLimiter, tracer: Tracer):
        self.signer = signer
        self.rate_limiter = rate_limiter
        self.tracer = tracer

    def submit(self, user_id, feedback_id, rating) -> None:
        raise NotImplementedError("not implemented")
