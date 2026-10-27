"""Firma del token de restauración de un alimento quitado del diario (ADR-0035)."""

MAX_RESTORE_TOKEN_LENGTH = 4096


class RestoreTokenSigner:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def sign(self, _user_id, _payload: dict) -> str:
        raise NotImplementedError("not implemented")

    def verify(self, _user_id, _token: object) -> dict | None:
        raise NotImplementedError("not implemented")
