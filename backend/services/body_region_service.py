from repositories.body_region_repository import BodyRegionRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.body_region import BodyRegion
from exceptions.custom_exceptions import ConflictError, ResourceNotFoundError


class BodyRegionService:
    def __init__(self, body_region_repository: BodyRegionRepository, unit_of_work: UnitOfWork):
        self.body_region_repository = body_region_repository
        self.unit_of_work = unit_of_work

    def create_region(self, name):
        existing = self.body_region_repository.get_by_name(name)
        if existing:
            raise ConflictError(f"Ya existe una region llamada '{name}'")

        region = BodyRegion(name=name)
        self.body_region_repository.create(region)
        self.unit_of_work.commit()

        return region

    def list_regions(self):
        return self.body_region_repository.list_active()

    def delete_region(self, region_id):
        region = self.body_region_repository.get_by_id(region_id)

        if region is None:
            raise ResourceNotFoundError("Region no encontrada")

        #Soft delete, identico criterio que ExerciseCategoryService.delete_category(): las
        #categorias que cuelgan de esta region quedan intactas en la base (sin cascada), pero
        #list_by_region() del lado del frontend ya no las va a poder alcanzar navegando desde
        #una region oculta.
        region.is_active = False
        self.body_region_repository.update(region)
        self.unit_of_work.commit()
