from repositories.body_metric_repository import BodyMetricRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.body_metric import BodyMetric
from exceptions.custom_exceptions import ValidationError, ResourceNotFoundError


class BodyMetricService:
    def __init__(self, body_metric_repository: BodyMetricRepository, unit_of_work: UnitOfWork):
        self.body_metric_repository = body_metric_repository
        self.unit_of_work = unit_of_work

    def create_metric(self, user_id, weight, body_fat_percentage, muscle_mass_percentage, notes, recorded_at):
        if weight is None and body_fat_percentage is None and muscle_mass_percentage is None:
            raise ValidationError("Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)")

        if weight is not None and weight <= 0:
            raise ValidationError("El peso debe ser mayor a 0")

        if body_fat_percentage is not None and not (0 <= body_fat_percentage <= 100):
            raise ValidationError("El porcentaje de grasa corporal debe estar entre 0 y 100")

        if muscle_mass_percentage is not None and not (0 <= muscle_mass_percentage <= 100):
            raise ValidationError("El porcentaje de masa muscular debe estar entre 0 y 100")

        metric = BodyMetric(
            user_id=user_id,
            weight=weight,
            body_fat_percentage=body_fat_percentage,
            muscle_mass_percentage=muscle_mass_percentage,
            notes=notes,
            recorded_at=recorded_at,
        )

        self.body_metric_repository.create(metric)
        self.unit_of_work.commit()

        return metric

    def list_metrics(self, user_id):
        return self.body_metric_repository.list_by_user(user_id)

    def delete_metric(self, user_id, metric_id):
        metric = self.body_metric_repository.get_by_id_and_user(metric_id, user_id)

        if metric is None:
            raise ResourceNotFoundError("Registro no encontrado")

        self.body_metric_repository.delete(metric)
        self.unit_of_work.commit()
