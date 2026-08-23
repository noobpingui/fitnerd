from repositories.exercise_favorite_repository import ExerciseFavoriteRepository
from repositories.exercise_repository import ExerciseRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.exercise_favorite import ExerciseFavorite
from exceptions.custom_exceptions import ConflictError, ResourceNotFoundError


class ExerciseFavoriteService:
    def __init__(
        self,
        exercise_favorite_repository: ExerciseFavoriteRepository,
        exercise_repository: ExerciseRepository,
        unit_of_work: UnitOfWork,
    ):
        self.exercise_favorite_repository = exercise_favorite_repository
        self.exercise_repository = exercise_repository
        self.unit_of_work = unit_of_work

    def add_favorite(self, user_id, exercise_id):
        exercise = self.exercise_repository.get_by_id(exercise_id)
        #Un ejercicio desactivado se trata como "no encontrado" - no tiene sentido
        #poder favoritear algo que ya se oculto del catalogo.
        if exercise is None or not exercise.is_active:
            raise ResourceNotFoundError("Ejercicio no encontrado")

        existing = self.exercise_favorite_repository.get_by_user_and_exercise(user_id, exercise_id)
        if existing:
            raise ConflictError("Este ejercicio ya esta en tus favoritos")

        favorite = ExerciseFavorite(user_id=user_id, exercise_id=exercise_id)
        self.exercise_favorite_repository.create(favorite)
        self.unit_of_work.commit()

        return favorite

    def remove_favorite(self, user_id, exercise_id):
        favorite = self.exercise_favorite_repository.get_by_user_and_exercise(user_id, exercise_id)
        if favorite is None:
            raise ResourceNotFoundError("Este ejercicio no esta en tus favoritos")

        self.exercise_favorite_repository.delete(favorite)
        self.unit_of_work.commit()

    def list_favorites(self, user_id):
        return self.exercise_favorite_repository.list_exercises_by_user(user_id)
