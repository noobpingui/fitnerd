"""Firma del feedback_id del coach (ADR-0018).

Formato: "<trace_id>.<firma>", con la firma HMAC-SHA256 ligada al usuario.
"""

import base64
import hashlib
import hmac
import re

_TOKEN_PATTERN = re.compile(r"^[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$")
_MAX_TOKEN_LENGTH = 100


class FeedbackTokenSigner:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def _signature(self, user_id, trace_id: str) -> str:
        message = f"coach-feedback:v1:{user_id}:{trace_id}".encode("utf-8")
        digest = hmac.new(str(self.secret_key).encode("utf-8"), message, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    def sign(self, user_id, trace_id: str) -> str:
        return f"{trace_id}.{self._signature(str(user_id), trace_id)}"

    def verify(self, user_id, token) -> str | None:
        if not isinstance(token, str) or len(token) > _MAX_TOKEN_LENGTH:
            return None
        if not _TOKEN_PATTERN.match(token):
            return None

        trace_id, signature = token.split(".", 1)
        expected = self._signature(str(user_id), trace_id)
        if hmac.compare_digest(expected, signature):
            return trace_id
        return None
