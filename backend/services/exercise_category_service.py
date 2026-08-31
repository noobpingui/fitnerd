from repositories.exercise_category_repository import ExerciseCategoryRepository
from repositories.body_region_repository import BodyRegionRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.exercise_category import ExerciseCategory
from exceptions.custom_exceptions import ConflictError, ResourceNotFoundError


class ExerciseCategoryService:
    def __init__(
        self,
        exercise_category_repository: ExerciseCategoryRepository,
        body_region_repository: BodyRegionRepository,
        unit_of_work: UnitOfWork,
    ):
        self.exercise_category_repository = exercise_category_repository
        self.body_region_repository = body_region_repository
        self.unit_of_work = unit_of_work

    def create_category(self, body_region_id, name):
        #Misma logica que ExerciseService.create_exercise() con su categoria padre: una
        #region desactivada se trata como "no encontrada" para escritura.
        region = self.body_region_repository.get_by_id(body_region_id)
        if region is None or not region.is_active:
            raise ResourceNotFoundError("Region no encontrada")

        existing = self.exercise_category_repository.get_by_name(name)
        if existing:
            raise ConflictError(f"Ya existe una categoria llamada '{name}'")

        category = ExerciseCategory(body_region_id=body_region_id, name=name)
        self.exercise_category_repository.create(category)
        self.unit_of_work.commit()

        return category

    def list_by_region(self, body_region_id):
        #Misma logica que ExerciseService.list_by_category(): si la region no existe o esta
        #desactivada, no tiene sentido devolver una lista vacia silenciosa - es un 404 real.
        region = self.body_region_repository.get_by_id(body_region_id)
        if region is None or not region.is_active:
            raise ResourceNotFoundError("Region no encontrada")

        return self.exercise_category_repository.list_by_region(body_region_id)

    def list_all(self):
        #Sin filtro de region - usado cuando lo que hace falta es resolver
        #nombre por id (ej: agrupar favoritos por categoria), no navegar
        #el catalogo nivel por nivel.
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
