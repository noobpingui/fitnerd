"""Unitarios de ProfileService: lectura del perfil, guardado (creacion y
reemplazo completo), regla de "el primer guardado completa el onboarding" y
validacion. Los repositorios son fakes en memoria y el reloj es un FakeClock
fijo en 2026-10-11, asi que los limites de edad son deterministas. Los
mensajes de error se comparan con el texto literal de la spec (seccion 6),
no con constantes del servicio.
"""

from datetime import date, datetime
from types import SimpleNamespace

import pytest

from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from services.profile_service import ProfileService
from tests.fakes import FakeClock, FakeUnitOfWork

TODAY = datetime(2026, 10, 11, 12, 0)
MISSING = object()

DOB_INVALID = "La fecha de nacimiento no es válida"
DOB_FUTURE = "La fecha de nacimiento no puede ser futura"
AGE_RANGE = "Debes tener entre 14 y 100 años"
BODY_INVALID = "Los datos del perfil no son válidos"
GENDER_INVALID = "El género debe ser masculino o femenino"
HEIGHT_UNIT_INVALID = "La unidad de altura debe ser cm o ft"
HEIGHT_CM_INVALID = "La altura debe estar entre 100 y 250 cm"
HEIGHT_FT_INVALID = "La altura debe estar entre 3 y 8 ft, y las pulgadas entre 0 y 11"
WEIGHT_UNIT_INVALID = "La unidad de peso debe ser kg o lb"
WEIGHT_KG_INVALID = "El peso debe estar entre 30 y 300 kg"
WEIGHT_LB_INVALID = "El peso debe estar entre 66 y 660 lb"
ACTIVITY_INVALID = "El nivel de actividad no es válido"
GOAL_INVALID = "La meta no es válida"


class FakeUserRepository:
    def __init__(self, users):
        self.users = {user.id: user for user in users}
        self.for_update_calls = []

    def get_by_id(self, user_id):
        return self.users.get(user_id)

    def get_by_id_for_update(self, user_id):
        self.for_update_calls.append(user_id)
        return self.users.get(user_id)


class FakeUserProfileRepository:
    def __init__(self):
        self.profiles = {}
        self.created = []

    def get_by_user_id(self, user_id):
        return self.profiles.get(user_id)

    def create(self, profile):
        self.created.append(profile)
        self.profiles[profile.user_id] = profile
        return profile


def make_user(user_id="user-1", date_of_birth=None, onboarding_completed_at=None):
    return SimpleNamespace(
        id=user_id,
        date_of_birth=date_of_birth,
        onboarding_completed_at=onboarding_completed_at,
    )


def make_service(users=None, clock=None):
    users = users if users is not None else [make_user()]
    user_repository = FakeUserRepository(users)
    profile_repository = FakeUserProfileRepository()
    unit_of_work = FakeUnitOfWork()
    clock = clock or FakeClock(TODAY)
    service = ProfileService(user_repository, profile_repository, unit_of_work, clock)
    return service, user_repository, profile_repository, unit_of_work, clock


def valid_data(**overrides):
    data = {
        "date_of_birth": "1996-03-01",
        "gender": "male",
        "height_unit": "cm",
        "height_cm": 175.5,
        "weight_unit": "kg",
        "weight": 72.5,
        "activity_level": "moderate",
        "goal": "maintain",
    }
    for key, value in overrides.items():
        if value is MISSING:
            data.pop(key, None)
        else:
            data[key] = value
    return data


def assert_rejected(data, message, users=None):
    service, user_repository, profile_repository, unit_of_work, _ = make_service(users)
    with pytest.raises(ValidationError) as excinfo:
        service.save_profile("user-1", data)
    assert excinfo.value.message == message
    assert user_repository.for_update_calls == []
    assert profile_repository.created == []
    assert unit_of_work.committed is False


# --------------------------------------------------------------------------
# Lectura
# --------------------------------------------------------------------------


# SDD: REQ-001 AC-001.2
def test_get_profile_without_profile_and_without_birth_date():
    """Un usuario sin perfil ni fecha de nacimiento: onboarding pendiente."""
    service, *_ = make_service()

    state = service.get_profile("user-1")

    assert state.profile is None
    assert state.user.onboarding_completed_at is None
    assert state.user.date_of_birth is None


# SDD: REQ-001 AC-001.3
def test_get_profile_of_a_pre_existing_user_is_pending():
    """Un usuario anterior a la feature (sin perfil) tiene el onboarding pendiente."""
    service, *_ = make_service([make_user(date_of_birth=date(1990, 1, 1))])

    state = service.get_profile("user-1")

    assert state.profile is None
    assert state.user.onboarding_completed_at is None


# SDD: REQ-001 AC-001.4
def test_get_profile_returns_the_account_birth_date_without_a_profile():
    """La fecha de nacimiento de la cuenta se devuelve aunque no haya perfil."""
    service, *_ = make_service([make_user(date_of_birth=date(1995, 5, 20))])

    state = service.get_profile("user-1")

    assert state.profile is None
    assert state.user.date_of_birth == date(1995, 5, 20)


# SDD: REQ-001 AC-001.2
def test_get_profile_of_an_unknown_user_raises_not_found():
    """Un id inexistente lanza ResourceNotFoundError."""
    service, *_ = make_service([])

    with pytest.raises(ResourceNotFoundError):
        service.get_profile("ghost")


# --------------------------------------------------------------------------
# Guardado
# --------------------------------------------------------------------------


# SDD: REQ-002 AC-002.1
def test_save_profile_creates_the_profile():
    """El primer guardado crea el perfil con los valores enviados y hace commit."""
    service, _, profile_repository, unit_of_work, _ = make_service()

    state = service.save_profile("user-1", valid_data())

    assert len(profile_repository.created) == 1
    assert state.profile.gender == "male"
    assert state.profile.height_unit == "cm"
    assert state.profile.height_cm == 175.5
    assert state.profile.weight_unit == "kg"
    assert state.profile.weight == 72.5
    assert state.profile.activity_level == "moderate"
    assert state.profile.goal == "maintain"
    assert state.user.date_of_birth == date(1996, 3, 1)
    assert unit_of_work.committed is True


# SDD: REQ-002 AC-002.2
def test_save_profile_replaces_the_previous_profile_completely():
    """El segundo guardado sobrescribe todas las columnas, sin crear otra fila."""
    service, _, profile_repository, _, _ = make_service()
    service.save_profile("user-1", valid_data())

    state = service.save_profile(
        "user-1",
        valid_data(
            gender="female",
            height_unit="ft",
            height_cm=MISSING,
            height_ft=5,
            height_in=9,
            weight_unit="lb",
            weight=160,
            activity_level="high",
            goal="lose_slow",
        ),
    )

    assert len(profile_repository.created) == 1
    assert state.profile.gender == "female"
    assert state.profile.height_unit == "ft"
    assert state.profile.height_cm is None
    assert state.profile.height_ft == 5
    assert state.profile.height_in == 9
    assert state.profile.weight_unit == "lb"
    assert state.profile.weight == 160
    assert state.profile.activity_level == "high"
    assert state.profile.goal == "lose_slow"


# SDD: REQ-002 AC-002.7
def test_save_profile_updates_the_account_birth_date():
    """Guardar con otra fecha cambia la fecha de nacimiento de la cuenta."""
    service, *_ = make_service([make_user(date_of_birth=date(1995, 5, 20))])

    state = service.save_profile("user-1", valid_data(date_of_birth="1996-03-01"))

    assert state.user.date_of_birth == date(1996, 3, 1)


# SDD: REQ-002 AC-002.8
def test_save_profile_sets_the_birth_date_of_an_account_without_one():
    """Una cuenta de Google sin fecha la recibe al guardar el perfil."""
    service, *_ = make_service([make_user(date_of_birth=None)])

    state = service.save_profile("user-1", valid_data(date_of_birth="2000-01-15"))

    assert state.user.date_of_birth == date(2000, 1, 15)


# SDD: REQ-002 AC-002.3
def test_save_profile_keeps_feet_inches_and_pounds_as_typed():
    """ft/in y lb se guardan tal cual, con height_cm en None."""
    service, *_ = make_service()

    state = service.save_profile(
        "user-1",
        valid_data(
            height_unit="ft",
            height_cm=MISSING,
            height_ft=5,
            height_in=9,
            weight_unit="lb",
            weight=160,
        ),
    )

    assert state.profile.height_unit == "ft"
    assert state.profile.height_ft == 5
    assert state.profile.height_in == 9
    assert state.profile.height_cm is None
    assert state.profile.weight_unit == "lb"
    assert state.profile.weight == 160


# SDD: REQ-002 AC-002.4
def test_save_profile_keeps_centimeters_with_one_decimal():
    """cm conserva 175.5 y deja ft/in en None."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(height_cm=175.5))

    assert state.profile.height_cm == 175.5
    assert state.profile.height_ft is None
    assert state.profile.height_in is None


# SDD: REQ-002 AC-002.5
def test_save_profile_rounds_weight_and_height_to_one_decimal():
    """72.46 pasa a 72.5 y 175.04 a 175.0."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(weight=72.46, height_cm=175.04))

    assert state.profile.weight == 72.5
    assert state.profile.height_cm == 175.0


# SDD: REQ-002 AC-002.6
def test_save_profile_ignores_feet_fields_when_unit_is_cm():
    """Con height_unit cm, height_ft y height_in se ignoran (aunque esten fuera de rango)."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(height_ft=99, height_in=99))

    assert state.profile.height_cm == 175.5
    assert state.profile.height_ft is None
    assert state.profile.height_in is None


# SDD: REQ-002 AC-002.6
def test_save_profile_ignores_cm_field_when_unit_is_ft():
    """Con height_unit ft, height_cm se ignora (aunque este fuera de rango)."""
    service, *_ = make_service()

    state = service.save_profile(
        "user-1", valid_data(height_unit="ft", height_cm=9999, height_ft=5, height_in=9)
    )

    assert state.profile.height_cm is None
    assert state.profile.height_ft == 5
    assert state.profile.height_in == 9


# SDD: REQ-002 AC-002.9
def test_save_profile_ignores_an_age_field():
    """Un campo age en el cuerpo no se guarda en el perfil ni en el usuario."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(age=28))

    assert not hasattr(state.profile, "age") or state.profile.age is None
    assert not hasattr(state.user, "age")


# --------------------------------------------------------------------------
# Onboarding y aislamiento
# --------------------------------------------------------------------------


# SDD: REQ-003 AC-003.1
def test_first_save_sets_onboarding_completed_at_from_the_clock():
    """El primer guardado fija onboarding_completed_at con la hora del reloj."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data())

    assert state.user.onboarding_completed_at == TODAY


# SDD: REQ-003 AC-003.2
def test_later_saves_keep_the_first_onboarding_completed_at():
    """Un segundo guardado, un dia despues, no cambia onboarding_completed_at."""
    service, _, _, _, clock = make_service()
    service.save_profile("user-1", valid_data())
    clock.advance(days=1)

    state = service.save_profile("user-1", valid_data(goal="gain"))

    assert state.user.onboarding_completed_at == TODAY
    assert state.profile.goal == "gain"


# SDD: NFR-001 AC-N001.2
def test_save_profile_ignores_a_user_id_in_the_body():
    """Un user_id del cuerpo se ignora: solo cambia el usuario del parametro."""
    user_a = make_user("user-a")
    user_b = make_user("user-b", date_of_birth=date(1990, 1, 1))
    service, _, profile_repository, _, _ = make_service([user_a, user_b])

    service.save_profile("user-a", valid_data(user_id="user-b"))

    assert user_a.date_of_birth == date(1996, 3, 1)
    assert user_a.onboarding_completed_at is not None
    assert user_b.date_of_birth == date(1990, 1, 1)
    assert user_b.onboarding_completed_at is None
    assert list(profile_repository.profiles) == ["user-a"]


# SDD: REQ-002 AC-002.1
def test_save_profile_of_an_unknown_user_raises_not_found():
    """Un id inexistente (con datos validos) lanza ResourceNotFoundError."""
    service, _, profile_repository, unit_of_work, _ = make_service([])

    with pytest.raises(ResourceNotFoundError):
        service.save_profile("ghost", valid_data())

    assert profile_repository.created == []
    assert unit_of_work.committed is False


# SDD: REQ-003 AC-003.3
def test_invalid_save_leaves_onboarding_pending_and_touches_nothing():
    """Ante un ValidationError no se bloquea al usuario, no se crea nada ni se hace commit."""
    user = make_user(date_of_birth=date(1995, 5, 20))
    service, user_repository, profile_repository, unit_of_work, _ = make_service([user])

    with pytest.raises(ValidationError):
        service.save_profile("user-1", valid_data(goal="nope"))

    assert user_repository.for_update_calls == []
    assert profile_repository.created == []
    assert unit_of_work.committed is False
    assert user.onboarding_completed_at is None


# SDD: REQ-004 AC-004.14
def test_invalid_save_keeps_previous_profile_and_birth_date():
    """Un guardado invalido (solo la fecha mala) conserva perfil y fecha anteriores."""
    service, _, profile_repository, _, _ = make_service()
    first = service.save_profile("user-1", valid_data())
    completed_at = first.user.onboarding_completed_at

    with pytest.raises(ValidationError):
        service.save_profile(
            "user-1", valid_data(date_of_birth="2099-01-01", goal="gain", weight=100)
        )

    state = service.get_profile("user-1")
    assert state.user.date_of_birth == date(1996, 3, 1)
    assert state.user.onboarding_completed_at == completed_at
    assert state.profile.goal == "maintain"
    assert state.profile.weight == 72.5
    assert len(profile_repository.created) == 1


# --------------------------------------------------------------------------
# Validacion
# --------------------------------------------------------------------------


# SDD: REQ-004 AC-004.13
@pytest.mark.parametrize("body", [None, [], [1, 2], "x", 42])
def test_rejects_a_body_that_is_not_an_object(body):
    """Un cuerpo ausente o que no es un objeto da el mensaje de datos no validos."""
    assert_rejected(body, BODY_INVALID)


# SDD: REQ-004 AC-004.1
@pytest.mark.parametrize("gender", [MISSING, "other", "Male", "", None, 1])
def test_rejects_an_invalid_gender(gender):
    """El genero ausente o distinto de male/female es invalido."""
    assert_rejected(valid_data(gender=gender), GENDER_INVALID)


# SDD: REQ-004 AC-004.2
@pytest.mark.parametrize(
    "dob",
    [MISSING, None, 19950520, "20010101", "2001-W01-1", "2001-02-30", "2001-1-5", "hola", ""],
)
def test_rejects_an_invalid_birth_date(dob):
    """Ausente, null, no texto, mal formato o fecha inexistente."""
    assert_rejected(valid_data(date_of_birth=dob), DOB_INVALID)


# SDD: REQ-004 AC-004.3
def test_rejects_a_future_birth_date():
    """Una fecha posterior a hoy es futura."""
    assert_rejected(valid_data(date_of_birth="2026-10-12"), DOB_FUTURE)


# SDD: REQ-004 AC-004.4
@pytest.mark.parametrize("dob", ["2020-01-01", "2013-01-01", "1925-10-11", "1900-01-01"])
def test_rejects_an_age_outside_14_to_100(dob):
    """Menos de 14 o mas de 100 anos cumplidos."""
    assert_rejected(valid_data(date_of_birth=dob), AGE_RANGE)


# SDD: REQ-004 AC-004.5
@pytest.mark.parametrize("unit", [MISSING, "m", "CM", None, 5])
def test_rejects_an_invalid_height_unit(unit):
    """La unidad de altura debe ser cm o ft."""
    assert_rejected(valid_data(height_unit=unit), HEIGHT_UNIT_INVALID)


# SDD: REQ-004 AC-004.6
@pytest.mark.parametrize("height", [MISSING, None, "175", 99.9, 250.1, True, float("nan")])
def test_rejects_an_invalid_height_in_cm(height):
    """height_cm ausente, no numerico, bool o fuera de 100-250."""
    assert_rejected(valid_data(height_cm=height), HEIGHT_CM_INVALID)


# SDD: REQ-004 AC-004.7
@pytest.mark.parametrize(
    "ft, inches",
    [
        (MISSING, 0),
        (None, 0),
        (2, 0),
        (9, 0),
        (5.5, 0),
        ("5", 0),
        (True, 0),
        (5, 12),
        (5, -1),
        (5, 3.5),
        (5, "3"),
        (5, True),
    ],
)
def test_rejects_an_invalid_height_in_feet(ft, inches):
    """height_ft no entero o fuera de 3-8, o height_in no entero o fuera de 0-11."""
    assert_rejected(
        valid_data(height_unit="ft", height_cm=MISSING, height_ft=ft, height_in=inches),
        HEIGHT_FT_INVALID,
    )


# SDD: REQ-004 AC-004.7
@pytest.mark.parametrize("inches", [MISSING, None])
def test_missing_height_inches_is_stored_as_zero(inches):
    """Si height_in falta, se toma como 0 y el perfil es valido."""
    service, *_ = make_service()

    state = service.save_profile(
        "user-1",
        valid_data(height_unit="ft", height_cm=MISSING, height_ft=5, height_in=inches),
    )

    assert state.profile.height_ft == 5
    assert state.profile.height_in == 0


# SDD: REQ-004 AC-004.8
@pytest.mark.parametrize("unit", [MISSING, "st", "KG", None, 1])
def test_rejects_an_invalid_weight_unit(unit):
    """La unidad de peso debe ser kg o lb."""
    assert_rejected(valid_data(weight_unit=unit), WEIGHT_UNIT_INVALID)


# SDD: REQ-004 AC-004.9
@pytest.mark.parametrize("weight", [MISSING, None, "70", 29.9, 300.1, True, float("nan")])
def test_rejects_an_invalid_weight_in_kg(weight):
    """Peso en kg ausente, no numerico, NaN o fuera de 30-300."""
    assert_rejected(valid_data(weight_unit="kg", weight=weight), WEIGHT_KG_INVALID)


# SDD: REQ-004 AC-004.10
@pytest.mark.parametrize("weight", [MISSING, None, "160", 65.9, 660.1, True])
def test_rejects_an_invalid_weight_in_lb(weight):
    """Peso en lb ausente, no numerico o fuera de 66-660."""
    assert_rejected(valid_data(weight_unit="lb", weight=weight), WEIGHT_LB_INVALID)


# SDD: REQ-004 AC-004.11
@pytest.mark.parametrize("level", [MISSING, "extreme", "", None, 3])
def test_rejects_an_invalid_activity_level(level):
    """activity_level fuera de low/moderate/high/very_high/athlete."""
    assert_rejected(valid_data(activity_level=level), ACTIVITY_INVALID)


# SDD: REQ-004 AC-004.12
@pytest.mark.parametrize("goal", [MISSING, "bulk", "", None, 3])
def test_rejects_an_invalid_goal(goal):
    """goal fuera de lose/lose_slow/maintain/gain_slow/gain."""
    assert_rejected(valid_data(goal=goal), GOAL_INVALID)


# SDD: REQ-004 AC-004.14
def test_reports_a_single_error_when_several_fields_are_invalid():
    """Con varios campos invalidos se informa solo de uno (el primero en el orden fijo)."""
    assert_rejected(
        valid_data(date_of_birth="2001-02-30", gender="other", goal="x"), DOB_INVALID
    )


# --------------------------------------------------------------------------
# Limites
# --------------------------------------------------------------------------


# SDD: REQ-004 AC-004.15
@pytest.mark.parametrize(
    "dob",
    [
        "2012-10-11",  # cumple 14 hoy
        "1925-10-12",  # 100 anos cumplidos, aun no 101
    ],
)
def test_accepts_the_age_boundaries(dob):
    """Quien cumple 14 hoy y quien tiene 100 (aun no 101) se aceptan."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(date_of_birth=dob))

    assert state.user.date_of_birth == date.fromisoformat(dob)


# SDD: REQ-004 AC-004.15
@pytest.mark.parametrize("height", [100, 250])
def test_accepts_the_height_boundaries_in_cm(height):
    """100 y 250 cm se aceptan."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(height_cm=height))

    assert state.profile.height_cm == height


# SDD: REQ-004 AC-004.15
@pytest.mark.parametrize("ft, inches", [(3, 0), (8, 11)])
def test_accepts_the_height_boundaries_in_feet(ft, inches):
    """3 ft 0 in y 8 ft 11 in se aceptan."""
    service, *_ = make_service()

    state = service.save_profile(
        "user-1",
        valid_data(height_unit="ft", height_cm=MISSING, height_ft=ft, height_in=inches),
    )

    assert (state.profile.height_ft, state.profile.height_in) == (ft, inches)


# SDD: REQ-004 AC-004.15
@pytest.mark.parametrize("unit, weight", [("kg", 30), ("kg", 300), ("lb", 66), ("lb", 660)])
def test_accepts_the_weight_boundaries(unit, weight):
    """30/300 kg y 66/660 lb se aceptan."""
    service, *_ = make_service()

    state = service.save_profile("user-1", valid_data(weight_unit=unit, weight=weight))

    assert state.profile.weight == weight


# SDD: REQ-004 AC-004.16
def test_rejects_someone_turning_14_tomorrow():
    """Quien cumple 14 anos manana todavia tiene 13."""
    assert_rejected(valid_data(date_of_birth="2012-10-12"), AGE_RANGE)


# SDD: REQ-004 AC-004.16
def test_rejects_someone_who_turned_101_today():
    """Quien cumple 101 hoy ya supera los 100."""
    assert_rejected(valid_data(date_of_birth="1925-10-11"), AGE_RANGE)


# --------------------------------------------------------------------------
# Enteros enormes (spec 013, REQ-001)
# --------------------------------------------------------------------------

HUGE = 10**400


# SDD: 013 REQ-001 AC-001.1
def test_huge_integer_height_in_cm_is_rejected_with_the_range_message():
    """Una altura de 10^400 cm da el mensaje de rango, no un OverflowError."""
    assert_rejected(valid_data(height_unit="cm", height_cm=HUGE), HEIGHT_CM_INVALID)


# SDD: 013 REQ-001 AC-001.2
def test_huge_integer_weight_in_kg_is_rejected_with_the_range_message():
    """Un peso de 10^400 kg da el mensaje de rango en kg."""
    assert_rejected(valid_data(weight_unit="kg", weight=HUGE), WEIGHT_KG_INVALID)


# SDD: 013 REQ-001 AC-001.3
def test_huge_negative_integer_weight_in_lb_is_rejected_with_the_range_message():
    """Un peso de -10^400 lb da el mensaje de rango en lb."""
    assert_rejected(valid_data(weight_unit="lb", weight=-HUGE), WEIGHT_LB_INVALID)


# SDD: 013 REQ-001 AC-001.4
def test_huge_integer_weight_leaves_the_saved_profile_untouched():
    """Con un perfil ya guardado, un peso enorme se rechaza sin modificarlo ni hacer commit."""
    service, _, profile_repository, unit_of_work, _ = make_service()
    service.save_profile("user-1", valid_data())
    before = (
        profile_repository.profiles["user-1"].weight,
        profile_repository.profiles["user-1"].height_cm,
    )
    unit_of_work.committed = False

    with pytest.raises(ValidationError) as excinfo:
        service.save_profile("user-1", valid_data(weight=HUGE))

    assert excinfo.value.message == WEIGHT_KG_INVALID
    assert len(profile_repository.created) == 1
    assert (
        profile_repository.profiles["user-1"].weight,
        profile_repository.profiles["user-1"].height_cm,
    ) == before
    assert unit_of_work.committed is False
