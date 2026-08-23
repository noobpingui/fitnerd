from repositories.exercise_repository import ExerciseRepository
from repositories.exercise_category_repository import ExerciseCategoryRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.exercise import Exercise
from exceptions.custom_exceptions import ConflictError, ResourceNotFoundError


class ExerciseService:
    def __init__(
        self,
        exercise_repository: ExerciseRepository,
        exercise_category_repository: ExerciseCategoryRepository,
        unit_of_work: UnitOfWork,
    ):
        self.exercise_repository = exercise_repository
        self.exercise_category_repository = exercise_category_repository
        self.unit_of_work = unit_of_work

    def create_exercise(self, category_id, name, video_url):
        category = self.exercise_category_repository.get_by_id(category_id)
        #Una categoria desactivada se trata como "no encontrada" para escritura -
        #no tiene sentido agregar ejercicios nuevos a un catalogo que ya se oculto.
        if category is None or not category.is_active:
            raise ResourceNotFoundError("Categoria no encontrada")

        existing = self.exercise_repository.get_by_category_and_name(category_id, name)
        if existing:
            raise ConflictError(f"Ya existe un ejercicio llamado '{name}' en esta categoria")

        exercise = Exercise(category_id=category_id, name=name, video_url=video_url)
        self.exercise_repository.create(exercise)
        self.unit_of_work.commit()

        return exercise

    def list_by_category(self, category_id):
        category = self.exercise_category_repository.get_by_id(category_id)
        if category is None or not category.is_active:
            raise ResourceNotFoundError("Categoria no encontrada")

        return self.exercise_repository.list_by_category(category_id)

    def delete_exercise(self, exercise_id):
        exercise = self.exercise_repository.get_by_id(exercise_id)

        if exercise is None:
            raise ResourceNotFoundError("Ejercicio no encontrado")

        #Soft delete: solo se oculta del catalogo (is_active=False), nunca se borra la fila.
        #Es un UPDATE, no un DELETE - nunca puede chocar con una FK, asi que ya no hace
        #falta capturar IntegrityError aca. Los favoritos (y a futuro, historial de
        #workouts) que lo referencian quedan intactos.
        exercise.is_active = False
        self.exercise_repository.update(exercise)
        self.unit_of_work.commit()
