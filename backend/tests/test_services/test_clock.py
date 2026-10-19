"""Tests UNITARIOS del reloj de la app (spec 020, ADR-0028): `AdjustableClock`
delega en el reloj real mientras no se fije un instante, el instante fijado no
avanza solo y `install_clock` decide únicamente por `TESTING`. El reloj real se
sustituye por un `FakeClock` escrito a mano e inyectado por constructor.
"""

from datetime import datetime, timedelta, timezone

from flask import Flask

from utils.clock import (
    CLOCK_EXTENSION_KEY,
    AdjustableClock,
    get_app_clock,
    install_clock,
    utc_now,
)

REAL_INSTANT = datetime(2030, 1, 1, 8, 30, 0)
FIXED_INSTANT = datetime(2026, 10, 12, 12, 0, 0)


class FakeClock:
    """Reloj real de mentira: cada llamada devuelve un instante 1 s posterior."""

    def __init__(self, start=REAL_INSTANT):
        self.current = start
        self.calls = 0

    def __call__(self):
        self.calls += 1
        value = self.current
        self.current = self.current + timedelta(seconds=1)
        return value


# SDD: 020 REQ-005 AC-005.6
def test_clock_without_a_fixed_instant_delegates_to_the_real_clock():
    """Sin instante fijado, cada llamada pide la hora al reloj real inyectado."""
    real = FakeClock()
    clock = AdjustableClock(real)

    first = clock()
    second = clock()

    assert first == REAL_INSTANT
    assert second == REAL_INSTANT + timedelta(seconds=1)
    assert real.calls == 2


# SDD: 020 REQ-005 AC-005.6
def test_default_real_clock_is_utc_now_as_a_naive_datetime():
    """Por defecto el reloj real es `utc_now`: un datetime sin zona, en UTC."""
    before = datetime.now(timezone.utc).replace(tzinfo=None)

    value = AdjustableClock()()

    after = datetime.now(timezone.utc).replace(tzinfo=None)
    assert value.tzinfo is None
    assert before <= value <= after


# SDD: 020 REQ-005 AC-005.6
def test_utc_now_returns_the_current_utc_instant_without_a_zone():
    before = datetime.now(timezone.utc).replace(tzinfo=None)

    value = utc_now()

    after = datetime.now(timezone.utc).replace(tzinfo=None)
    assert value.tzinfo is None
    assert before <= value <= after


# SDD: 020 REQ-005 AC-005.9
def test_fixed_naive_instant_is_returned_as_is_and_never_advances():
    """Un instante naive se toma como UTC y no avanza entre llamadas."""
    real = FakeClock()
    clock = AdjustableClock(real)

    clock.set(FIXED_INSTANT)

    assert clock() == FIXED_INSTANT
    assert clock() == FIXED_INSTANT
    assert clock() == FIXED_INSTANT
    assert real.calls == 0


# SDD: 020 REQ-005 AC-005.9
def test_fixed_aware_instant_is_converted_to_utc_without_a_zone():
    """Un instante con zona se pasa a UTC y se le quita la zona."""
    clock = AdjustableClock(FakeClock())
    plus_two = timezone(timedelta(hours=2))

    clock.set(datetime(2026, 10, 12, 14, 0, 0, tzinfo=plus_two))

    value = clock()
    assert value == FIXED_INSTANT
    assert value.tzinfo is None


# SDD: 020 REQ-005 AC-005.9
def test_fixing_a_new_instant_replaces_the_previous_one():
    clock = AdjustableClock(FakeClock())
    clock.set(FIXED_INSTANT)

    clock.set(datetime(2026, 10, 13, 0, 0, 0))

    assert clock() == datetime(2026, 10, 13, 0, 0, 0)


# SDD: 020 REQ-005 AC-005.6
def test_reset_goes_back_to_the_real_clock():
    """Tras `reset`, el reloj vuelve a delegar en el reloj real."""
    real = FakeClock()
    clock = AdjustableClock(real)
    clock.set(FIXED_INSTANT)
    assert clock() == FIXED_INSTANT

    clock.reset()

    assert clock() == REAL_INSTANT
    assert real.calls == 1


# SDD: 020 NFR-001 AC-N001.1
def test_install_clock_in_testing_installs_an_adjustable_clock():
    """Con TESTING activo, la app lleva un reloj que se puede fijar."""
    flask_app = Flask(__name__)
    flask_app.config["TESTING"] = True

    install_clock(flask_app)

    clock = get_app_clock(flask_app)
    assert isinstance(clock, AdjustableClock)
    assert flask_app.extensions[CLOCK_EXTENSION_KEY] is clock
    clock.set(FIXED_INSTANT)
    assert clock() == FIXED_INSTANT


# SDD: 020 NFR-001 AC-N001.1
def test_install_clock_without_testing_installs_the_real_clock_only():
    """Sin TESTING (desarrollo y producción) el reloj es `utc_now`, sin `set`."""
    flask_app = Flask(__name__)
    flask_app.config["TESTING"] = False

    install_clock(flask_app)

    clock = get_app_clock(flask_app)
    assert clock is utc_now
    assert not hasattr(clock, "set")
    assert not isinstance(clock, AdjustableClock)


# SDD: 020 NFR-001 AC-N001.1
def test_install_clock_without_the_testing_key_installs_the_real_clock():
    """Si la app ni siquiera define TESTING, también se usa el reloj real."""
    flask_app = Flask(__name__)
    flask_app.config.pop("TESTING", None)

    install_clock(flask_app)

    assert get_app_clock(flask_app) is utc_now
