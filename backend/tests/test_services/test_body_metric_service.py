"""Test UNITARIO de verdad: no toca Postgres para nada, no usa la fixture
`db_session`. BodyMetricService recibe su repositorio y su unit_of_work por
PARAMETRO en el constructor (inyeccion de dependencias) en vez de crearlos
el mismo - eso es lo que permite pasarle una version "falsa" (en memoria)
de cada uno aca abajo. El servicio no tiene forma de saber (ni le importa)
si el repositorio que recibio es el real o uno de mentira, siempre y
cuando tenga los mismos metodos que usa (create). Por eso corre en
milisegundos y no necesita la base de test levantada.
"""

from datetime import date

import pytest

from services.body_metric_service import BodyMetricService
from exceptions.custom_exceptions import ValidationError
from tests.fakes import FakeUnitOfWork


class FakeBodyMetricRepository:
    def __init__(self):
        self.created = []

    def create(self, metric):
        self.created.append(metric)
        return metric


@pytest.fixture
def service():
    return BodyMetricService(FakeBodyMetricRepository(), FakeUnitOfWork())


def test_rejects_a_metric_with_no_fields_at_all(service):
    # Ni peso, ni % de grasa, ni % de masa muscular - no hay nada que
    # guardar, el servicio debe rechazarlo antes de llegar al repositorio.
    with pytest.raises(ValidationError):
        service.create_metric(
            user_id="any-id",
            weight=None,
            body_fat_percentage=None,
            muscle_mass_percentage=None,
            notes=None,
            recorded_at=date.today(),
        )


def test_rejects_a_non_positive_weight(service):
    with pytest.raises(ValidationError):
        service.create_metric(
            user_id="any-id",
            weight=0,
            body_fat_percentage=None,
            muscle_mass_percentage=None,
            notes=None,
            recorded_at=date.today(),
        )


def test_rejects_a_body_fat_percentage_over_100(service):
    with pytest.raises(ValidationError):
        service.create_metric(
            user_id="any-id",
            weight=None,
            body_fat_percentage=150,
            muscle_mass_percentage=None,
            notes=None,
            recorded_at=date.today(),
        )


def test_accepts_a_valid_weight_only_metric(service):
    metric = service.create_metric(
        user_id="any-id",
        weight=70.5,
        body_fat_percentage=None,
        muscle_mass_percentage=None,
        notes=None,
        recorded_at=date.today(),
    )

    assert metric.weight == 70.5
    # Prueba, sin tocar Postgres, que el servicio SI llego a pedirle al
    # repositorio que la guarde y SI confirmo la transaccion - las dos
    # cosas que un servicio de "creacion" tiene que hacer.
    assert metric in service.body_metric_repository.created
    assert service.unit_of_work.committed is True
