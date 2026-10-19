from collections.abc import Callable
from datetime import datetime, timezone

from flask import Flask, current_app

CLOCK_EXTENSION_KEY = "fitnerd.clock"


def utc_now() -> datetime:
    """Instante actual en UTC, sin zona (naive), como los servicios actuales."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AdjustableClock:
    """Reloj de la configuración de pruebas: sin instante fijado delega en `real_clock`."""

    def __init__(self, real_clock: Callable[[], datetime] = utc_now) -> None:
        self.real_clock = real_clock
        self.instant = None

    def __call__(self) -> datetime:
        if self.instant is not None:
            return self.instant
        return self.real_clock()

    def set(self, instant: datetime) -> None:
        if instant.tzinfo is not None:
            instant = instant.astimezone(timezone.utc).replace(tzinfo=None)
        self.instant = instant

    def reset(self) -> None:
        self.instant = None


def install_clock(app: Flask) -> None:
    """Solo con `TESTING` el reloj de la app se puede fijar; si no, es el real."""
    if app.config.get("TESTING"):
        app.extensions[CLOCK_EXTENSION_KEY] = AdjustableClock()
    else:
        app.extensions[CLOCK_EXTENSION_KEY] = utc_now


def get_app_clock(app: Flask) -> Callable[[], datetime]:
    return app.extensions[CLOCK_EXTENSION_KEY]


def current_clock() -> Callable[[], datetime]:
    return get_app_clock(current_app)
