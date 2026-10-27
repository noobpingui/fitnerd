"""Firma del token de restauración de un alimento quitado del diario (ADR-0035).

Formato: "<payload>.<firma>", con el payload en JSON codificado en base64url sin relleno y la
firma HMAC-SHA256 ligada al usuario.
"""

import base64
import binascii
import hashlib
import hmac
import json

MAX_RESTORE_TOKEN_LENGTH = 4096


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


class RestoreTokenSigner:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def _signature(self, user_id, payload_b64: str) -> str:
        message = f"meal-item-restore:v1:{user_id}:{payload_b64}".encode("utf-8")
        digest = hmac.new(str(self.secret_key).encode("utf-8"), message, hashlib.sha256).digest()
        return _b64encode(digest)

    def sign(self, user_id, payload: dict) -> str:
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        payload_b64 = _b64encode(raw)
        return f"{payload_b64}.{self._signature(str(user_id), payload_b64)}"

    def verify(self, user_id, token: object) -> dict | None:
        if not isinstance(token, str) or len(token) > MAX_RESTORE_TOKEN_LENGTH:
            return None
        if token.count(".") != 1:
            return None
        payload_b64, signature = token.split(".")
        if not payload_b64 or not signature:
            return None

        expected = self._signature(str(user_id), payload_b64)
        if not hmac.compare_digest(expected.encode("ascii"), signature.encode("utf-8")):
            return None

        try:
            padded = payload_b64 + "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        except (ValueError, binascii.Error):
            return None
        return payload if isinstance(payload, dict) else None
