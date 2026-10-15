"""Comprobaciones numéricas compartidas por los servicios de validación."""

import math


def is_number(value) -> bool:
    """Devuelve True para un int o float finito que cabe en un float; nunca para bool."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        # Un entero enorme (por ejemplo, de 400 dígitos) no cabe en un float.
        return False


def is_int(value) -> bool:
    """Devuelve True para un int que no sea bool."""
    return isinstance(value, int) and not isinstance(value, bool)
