import re
from dataclasses import dataclass
from datetime import date, timedelta

from exceptions.custom_exceptions import ResourceNotFoundError, ValidationError
from models.body_metric import BodyMetric
from services.number_validation import is_number
from services.profile_service import (
    USER_NOT_FOUND_MESSAGE,
    WEIGHT_RANGES,
    _round1,
    utc_now,
)

INVALID_BODY_MESSAGE = "Los datos de la medición no son válidos"
NO_VALUES_MESSAGE = "Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)"
WEIGHT_MESSAGE = "El peso debe estar entre 29,9 y 300 kg"
FAT_MESSAGE = "El porcentaje de grasa corporal debe estar entre 3 y 60"
MUSCLE_MESSAGE = "El porcentaje de masa muscular debe estar entre 10 y 70"
INVALID_DATE_MESSAGE = "La fecha de la medición no es válida"
FUTURE_DATE_MESSAGE = "La fecha de la medición no puede ser futura"
NOT_FOUND_MESSAGE = "Registro no encontrado"

WEIGHT_RANGE = (29.9, 300)
FAT_RANGE = (3, 60)
MUSCLE_RANGE = (10, 70)
KG_PER_LB = 0.45359237
SYNC_TOLERANCE_KG = 0.05

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class SaveMetricResult:
    metric: object
    created: bool


def _validate_values(data):
    """Función pura: lanza el primer ValidationError (solo se informa de uno)."""
    if not isinstance(data, dict):
        raise ValidationError(INVALID_BODY_MESSAGE)

    fields = (
        ("weight", WEIGHT_RANGE, WEIGHT_MESSAGE),
        ("body_fat_percentage", FAT_RANGE, FAT_MESSAGE),
        ("muscle_mass_percentage", MUSCLE_RANGE, MUSCLE_MESSAGE),
    )
    if all(data.get(name) is None for name, _, _ in fields):
        raise ValidationError(NO_VALUES_MESSAGE)

    for name, (low, high), message in fields:
        value = data.get(name)
        if value is None:
            continue
        if not is_number(value) or not low <= value <= high:
            raise ValidationError(message)


def _parse_recorded_at(value, today):
    if value is None:
        return today
    if not isinstance(value, str) or not DATE_PATTERN.match(value):
        raise ValidationError(INVALID_DATE_MESSAGE)
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValidationError(INVALID_DATE_MESSAGE)
    if parsed > today + timedelta(days=1):
        raise ValidationError(FUTURE_DATE_MESSAGE)
    return parsed


class BodyMetricService:
    def __init__(
        self,
        body_metric_repository,
        user_repository,
        user_profile_repository,
        unit_of_work,
        clock=utc_now,
    ):
        self.body_metric_repository = body_metric_repository
        self.user_repository = user_repository
        self.user_profile_repository = user_profile_repository
        self.unit_of_work = unit_of_work
        self.clock = clock

    def save_metric(self, user_id, data):
        # Se valida antes de tocar nada: un 400 no modifica el estado.
        _validate_values(data)
        recorded_at = _parse_recorded_at(data.get("recorded_at"), self.clock().date())
        notes = data.get("notes")
        if notes is not None and not isinstance(notes, str):
            raise ValidationError(INVALID_BODY_MESSAGE)

        try:
            self._lock_user(user_id)

            existing = self.body_metric_repository.get_by_user_and_date(user_id, recorded_at)
            if existing is not None:
                for column in ("weight", "body_fat_percentage", "muscle_mass_percentage", "notes"):
                    value = data.get(column)
                    if value is not None:
                        setattr(existing, column, value)
                metric, created = existing, False
            else:
                metric = BodyMetric(
                    user_id=user_id,
                    weight=data.get("weight"),
                    body_fat_percentage=data.get("body_fat_percentage"),
                    muscle_mass_percentage=data.get("muscle_mass_percentage"),
                    notes=notes,
                    recorded_at=recorded_at,
                )
                self.body_metric_repository.create(metric)
                created = True

            self._sync_profile_weight(user_id)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

        return SaveMetricResult(metric, created)

    def update_metric(self, user_id, metric_id, data):
        try:
            self._lock_user(user_id)

            metric = self.body_metric_repository.get_by_id_and_user(metric_id, user_id)
            if metric is None:
                raise ResourceNotFoundError(NOT_FOUND_MESSAGE)

            # Aún no se ha modificado nada: un 400 deja la medición intacta.
            _validate_values(data)

            metric.weight = data.get("weight")
            metric.body_fat_percentage = data.get("body_fat_percentage")
            metric.muscle_mass_percentage = data.get("muscle_mass_percentage")

            self._sync_profile_weight(user_id)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

        return metric

    def list_metrics(self, user_id):
        return self.body_metric_repository.list_by_user(user_id)

    def delete_metric(self, user_id, metric_id):
        try:
            self._lock_user(user_id)

            metric = self.body_metric_repository.get_by_id_and_user(metric_id, user_id)
            if metric is None:
                raise ResourceNotFoundError(NOT_FOUND_MESSAGE)

            self.body_metric_repository.delete(metric)

            self._sync_profile_weight(user_id)
            self.unit_of_work.commit()
        except Exception:
            self.unit_of_work.rollback()
            raise

    def _lock_user(self, user_id):
        # Serializa las escrituras del usuario (también PUT /api/profile).
        user = self.user_repository.get_by_id_for_update(user_id)
        if user is None:
            raise ResourceNotFoundError(USER_NOT_FOUND_MESSAGE)

    def _sync_profile_weight(self, user_id):
        """Deja el peso del perfil igual a la última medición con peso."""
        profile = self.user_profile_repository.get_by_user_id(user_id)
        if profile is None:
            return

        latest = self.body_metric_repository.get_latest_with_weight(user_id)
        if latest is None:
            return

        unit = profile.weight_unit
        profile_kg = profile.weight if unit == "kg" else profile.weight * KG_PER_LB
        if abs(latest.weight - profile_kg) <= SYNC_TOLERANCE_KG:
            return

        value = latest.weight if unit == "kg" else latest.weight / KG_PER_LB
        low, high, _ = WEIGHT_RANGES[unit]
        profile.weight = min(max(_round1(value), low), high)
