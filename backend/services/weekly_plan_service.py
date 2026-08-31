from repositories.weekly_plan_repository import WeeklyPlanRepository
from repositories.exercise_repository import ExerciseRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.weekly_plan_entry import WeeklyPlanEntry
from exceptions.custom_exceptions import ValidationError, ResourceNotFoundError

#0 = Domingo ... 6 = Sabado.
VALID_DAYS = set(range(7))


class WeeklyPlanService:
    def __init__(
        self,
        weekly_plan_repository: WeeklyPlanRepository,
        exercise_repository: ExerciseRepository,
        unit_of_work: UnitOfWork,
    ):
        self.weekly_plan_repository = weekly_plan_repository
        self.exercise_repository = exercise_repository
        self.unit_of_work = unit_of_work

    def add_entry(self, user_id, exercise_id, day_of_week):
        if day_of_week not in VALID_DAYS:
            raise ValidationError("day_of_week debe ser un numero entre 0 (Domingo) y 6 (Sabado)")

        exercise = self.exercise_repository.get_by_id(exercise_id)
        if exercise is None or not exercise.is_active:
            raise ResourceNotFoundError("Ejercicio no encontrado")

        #Soltar el mismo ejercicio dos veces sobre el mismo dia es un no-op: devolvemos
        #la entrada existente en vez de fallar, asi el frontend no tiene que chequear
        #"ya esta ahi?" antes de cada drop.
        existing = self.weekly_plan_repository.get_by_user_exercise_day(user_id, exercise_id, day_of_week)
        if existing:
            return existing

        entry = WeeklyPlanEntry(user_id=user_id, exercise_id=exercise_id, day_of_week=day_of_week)
        self.weekly_plan_repository.create(entry)
        self.unit_of_work.commit()

        return entry

    def remove_entry(self, user_id, entry_id):
        entry = self.weekly_plan_repository.get_by_id_for_user(entry_id, user_id)
        if entry is None:
            raise ResourceNotFoundError("Entrada no encontrada")

        self.weekly_plan_repository.delete(entry)
        self.unit_of_work.commit()

    def list_plan(self, user_id):
        return self.weekly_plan_repository.list_by_user(user_id)
