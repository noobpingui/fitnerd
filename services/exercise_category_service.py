from repositories.exercise_category_repository import ExerciseCategoryRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.exercise_category import ExerciseCategory
from exceptions.custom_exceptions import ConflictError, ResourceNotFoundError


class ExerciseCategoryService:
    def __init__(self, exercise_category_repository: ExerciseCategoryRepository, unit_of_work: UnitOfWork):
        self.exercise_category_repository = exercise_category_repository
        self.unit_of_work = unit_of_work

    def create_category(self, name):
        existing = self.exercise_category_repository.get_by_name(name)
        if existing:
            raise ConflictError(f"Ya existe una categoria llamada '{name}'")

        category = ExerciseCategory(name=name)
        self.exercise_category_repository.create(category)
        self.unit_of_work.commit()

        return category

    def list_categories(self):
        return self.exercise_category_repository.list_active()

    def delete_category(self, category_id):
        category = self.exercise_category_repository.get_by_id(category_id)

        if category is None:
            raise ResourceNotFoundError("Categoria no encontrada")

        #Soft delete: solo se oculta del catalogo (is_active=False), nunca se borra la fila.
        #Es un UPDATE, no un DELETE - nunca puede chocar con una FK, por eso ya no hace
        #falta capturar IntegrityError aca. Los exercises que la referencian quedan intactos
        #(deliberadamente sin cascada - no se desactivan automaticamente).
        category.is_active = False
        self.exercise_category_repository.update(category)
        self.unit_of_work.commit()
