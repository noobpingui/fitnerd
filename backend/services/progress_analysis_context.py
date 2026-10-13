"""Validación del cuerpo y armado del mensaje del análisis de progreso (spec 010)."""

from datetime import date
from typing import Any

INVALID_ANALYSIS_REQUEST_MESSAGE = "Los datos del análisis no son válidos."


def parse_analysis_request(_data: Any, _server_today: date) -> Any:
    raise NotImplementedError


def build_user_message(
    _profile: Any,
    _age: int | None,
    _request: Any,
    _history: Any,
    _suggestion: Any,
    _months: int,
) -> str:
    raise NotImplementedError
