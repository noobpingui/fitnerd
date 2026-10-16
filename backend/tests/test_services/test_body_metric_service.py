"""Test UNITARIO de verdad: no toca Postgres para nada, no usa la fixture
`db_session`. BodyMetricService recibe sus repositorios, su unit_of_work y su
reloj por PARAMETRO en el constructor (inyeccion de dependencias) en vez de
crearlos el mismo - eso es lo que permite pasarle versiones "falsas" (en
memoria, ver tests/fakes.py). El reloj es un FakeClock fijo en 2026-10-12
(fecha UTC del servidor en los AC), asi que las reglas de fecha son
deterministas. Los mensajes de error se comparan con el texto literal de la
spec (seccion 6), no con constantes del servicio.
"""

from datetime import date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from models.body_metric import BodyMetric
from models.user_profile import UserProfile
from services.body_metric_service import BodyMetricService
from tests.fakes import (
    FakeBodyMetricRepository,
    FakeClock,
    FakeLockingUserRepository,
    FakeUnitOfWork,
    FakeUserProfileRepository,
)

NOW = datetime(2026, 10, 12, 12, 0)
USER = "user-1"
OTHER = "user-2"

NO_VALUES = "Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)"
WEIGHT_INVALID = "El peso debe estar entre 29,9 y 300 kg"
FAT_INVALID = "El porcentaje de grasa corporal debe estar entre 3 y 60"
MUSCLE_INVALID = "El porcentaje de masa muscular debe estar entre 10 y 70"
DATE_INVALID = "La fecha de la medición no es válida"
DATE_FUTURE = "La fecha de la medición no puede ser futura"
BODY_INVALID = "Los datos de la medición no son válidos"
NOT_FOUND = "Registro no encontrado"


def make_metric(
    user_id=USER,
    recorded_at=date(2026, 10, 12),
    weight=None,
    fat=None,
    muscle=None,
    notes=None,
):
    return BodyMetric(
        id=uuid4(),
        user_id=user_id,
        weight=weight,
        body_fat_percentage=fat,
        muscle_mass_percentage=muscle,
        notes=notes,
        recorded_at=recorded_at,
        created_at=NOW,
    )


def make_profile(user_id=USER, weight=80.0, weight_unit="kg"):
    return UserProfile(
        user_id=user_id,
        gender="male",
        height_unit="cm",
        height_cm=175.5,
        height_ft=None,
        height_in=None,
        weight_unit=weight_unit,
        weight=weight,
        activity_level="moderate",
        goal="maintain",
    )


def make_env(metrics=None, profiles=None):
    metric_repository = FakeBodyMetricRepository(metrics)
    user_repository = FakeLockingUserRepository()
    profile_repository = FakeUserProfileRepository(profiles)
    unit_of_work = FakeUnitOfWork()
    service = BodyMetricService(
        metric_repository,
        user_repository,
        profile_repository,
        unit_of_work,
        FakeClock(NOW),
    )
    return SimpleNamespace(
        service=service,
        metrics=metric_repository,
        users=user_repository,
        profiles=profile_repository,
        uow=unit_of_work,
    )


def assert_save_rejected(data, message, metrics=None):
    env = make_env(metrics)
    before = [
        (m.id, m.weight, m.body_fat_percentage, m.muscle_mass_percentage)
        for m in env.metrics.metrics
    ]
    with pytest.raises(ValidationError) as excinfo:
        env.service.save_metric(USER, data)
    assert excinfo.value.message == message
    assert env.metrics.created == []
    assert env.uow.committed is False
    after = [
        (m.id, m.weight, m.body_fat_percentage, m.muscle_mass_percentage)
        for m in env.metrics.metrics
    ]
    assert after == before


# --------------------------------------------------------------------------
# Tests existentes, adaptados al constructor y a save_metric (Art. 5.3)
# --------------------------------------------------------------------------


# SDD: REQ-002 AC-002.1
def test_rejects_a_metric_with_no_fields_at_all():
    """Ni peso, ni % de grasa, ni % de masa muscular: se rechaza antes de guardar."""
    assert_save_rejected(
        {"weight": None, "body_fat_percentage": None, "muscle_mass_percentage": None},
        NO_VALUES,
    )


# SDD: REQ-002 AC-002.2
def test_rejects_a_non_positive_weight():
    """Un peso de 0 sigue rechazandose (ahora por el rango de 29,9 a 300 kg)."""
    assert_save_rejected({"weight": 0}, WEIGHT_INVALID)


# SDD: REQ-002 AC-002.3
def test_rejects_a_body_fat_percentage_over_100():
    """Una grasa de 150 sigue rechazandose (ahora por el rango de 3 a 60)."""
    assert_save_rejected({"body_fat_percentage": 150}, FAT_INVALID)


# SDD: REQ-001 AC-001.1
def test_accepts_a_valid_weight_only_metric():
    """Un registro solo con peso se crea, queda en el repositorio y hace commit."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 70.5})

    assert result.metric.weight == 70.5
    assert result.metric in env.metrics.created
    assert env.uow.committed is True


# --------------------------------------------------------------------------
# REQ-001: una sola medicion por dia
# --------------------------------------------------------------------------


# SDD: REQ-001 AC-001.1
def test_save_creates_a_metric_when_the_day_has_none():
    """Sin medicion ese dia, se crea (created=True) con peso 80 el 2026-10-12."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-12"})

    assert result.created is True
    assert result.metric.weight == 80
    assert result.metric.recorded_at == date(2026, 10, 12)
    listed = env.metrics.list_by_user(USER)
    assert len(listed) == 1
    assert listed[0].recorded_at == date(2026, 10, 12)
    assert listed[0].weight == 80


# SDD: REQ-001 AC-001.2
def test_save_updates_the_existing_metric_of_the_same_day():
    """Mismo dia: se actualiza la misma medicion (mismo id), conserva la grasa."""
    existing = make_metric(weight=80, fat=20)
    env = make_env([existing])

    result = env.service.save_metric(USER, {"weight": 79.5, "recorded_at": "2026-10-12"})

    assert result.created is False
    assert result.metric.id == existing.id
    assert result.metric.weight == 79.5
    assert result.metric.body_fat_percentage == 20
    assert len(env.metrics.list_by_user(USER)) == 1
    assert env.metrics.created == []
    assert env.uow.committed is True


# SDD: REQ-001 AC-001.3
def test_save_merges_only_the_sent_values_into_the_existing_metric():
    """Enviar grasa y musculo no borra el peso ya registrado ese dia."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    env.service.save_metric(
        USER,
        {"body_fat_percentage": 18, "muscle_mass_percentage": 40, "recorded_at": "2026-10-12"},
    )

    assert existing.weight == 80
    assert existing.body_fat_percentage == 18
    assert existing.muscle_mass_percentage == 40


# SDD: REQ-001 AC-001.3
def test_save_keeps_stored_values_when_the_sent_ones_are_null():
    """Un campo enviado como null se conserva, no se borra."""
    existing = make_metric(weight=80, fat=20)
    env = make_env([existing])

    env.service.save_metric(
        USER, {"weight": 79, "body_fat_percentage": None, "recorded_at": "2026-10-12"}
    )

    assert existing.weight == 79
    assert existing.body_fat_percentage == 20


# SDD: REQ-001 AC-001.4
def test_save_on_another_day_creates_a_second_metric():
    """Con una medicion del 11, registrar la del 12 crea una nueva."""
    env = make_env([make_metric(recorded_at=date(2026, 10, 11), weight=80)])

    result = env.service.save_metric(USER, {"weight": 79, "recorded_at": "2026-10-12"})

    assert result.created is True
    dates = sorted(m.recorded_at for m in env.metrics.list_by_user(USER))
    assert dates == [date(2026, 10, 11), date(2026, 10, 12)]


# SDD: REQ-001 AC-001.5
def test_save_does_not_touch_the_metric_of_another_user():
    """La medicion del mismo dia de otro usuario ni se combina ni cambia."""
    others = make_metric(user_id=OTHER, weight=70)
    env = make_env([others])

    result = env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-12"})

    assert result.created is True
    assert result.metric.user_id == USER
    assert result.metric.id != others.id
    assert others.weight == 70


# SDD: REQ-001 AC-001.6
def test_save_without_recorded_at_uses_the_clock_date():
    """Sin recorded_at, la fecha es la del reloj del servidor (UTC)."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80})

    assert result.metric.recorded_at == date(2026, 10, 12)


# SDD: REQ-001 AC-001.6
def test_save_without_recorded_at_applies_the_one_per_day_rule():
    """Sin recorded_at tambien se combina con la medicion de hoy."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    result = env.service.save_metric(USER, {"weight": 79})

    assert result.created is False
    assert result.metric.id == existing.id


# SDD: REQ-001 AC-001.7
def test_no_two_metrics_share_a_date_after_any_sequence():
    """Registros, correcciones y borrados nunca dejan fechas repetidas."""
    env = make_env()
    service = env.service

    service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-10"})
    service.save_metric(USER, {"weight": 79, "recorded_at": "2026-10-10"})
    second = service.save_metric(USER, {"weight": 78, "recorded_at": "2026-10-11"}).metric
    service.update_metric(USER, second.id, {"weight": 77})
    service.save_metric(USER, {"body_fat_percentage": 20, "recorded_at": "2026-10-11"})
    service.delete_metric(USER, second.id)
    service.save_metric(USER, {"weight": 76, "recorded_at": "2026-10-11"})
    service.save_metric(USER, {"weight": 75})
    service.save_metric(USER, {"weight": 74})

    dates = [m.recorded_at for m in env.metrics.list_by_user(USER)]
    assert len(dates) == len(set(dates))
    assert len(dates) == 3


# SDD: REQ-001 AC-001.7
def test_writes_lock_the_user_row_and_commit_once():
    """Cada escritura bloquea la fila del usuario (serializa) y confirma."""
    env = make_env([make_metric(weight=80)])

    env.service.save_metric(USER, {"weight": 79})

    assert env.users.for_update_calls == [USER]
    assert env.uow.committed is True


# --------------------------------------------------------------------------
# REQ-002: validacion
# --------------------------------------------------------------------------


# SDD: REQ-002 AC-002.1
@pytest.mark.parametrize(
    "data",
    [
        {},
        {"notes": "solo notas"},
        {"weight": None, "body_fat_percentage": None, "muscle_mass_percentage": None},
    ],
)
def test_save_without_any_value_is_rejected(data):
    """Sin peso, grasa ni musculo (ausentes o null): mensaje literal."""
    assert_save_rejected(data, NO_VALUES)


# SDD: REQ-002 AC-002.2
@pytest.mark.parametrize("weight", ["80", True, float("nan"), float("inf"), [80], 29.8, 300.1, -5])
def test_save_rejects_an_invalid_weight(weight):
    """Peso no numerico (incluido texto, bool y NaN) o fuera de 29,9 a 300."""
    assert_save_rejected({"weight": weight}, WEIGHT_INVALID)


# SDD: REQ-002 AC-002.3
@pytest.mark.parametrize("fat", ["20", True, float("nan"), 2.9, 60.1, 0])
def test_save_rejects_an_invalid_body_fat(fat):
    """Grasa no numerica o fuera de 3 a 60."""
    assert_save_rejected({"body_fat_percentage": fat}, FAT_INVALID)


# SDD: REQ-002 AC-002.4
@pytest.mark.parametrize("muscle", ["40", True, float("nan"), 9.9, 70.1, 100])
def test_save_rejects_an_invalid_muscle_mass(muscle):
    """Masa muscular no numerica o fuera de 10 a 70."""
    assert_save_rejected({"muscle_mass_percentage": muscle}, MUSCLE_INVALID)


# SDD: REQ-002 AC-002.8
@pytest.mark.parametrize(
    "data",
    [
        {"weight": 29.9},
        {"weight": 300},
        {"body_fat_percentage": 3},
        {"body_fat_percentage": 60},
        {"muscle_mass_percentage": 10},
        {"muscle_mass_percentage": 70},
    ],
)
def test_save_accepts_the_exact_limits(data):
    """Los valores limite se aceptan."""
    env = make_env()

    result = env.service.save_metric(USER, data)

    assert result.created is True
    assert env.uow.committed is True


# SDD: REQ-002 AC-002.5
@pytest.mark.parametrize(
    "recorded_at",
    ["2026-02-30", "20261012", "2026/10/12", "12-10-2026", "hoy", 123, 20261012.0, ["2026-10-12"]],
)
def test_save_rejects_an_invalid_date(recorded_at):
    """Fecha que no es texto AAAA-MM-DD de una fecha real."""
    assert_save_rejected({"weight": 80, "recorded_at": recorded_at}, DATE_INVALID)


# SDD: REQ-002 AC-002.6
def test_save_accepts_a_date_one_day_ahead_of_the_server():
    """Con el servidor en el 2026-10-12, el 13 se acepta (zonas adelantadas)."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-13"})

    assert result.metric.recorded_at == date(2026, 10, 13)


# SDD: REQ-002 AC-002.6
def test_save_rejects_a_date_two_days_ahead_of_the_server():
    """El 14 se rechaza como futura."""
    assert_save_rejected({"weight": 80, "recorded_at": "2026-10-14"}, DATE_FUTURE)


# SDD: REQ-002 AC-002.7
@pytest.mark.parametrize("data", [None, [], [{"weight": 80}], "weight=80", 80])
def test_save_rejects_a_body_that_is_not_an_object(data):
    """Sin cuerpo o con un cuerpo que no es un objeto."""
    assert_save_rejected(data, BODY_INVALID)


# SDD: REQ-002 AC-002.7
@pytest.mark.parametrize("data", [None, [], "x"])
def test_update_rejects_a_body_that_is_not_an_object(data):
    """La correccion tambien rechaza un cuerpo que no es un objeto."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    with pytest.raises(ValidationError) as excinfo:
        env.service.update_metric(USER, existing.id, data)

    assert excinfo.value.message == BODY_INVALID
    assert existing.weight == 80
    assert env.uow.committed is False


# SDD: REQ-002 AC-002.9
def test_a_rejected_weight_leaves_the_existing_metric_unchanged():
    """Un peso de 400 sobre la medicion de hoy no la modifica (sigue en 80)."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    with pytest.raises(ValidationError):
        env.service.save_metric(USER, {"weight": 400, "recorded_at": "2026-10-12"})

    assert existing.weight == 80
    assert env.uow.committed is False


# SDD: REQ-002 AC-002.9
def test_a_rejected_save_does_not_touch_the_profile():
    """Un 400 no modifica el perfil."""
    profile = make_profile(weight=80)
    env = make_env([make_metric(weight=80)], {USER: profile})

    with pytest.raises(ValidationError):
        env.service.save_metric(USER, {"weight": 400})

    assert profile.weight == 80
    assert env.users.for_update_calls == []


# --------------------------------------------------------------------------
# REQ-003: corregir
# --------------------------------------------------------------------------


# SDD: REQ-003 AC-003.1
def test_update_replaces_the_three_values():
    """Los tres valores se sustituyen; el campo ausente queda en None."""
    existing = make_metric(recorded_at=date(2026, 10, 5), weight=80, fat=20, muscle=40)
    env = make_env([existing])

    metric = env.service.update_metric(USER, existing.id, {"weight": 79, "body_fat_percentage": 19})

    assert metric.id == existing.id
    assert metric.weight == 79
    assert metric.body_fat_percentage == 19
    assert metric.muscle_mass_percentage is None
    assert metric.recorded_at == date(2026, 10, 5)
    assert env.uow.committed is True


# SDD: REQ-003 AC-003.1
def test_update_sets_to_none_a_value_sent_as_null():
    """Un valor enviado como null queda sin valor."""
    existing = make_metric(weight=80, fat=20)
    env = make_env([existing])

    metric = env.service.update_metric(
        USER, existing.id, {"weight": 80, "body_fat_percentage": None}
    )

    assert metric.body_fat_percentage is None


# SDD: REQ-003 AC-003.2
def test_update_keeps_the_notes():
    """Las notas se conservan al corregir (y se ignoran las enviadas)."""
    existing = make_metric(weight=80, notes="tras vacaciones")
    env = make_env([existing])

    metric = env.service.update_metric(USER, existing.id, {"weight": 79, "notes": "otra"})

    assert metric.notes == "tras vacaciones"


# SDD: REQ-003 AC-003.3
def test_update_ignores_recorded_at_and_id():
    """La fecha de la medicion no cambia aunque se envie otra; tampoco el id."""
    existing = make_metric(recorded_at=date(2026, 10, 5), weight=80)
    original_id = existing.id
    env = make_env([existing])

    metric = env.service.update_metric(
        USER, existing.id, {"weight": 79, "recorded_at": "2026-10-01", "id": "otro"}
    )

    assert metric.recorded_at == date(2026, 10, 5)
    assert metric.id == original_id


# SDD: REQ-003 AC-003.4
@pytest.mark.parametrize(
    "data",
    [
        {},
        {"weight": None, "body_fat_percentage": None, "muscle_mass_percentage": None},
        {"recorded_at": "2026-10-05"},
    ],
)
def test_update_without_any_value_is_rejected(data):
    """Sin ningun valor: 400 y la medicion no cambia."""
    existing = make_metric(weight=80, fat=20)
    env = make_env([existing])

    with pytest.raises(ValidationError) as excinfo:
        env.service.update_metric(USER, existing.id, data)

    assert excinfo.value.message == NO_VALUES
    assert existing.weight == 80
    assert existing.body_fat_percentage == 20
    assert env.uow.committed is False


# SDD: REQ-003 AC-003.4
def test_update_validates_the_ranges():
    """La correccion usa los mismos rangos que el registro."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    with pytest.raises(ValidationError) as excinfo:
        env.service.update_metric(USER, existing.id, {"weight": 301})

    assert excinfo.value.message == WEIGHT_INVALID
    assert existing.weight == 80


# SDD: REQ-003 AC-003.5
def test_update_of_an_unknown_id_is_not_found():
    """Un id inexistente da 404 y no cambia nada."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    with pytest.raises(ResourceNotFoundError) as excinfo:
        env.service.update_metric(USER, uuid4(), {"weight": 79})

    assert excinfo.value.message == NOT_FOUND
    assert existing.weight == 80
    assert env.uow.committed is False


# SDD: REQ-003 AC-003.5
def test_update_of_a_metric_of_another_user_is_not_found():
    """Una medicion de otro usuario da 404 y no cambia."""
    others = make_metric(user_id=OTHER, weight=70)
    env = make_env([others])

    with pytest.raises(ResourceNotFoundError) as excinfo:
        env.service.update_metric(USER, others.id, {"weight": 79})

    assert excinfo.value.message == NOT_FOUND
    assert others.weight == 70


# --------------------------------------------------------------------------
# REQ-004: borrar
# --------------------------------------------------------------------------


# SDD: REQ-004 AC-004.1
def test_delete_removes_the_metric():
    """Borrar una medicion propia: sale del historial y hace commit."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    env.service.delete_metric(USER, existing.id)

    assert env.metrics.list_by_user(USER) == []
    assert existing in env.metrics.deleted
    assert env.uow.committed is True


# SDD: REQ-004 AC-004.2
def test_delete_of_an_unknown_id_is_not_found():
    """Un id inexistente da 404 y no se borra nada."""
    existing = make_metric(weight=80)
    env = make_env([existing])

    with pytest.raises(ResourceNotFoundError) as excinfo:
        env.service.delete_metric(USER, uuid4())

    assert excinfo.value.message == NOT_FOUND
    assert env.metrics.deleted == []
    assert env.uow.committed is False


# SDD: REQ-004 AC-004.2
def test_delete_of_a_metric_of_another_user_is_not_found():
    """Una medicion ajena da 404 y no se borra."""
    others = make_metric(user_id=OTHER, weight=70)
    env = make_env([others])

    with pytest.raises(ResourceNotFoundError) as excinfo:
        env.service.delete_metric(USER, others.id)

    assert excinfo.value.message == NOT_FOUND
    assert others in env.metrics.metrics


# --------------------------------------------------------------------------
# REQ-005: el peso del perfil sigue a la ultima medicion de peso
# --------------------------------------------------------------------------


# SDD: REQ-005 AC-005.1
def test_update_of_the_latest_metric_moves_the_profile_weight():
    """Corregir la ultima medicion a 78,4 deja el perfil (kg) en 78,4."""
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=80)
    profile = make_profile(weight=80, weight_unit="kg")
    env = make_env([latest], {USER: profile})

    env.service.update_metric(USER, latest.id, {"weight": 78.4})

    assert profile.weight == 78.4
    assert profile.weight_unit == "kg"


# SDD: REQ-005 AC-005.2
def test_delete_converts_the_previous_weight_to_pounds():
    """Perfil en lb: borrar la ultima deja 176,4 lb (80 kg)."""
    older = make_metric(recorded_at=date(2026, 10, 5), weight=80)
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78.5)
    profile = make_profile(weight=173.1, weight_unit="lb")
    env = make_env([older, latest], {USER: profile})

    env.service.delete_metric(USER, latest.id)

    assert profile.weight == 176.4
    assert profile.weight_unit == "lb"


# SDD: REQ-005 AC-005.3
def test_delete_of_the_latest_metric_restores_the_previous_weight_in_kg():
    """Perfil en kg con 78,5: borrar la del 11 lo deja en 80."""
    older = make_metric(recorded_at=date(2026, 10, 5), weight=80)
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78.5)
    profile = make_profile(weight=78.5)
    env = make_env([older, latest], {USER: profile})

    env.service.delete_metric(USER, latest.id)

    assert profile.weight == 80


# SDD: REQ-005 AC-005.4
def test_update_of_an_older_metric_keeps_the_profile_weight():
    """Corregir la del 5 a 81 no cambia el perfil: la ultima sigue siendo 78,5."""
    older = make_metric(recorded_at=date(2026, 10, 5), weight=80)
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78.5)
    profile = make_profile(weight=78.5)
    env = make_env([older, latest], {USER: profile})

    env.service.update_metric(USER, older.id, {"weight": 81})

    assert profile.weight == 78.5


# SDD: REQ-005 AC-005.5
def test_a_difference_of_at_most_005_kg_leaves_the_profile_untouched():
    """173 lb (78,47 kg) frente a 78,5 kg: sigue en 173 al registrar otra fecha."""
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78.5)
    profile = make_profile(weight=173, weight_unit="lb")
    env = make_env([latest], {USER: profile})

    env.service.save_metric(USER, {"weight": 90, "recorded_at": "2026-10-01"})

    assert profile.weight == 173


# SDD: REQ-005 AC-005.6
def test_deleting_the_only_weight_metric_keeps_the_profile_weight():
    """Sin mediciones de peso restantes, el perfil no cambia (80)."""
    only = make_metric(weight=80)
    profile = make_profile(weight=80)
    env = make_env([only], {USER: profile})

    env.service.delete_metric(USER, only.id)

    assert profile.weight == 80


# SDD: REQ-005 AC-005.7
def test_latest_metric_without_weight_falls_back_to_the_previous_weight():
    """Dejar solo la grasa en la ultima hace que el perfil pase a 80."""
    older = make_metric(recorded_at=date(2026, 10, 5), weight=80)
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78, fat=20)
    profile = make_profile(weight=78)
    env = make_env([older, latest], {USER: profile})

    env.service.update_metric(USER, latest.id, {"body_fat_percentage": 20})

    assert profile.weight == 80


# SDD: REQ-005 AC-005.8
def test_profile_weight_is_clamped_to_the_profile_range():
    """Perfil en kg con 31 y medicion de 29,9: el perfil queda en 30."""
    profile = make_profile(weight=31)
    env = make_env([], {USER: profile})

    env.service.save_metric(USER, {"weight": 29.9, "recorded_at": "2026-10-12"})

    assert profile.weight == 30


# SDD: REQ-005 AC-005.9
def test_save_without_a_profile_only_stores_the_metric():
    """Sin perfil (onboarding pendiente) no se crea ninguno."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80})

    assert result.created is True
    assert env.profiles.profiles == {}
    assert env.uow.committed is True


# SDD: REQ-005 AC-005.10
def test_sync_changes_only_the_profile_weight():
    """El resto de campos del perfil queda igual."""
    profile = make_profile(weight=80)
    env = make_env([], {USER: profile})
    fields = (
        "gender", "height_unit", "height_cm", "height_ft", "height_in",
        "weight_unit", "activity_level", "goal",
    )
    before = {name: getattr(profile, name) for name in fields}

    env.service.save_metric(USER, {"weight": 75})

    assert profile.weight == 75
    assert {name: getattr(profile, name) for name in fields} == before


# SDD: REQ-005 AC-005.1
def test_sync_only_reads_the_profile_of_the_token_user():
    """El perfil de otro usuario no se toca al registrar una medicion propia."""
    others = make_profile(user_id=OTHER, weight=60)
    env = make_env([], {USER: make_profile(weight=80), OTHER: others})

    env.service.save_metric(USER, {"weight": 75})

    assert others.weight == 60


# --------------------------------------------------------------------------
# NFR-001: aislamiento entre usuarios
# --------------------------------------------------------------------------


# SDD: NFR-001 AC-N001.2
def test_user_cannot_update_or_delete_a_metric_of_another_user():
    """Con el user_id de A y el id de B: 404 y B (medicion y perfil) intactos."""
    others = make_metric(user_id=OTHER, weight=70)
    other_profile = make_profile(user_id=OTHER, weight=70)
    env = make_env([others], {OTHER: other_profile})

    with pytest.raises(ResourceNotFoundError):
        env.service.update_metric(USER, others.id, {"weight": 60})
    with pytest.raises(ResourceNotFoundError):
        env.service.delete_metric(USER, others.id)

    assert others.weight == 70
    assert others in env.metrics.metrics
    assert other_profile.weight == 70


# SDD: NFR-001 AC-N001.3
def test_user_id_in_the_body_is_ignored():
    """Un user_id de B en el cuerpo no cambia a quien pertenece la medicion."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80, "user_id": OTHER})

    assert result.metric.user_id == USER
    assert env.metrics.list_by_user(OTHER) == []


# --------------------------------------------------------------------------
# Enteros enormes (spec 013, REQ-002)
# --------------------------------------------------------------------------

HUGE = 10**400


# SDD: 013 REQ-002 AC-002.1
def test_save_rejects_a_huge_integer_weight_with_the_range_message():
    """Un peso de 10^400 da el mensaje de rango y no crea ninguna medición."""
    assert_save_rejected({"weight": HUGE}, WEIGHT_INVALID)


# SDD: 013 REQ-002 AC-002.2
def test_save_rejects_a_huge_integer_body_fat_with_the_range_message():
    """Una grasa de 10^400 da el mensaje de rango y no crea ninguna medición."""
    assert_save_rejected({"body_fat_percentage": HUGE}, FAT_INVALID)


# SDD: 013 REQ-002 AC-002.3
def test_save_rejects_a_huge_negative_integer_muscle_with_the_range_message():
    """Una masa muscular de -10^400 da el mensaje de rango y no crea nada."""
    assert_save_rejected({"muscle_mass_percentage": -HUGE}, MUSCLE_INVALID)


# SDD: 013 REQ-002 AC-002.4
def test_update_rejects_a_huge_integer_weight_and_keeps_metric_and_profile():
    """Corregir con 10^400: 400, la medición sigue en 80 kg, el perfil intacto y sin commit."""
    existing = make_metric(weight=80)
    profile = make_profile(weight=80)
    env = make_env([existing], {USER: profile})

    with pytest.raises(ValidationError) as excinfo:
        env.service.update_metric(USER, existing.id, {"weight": HUGE})

    assert excinfo.value.message == WEIGHT_INVALID
    assert existing.weight == 80
    assert profile.weight == 80
    assert env.uow.committed is False


# --------------------------------------------------------------------------
# Spec 016: mediciones con fecha pasada (el servidor está en 2026-10-12)
# --------------------------------------------------------------------------

DATE_TOO_OLD = "La fecha de la medición no puede tener más de un año de antigüedad"


# SDD: 016 REQ-005 AC-005.1
def test_save_accepts_a_date_366_days_before_the_server():
    """El 2025-10-11 (366 días antes del 2026-10-12) se acepta."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80, "recorded_at": "2025-10-11"})

    assert result.created is True
    assert result.metric.recorded_at == date(2025, 10, 11)
    assert env.uow.committed is True


# SDD: 016 REQ-005 AC-005.2
def test_save_rejects_a_date_367_days_before_the_server():
    """El 2025-10-10 (367 días antes) se rechaza sin crear ni confirmar nada."""
    assert_save_rejected({"weight": 80, "recorded_at": "2025-10-10"}, DATE_TOO_OLD)


# SDD: 016 REQ-005 AC-005.2
def test_a_too_old_date_leaves_metrics_and_profile_untouched():
    """Un registro rechazado por antigüedad no toca mediciones ni perfil ni bloquea al usuario."""
    existing = make_metric(recorded_at=date(2026, 10, 11), weight=78)
    profile = make_profile(weight=78)
    env = make_env([existing], {USER: profile})

    with pytest.raises(ValidationError) as excinfo:
        env.service.save_metric(USER, {"weight": 60, "recorded_at": "2025-10-10"})

    assert excinfo.value.message == DATE_TOO_OLD
    assert existing.weight == 78
    assert profile.weight == 78
    assert env.metrics.created == []
    assert env.uow.committed is False
    assert env.users.for_update_calls == []


# SDD: 016 REQ-005 AC-005.3
def test_a_future_date_still_gets_the_future_message():
    """El 2026-10-14 sigue dando el mensaje de fecha futura, no el de antigüedad."""
    assert_save_rejected({"weight": 80, "recorded_at": "2026-10-14"}, DATE_FUTURE)


# SDD: 016 REQ-003 AC-003.7
def test_save_creates_a_past_metric_when_that_day_has_none():
    """Sin medición el 2026-10-05, se crea (created=True) con esa fecha."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-05"})

    assert result.created is True
    assert result.metric.recorded_at == date(2026, 10, 5)
    assert result.metric.weight == 80


# SDD: 016 REQ-003 AC-003.8
def test_save_merges_into_the_existing_past_metric_of_that_day():
    """Con una medición del 2026-10-05 (80, grasa 20), enviar 79 conserva id y grasa."""
    existing = make_metric(recorded_at=date(2026, 10, 5), weight=80, fat=20)
    env = make_env([existing])

    result = env.service.save_metric(USER, {"weight": 79, "recorded_at": "2026-10-05"})

    assert result.created is False
    assert result.metric.id == existing.id
    assert result.metric.weight == 79
    assert result.metric.body_fat_percentage == 20
    assert len(env.metrics.list_by_user(USER)) == 1


# SDD: 016 REQ-006 AC-006.1
def test_a_past_weight_before_the_latest_one_keeps_the_profile_weight():
    """Perfil en 78 y medición del 11: registrar 80 el día 5 no lo cambia."""
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78)
    profile = make_profile(weight=78)
    env = make_env([latest], {USER: profile})

    env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-05"})

    assert profile.weight == 78


# SDD: 016 REQ-006 AC-006.2
def test_a_past_weight_that_becomes_the_latest_moves_the_profile_weight():
    """Con una única medición del día 1, la del día 5 (77) pasa a ser la última."""
    only = make_metric(recorded_at=date(2026, 10, 1), weight=78)
    profile = make_profile(weight=78)
    env = make_env([only], {USER: profile})

    env.service.save_metric(USER, {"weight": 77, "recorded_at": "2026-10-05"})

    assert profile.weight == 77


# SDD: 016 REQ-006 AC-006.3
def test_a_past_weight_keeps_a_profile_in_pounds_unchanged():
    """Perfil en lb (172) y medición del 11 de 78 kg: registrar 80 kg el día 5 lo deja igual."""
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78)
    profile = make_profile(weight=172, weight_unit="lb")
    env = make_env([latest], {USER: profile})

    env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-05"})

    assert profile.weight == 172
    assert profile.weight_unit == "lb"


# SDD: 016 REQ-006 AC-006.4
def test_a_past_metric_without_weight_keeps_the_profile_weight():
    """Registrar solo grasa en una fecha pasada deja el peso del perfil en 78."""
    latest = make_metric(recorded_at=date(2026, 10, 11), weight=78)
    profile = make_profile(weight=78)
    env = make_env([latest], {USER: profile})

    env.service.save_metric(USER, {"body_fat_percentage": 20, "recorded_at": "2026-10-05"})

    assert profile.weight == 78


# SDD: 016 REQ-006 AC-006.6
def test_a_past_metric_without_a_profile_does_not_create_one():
    """Sin perfil, la medición pasada se guarda y no se crea ningún perfil."""
    env = make_env()

    result = env.service.save_metric(USER, {"weight": 80, "recorded_at": "2026-10-05"})

    assert result.created is True
    assert env.profiles.profiles == {}
    assert env.uow.committed is True


# SDD: 016 REQ-009 AC-009.5
def test_a_metric_of_today_keeps_the_weight_of_a_later_dated_metric():
    """Con una medición del día 13 (80), registrar 79 el día 12 deja el perfil en 80."""
    later = make_metric(recorded_at=date(2026, 10, 13), weight=80)
    profile = make_profile(weight=80)
    env = make_env([later], {USER: profile})

    result = env.service.save_metric(USER, {"weight": 79, "recorded_at": "2026-10-12"})

    assert result.created is True
    assert profile.weight == 80
