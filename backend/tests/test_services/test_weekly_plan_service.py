"""Unitarios de WeeklyPlanService - el foco principal aca es
test_adding_the_same_exercise_to_the_same_day_twice_is_idempotent: el
comportamiento de "soltar el mismo ejercicio sobre el mismo dia dos veces
no debe fallar, debe devolver la entrada que ya existia" es una decision de
diseno real (ver el comentario en weekly_plan_service.py) que no es obvia
leyendo la firma del metodo - exactamente el tipo de cosa que vale la pena
fijar con un test, para que un futuro refactor no la rompa sin darse cuenta.
"""

from types import SimpleNamespace

import pytest

from services.weekly_plan_service import WeeklyPlanService
from exceptions.custom_exceptions import ValidationError, ResourceNotFoundError
from tests.fakes import FakeUnitOfWork


class FakeWeeklyPlanRepository:
    def __init__(self):
        self.created = []

    def get_by_user_exercise_day(self, user_id, exercise_id, day_of_week):
        for entry in self.created:
            if (
                entry.user_id == user_id
                and entry.exercise_id == exercise_id
                and entry.day_of_week == day_of_week
            ):
                return entry
        return None

    def create(self, entry):
        self.created.append(entry)
        return entry


class FakeExerciseRepository:
    """El servicio necesita confirmar que el ejercicio existe y esta activo
    antes de agregarlo a la planificacion - esta fake deja configurar de
    antemano que ejercicio (o None) devolver, segun lo que cada test quiera
    probar."""
    def __init__(self, exercise=None):
        self.exercise = exercise

    def get_by_id(self, exercise_id):
        return self.exercise


def make_service(exercise=SimpleNamespace(id="exercise-1", is_active=True)):
    weekly_plan_repository = FakeWeeklyPlanRepository()
    service = WeeklyPlanService(
        weekly_plan_repository,
        FakeExerciseRepository(exercise),
        FakeUnitOfWork(),
    )
    return service, weekly_plan_repository


def test_rejects_a_day_of_week_outside_0_6():
    service, _ = make_service()
    with pytest.raises(ValidationError):
        service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=7)


def test_rejects_an_exercise_that_does_not_exist():
    service, _ = make_service(exercise=None)
    with pytest.raises(ResourceNotFoundError):
        service.add_entry(user_id="user-1", exercise_id="ghost", day_of_week=0)


def test_rejects_an_inactive_exercise():
    inactive = SimpleNamespace(id="exercise-1", is_active=False)
    service, _ = make_service(exercise=inactive)
    with pytest.raises(ResourceNotFoundError):
        service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=0)


def test_creates_a_new_entry_for_a_valid_drop():
    service, repository = make_service()

    entry = service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=3)

    assert entry.user_id == "user-1"
    assert entry.day_of_week == 3
    assert repository.created == [entry]


def test_adding_the_same_exercise_to_the_same_day_twice_is_idempotent():
    service, repository = make_service()

    first_drop = service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=2)
    second_drop = service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=2)

    # Misma entrada devuelta las dos veces, y sobre todo: el repositorio
    # solo llego a crear UNA fila, no dos - si el service alguna vez
    # perdiera el chequeo de "existing", este test lo detectaria.
    assert first_drop is second_drop
    assert len(repository.created) == 1


def test_the_same_exercise_on_two_different_days_creates_two_entries():
    # Contraparte del test anterior: el "no-op" es especifico a (usuario,
    # ejercicio, dia) - el mismo ejercicio en un dia DISTINTO si debe crear
    # una entrada nueva, no pisar ni ignorar la anterior.
    service, repository = make_service()

    service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=1)
    service.add_entry(user_id="user-1", exercise_id="exercise-1", day_of_week=2)

    assert len(repository.created) == 2
