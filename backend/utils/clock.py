from collections.abc import Callable
from datetime import datetime

from flask import Flask

CLOCK_EXTENSION_KEY = "fitnerd.clock"


def utc_now() -> datetime:
    """Instante actual en UTC, sin zona (naive), como los servicios actuales."""
    raise NotImplementedError("not implemented")


class AdjustableClock:
    """Reloj de la configuración de pruebas: sin instante fijado delega en `real_clock`."""

    def __init__(self, real_clock: Callable[[], datetime] = utc_now) -> None:
        self.real_clock = real_clock
        self.instant = None

    def __call__(self) -> datetime:
        raise NotImplementedError("not implemented")

    def set(self, _instant: datetime) -> None:
        raise NotImplementedError("not implemented")

    def reset(self) -> None:
        raise NotImplementedError("not implemented")


def install_clock(_app: Flask) -> None:
    raise NotImplementedError("not implemented")


def get_app_clock(_app: Flask) -> Callable[[], datetime]:
    raise NotImplementedError("not implemented")


def current_clock() -> Callable[[], datetime]:
    raise NotImplementedError("not implemented")
