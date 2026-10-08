"""Firma del feedback_id del coach (ADR-0018)."""


class FeedbackTokenSigner:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def sign(self, user_id, trace_id: str) -> str:
        raise NotImplementedError("not implemented")

    def verify(self, user_id, token) -> str | None:
        raise NotImplementedError("not implemented")
