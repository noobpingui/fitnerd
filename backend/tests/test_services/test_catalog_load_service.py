"""Tests de `CatalogLoadService` (spec 023): usan el Postgres de prueba con los
repositorios y el `UnitOfWork` reales (`db_session`) y alimentos de USDA
sembrados en `foods`. Los CSV son temporales y de pocas filas; el CSV real del
repositorio lo prueba `test_food_catalog_csv.py`."""

import pytest
from sqlalchemy import select

from models import CatalogFood, Food
from repositories.catalog_food_repository import CatalogFoodRepository
from repositories.food_repository import FoodRepository
from services.catalog_csv_reader import CatalogFileError
from services.catalog_load_service import (
    CatalogLoadService,
    CatalogLoadSummary,
    format_catalog_summary,
)
from services.catalog_search_service import CatalogSearchService
from tests.catalog_samples import CATALOG_COLUMNS, catalog_row, write_catalog_csv
from unit_of_work.unit_of_work import UnitOfWork

USDA_FOODS = [
    dict(fdc_id=171477, description="Chicken breast", calories_kcal=165.0,
         protein_g=31.0, carbs_g=0.0, fat_g=3.57),
    dict(fdc_id=168878, description="Rice, white", calories_kcal=130.0,
         protein_g=2.69, carbs_g=28.17, fat_g=0.28),
    dict(fdc_id=173944, description="Bananas, raw", calories_kcal=89.0,
         protein_g=1.09, carbs_g=22.84, fat_g=0.33),
]


class CountingUnitOfWork(UnitOfWork):
    """`UnitOfWork` real que además cuenta los commits y los rollbacks."""

    def __init__(self, session):
        super().__init__(session)
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1
        super().commit()

    def rollback(self):
        self.rollbacks += 1
        super().rollback()


def chicken(**overrides):
    return catalog_row(**overrides)


def rice(**overrides):
    values = dict(
        id="arroz-blanco-cocido", name="Arroz blanco cocido", calories_kcal="130.0",
        protein_g="2.69", carbs_g="28.17", fat_g="0.28", fdc_id="168878",
    )
    values.update(overrides)
    return catalog_row(**values)


def banana(**overrides):
    values = dict(
        id="banano", name="Banano", synonyms="guineo|cambur", calories_kcal="89.0",
        protein_g="1.09", carbs_g="22.84", fat_g="0.33", fdc_id="173944",
    )
    values.update(overrides)
    return catalog_row(**values)


def manual(**overrides):
    values = dict(
        id="tortilla-de-maiz", name="Tortilla de maíz", synonyms="", calories_kcal="218.0",
        protein_g="5.7", carbs_g="44.6", fat_g="2.9", source="manual", fdc_id="",
        reference="Tabla de composición de alimentos, código 123",
    )
    values.update(overrides)
    return catalog_row(**values)


@pytest.fixture
def env(db_session, tmp_path):
    """Base con los tres alimentos de USDA sembrados y un servicio real."""
    for fields in USDA_FOODS:
        db_session.add(Food(data_type="foundation", embedding=None, **fields))
    db_session.commit()
    uow = CountingUnitOfWork(db_session)
    service = CatalogLoadService(CatalogFoodRepository(db_session), FoodRepository(db_session), uow)

    class Env:
        session = db_session
        unit_of_work = uow

        def write(self, rows, columns=CATALOG_COLUMNS, name="catalogo.csv"):
            return write_catalog_csv(tmp_path / name, rows, columns)

        def load(self, rows, **kwargs):
            return service.run(self.write(rows, **kwargs))

        def run_path(self, path):
            return service.run(path)

        def snapshot(self):
            self.session.expire_all()
            stmt = select(CatalogFood).order_by(CatalogFood.id)
            return [
                (f.id, f.name, list(f.synonyms), f.calories_kcal, f.protein_g, f.carbs_g,
                 f.fat_g, f.source, f.fdc_id, f.reference)
                for f in self.session.scalars(stmt).all()
            ]

        def search(self, query):
            search_service = CatalogSearchService(CatalogFoodRepository(self.session))
            return [food.name for food in search_service.search(query)]

    return Env()


# --------------------------------------------------------------------------
# REQ-002: añadir, repetir, actualizar y quitar
# --------------------------------------------------------------------------


# SDD: 023 REQ-002 AC-002.1
def test_loading_three_foods_into_an_empty_catalog_adds_them(env):
    """Base sin catálogo y 3 alimentos: quedan guardados con su identificador,
    nombre, sinónimos y valores, y el resumen indica 3 añadidos."""
    summary = env.load([chicken(), rice(), banana()])

    assert summary == CatalogLoadSummary(added=3, updated=0, unchanged=0, removed=0)
    assert env.snapshot() == [
        ("arroz-blanco-cocido", "Arroz blanco cocido", [], 130.0, 2.69, 28.17, 0.28,
         "usda", 168878, None),
        ("banano", "Banano", ["guineo", "cambur"], 89.0, 1.09, 22.84, 0.33,
         "usda", 173944, None),
        ("pechuga-de-pollo-a-la-plancha", "Pechuga de pollo a la plancha", [], 165.0, 31.0,
         0.0, 3.57, "usda", 171477, None),
    ]


# SDD: 023 REQ-002 AC-002.1
def test_loading_a_manual_food_keeps_its_reference_and_no_fdc_id(env):
    """Un alimento `manual` se guarda con su referencia y sin FDC ID, sin
    necesitar nada en la base de USDA."""
    env.load([manual()])

    assert env.snapshot() == [
        ("tortilla-de-maiz", "Tortilla de maíz", [], 218.0, 5.7, 44.6, 2.9, "manual", None,
         "Tabla de composición de alimentos, código 123"),
    ]


# SDD: 023 REQ-002 AC-002.1
def test_loading_commits_once(env):
    """Toda la carga se confirma en una sola transacción."""
    env.load([chicken(), rice(), banana()])

    assert env.unit_of_work.commits == 1


# SDD: 023 REQ-002 AC-002.2
def test_loading_the_same_csv_again_leaves_everything_unchanged(env):
    """Repetir la carga: los mismos 3 alimentos y 0, 0, 3, 0 en el resumen."""
    rows = [chicken(), rice(), banana()]
    env.load(rows)
    before = env.snapshot()

    summary = env.load(rows)

    assert summary == CatalogLoadSummary(added=0, updated=0, unchanged=3, removed=0)
    assert env.snapshot() == before


# SDD: 023 REQ-002 AC-002.3
def test_a_renamed_food_is_updated_and_a_missing_one_is_removed(env):
    """El arroz cambia de nombre y sinónimos y el banano desaparece: 1
    actualizado, 1 sin cambios (el pollo) y 1 quitado; el quitado ya no se encuentra."""
    env.load([chicken(), rice(), banana()])
    assert env.search("guineo") == ["Banano"]

    summary = env.load(
        [chicken(), rice(name="Arroz blanco", synonyms="arroz pelado|arroz de mesa")]
    )

    assert summary == CatalogLoadSummary(added=0, updated=1, unchanged=1, removed=1)
    snapshot = {row[0]: row for row in env.snapshot()}
    assert set(snapshot) == {"arroz-blanco-cocido", "pechuga-de-pollo-a-la-plancha"}
    assert snapshot["arroz-blanco-cocido"][1] == "Arroz blanco"
    assert snapshot["arroz-blanco-cocido"][2] == ["arroz pelado", "arroz de mesa"]
    assert env.search("guineo") == []
    assert env.search("banano") == []
    assert env.search("pelado") == ["Arroz blanco"]


# SDD: 023 REQ-002 AC-002.3
def test_changing_a_nutrient_value_counts_as_an_update(env):
    """Cambiar un valor de una fila `manual` actualiza ese alimento."""
    env.load([manual(), chicken()])

    summary = env.load([manual(calories_kcal="219.0"), chicken()])

    assert summary == CatalogLoadSummary(added=0, updated=1, unchanged=1, removed=0)
    assert env.snapshot()[1][3] == 219.0


# SDD: 023 REQ-002 AC-002.3
def test_changing_only_the_reference_or_the_order_of_the_synonyms_counts_as_an_update(env):
    """La referencia y el orden de los sinónimos también cuentan como cambios."""
    env.load([manual(synonyms="maíz|nixtamal"), banana()])

    summary = env.load([manual(synonyms="nixtamal|maíz", reference="Otra tabla"), banana()])

    assert summary == CatalogLoadSummary(added=0, updated=1, unchanged=1, removed=0)
    row = next(r for r in env.snapshot() if r[0] == "tortilla-de-maiz")
    assert row[2] == ["nixtamal", "maíz"]
    assert row[9] == "Otra tabla"


# SDD: 023 REQ-002 AC-002.3
def test_a_food_added_in_a_later_load_is_counted_as_added(env):
    """Se añade un alimento nuevo y los existentes quedan igual."""
    env.load([chicken()])

    summary = env.load([chicken(), rice()])

    assert summary == CatalogLoadSummary(added=1, updated=0, unchanged=1, removed=0)


# SDD: 023 REQ-002 AC-002.1
def test_the_summary_starts_at_zero_and_is_formatted_in_one_line():
    """`CatalogLoadSummary()` vale 0 en todo y `format_catalog_summary` da una línea."""
    assert CatalogLoadSummary() == CatalogLoadSummary(0, 0, 0, 0)
    assert format_catalog_summary(CatalogLoadSummary(added=3)) == (
        "Catálogo: 3 añadidos, 0 actualizados, 0 sin cambios, 0 quitados."
    )
    assert format_catalog_summary(CatalogLoadSummary(1, 2, 3, 4)) == (
        "Catálogo: 1 añadidos, 2 actualizados, 3 sin cambios, 4 quitados."
    )


# --------------------------------------------------------------------------
# REQ-003: comparación con USDA
# --------------------------------------------------------------------------


# SDD: 023 REQ-003 AC-003.5
def test_a_row_with_the_exact_values_of_the_usda_food_171477_is_loaded(env):
    """165, 31,0, 0,0 y 3,57 coinciden con USDA: la fila se carga."""
    summary = env.load([chicken(calories_kcal="165", protein_g="31.0", carbs_g="0.0", fat_g="3.57")])

    assert summary.added == 1


# SDD: 023 REQ-003 AC-003.5
def test_a_row_with_fat_3_6_instead_of_3_57_names_the_row_and_the_nutrient(env):
    """165, 31,0, 0,0 y 3,6: error que nombra la fila y el nutriente distinto;
    el catálogo no cambia."""
    env.load([rice()])
    before = env.snapshot()

    with pytest.raises(CatalogFileError) as exc_info:
        env.load([chicken(fat_g="3.6")])

    message = str(exc_info.value)
    assert "Fila 1 (pechuga-de-pollo-a-la-plancha)" in message
    assert "«fat_g» es 3.6 y en USDA (FDC ID 171477) es 3.57" in message
    assert "«protein_g»" not in message
    assert env.snapshot() == before


# SDD: 023 REQ-003 AC-003.5
def test_every_nutrient_that_differs_is_reported(env):
    """Los cuatro valores distintos dan cuatro líneas."""
    with pytest.raises(CatalogFileError) as exc_info:
        env.load([chicken(calories_kcal="166", protein_g="30", carbs_g="1", fat_g="3")])

    message = str(exc_info.value)
    for column in ("calories_kcal", "protein_g", "carbs_g", "fat_g"):
        assert f"«{column}»" in message


# SDD: 023 REQ-003 AC-003.6
def test_an_fdc_id_that_does_not_exist_in_usda_names_the_row_and_the_fdc_id(env):
    """FDC ID 999999: «el FDC ID 999999 no existe en la base de USDA»."""
    env.load([rice()])
    before = env.snapshot()

    with pytest.raises(CatalogFileError) as exc_info:
        env.load([rice(), chicken(fdc_id="999999")])

    assert (
        "- Fila 2 (pechuga-de-pollo-a-la-plancha): el FDC ID 999999 no existe en la base de USDA."
        in str(exc_info.value)
    )
    assert env.snapshot() == before


# SDD: 023 REQ-003 AC-003.6
def test_a_usda_food_without_a_value_never_matches(env):
    """Si USDA no tiene dato de un nutriente, la fila no es válida («sin dato»)."""
    env.session.add(
        Food(fdc_id=555, description="Sin grasa", data_type="foundation", embedding=None,
             calories_kcal=10.0, protein_g=1.0, carbs_g=1.0, fat_g=None)
    )
    env.session.commit()

    with pytest.raises(CatalogFileError) as exc_info:
        env.load([chicken(id="sin-grasa", name="Sin grasa", fdc_id="555",
                          calories_kcal="10.0", protein_g="1.0", carbs_g="1.0", fat_g="0.0")])

    assert "sin dato" in str(exc_info.value)


# SDD: 023 REQ-003 AC-003.6
def test_all_the_usda_errors_come_in_one_message(env):
    """Una fila con FDC ID inexistente y otra con valor distinto: un solo error."""
    with pytest.raises(CatalogFileError) as exc_info:
        env.load([chicken(fdc_id="999999"), rice(calories_kcal="131.0")])

    message = str(exc_info.value)
    assert "Fila 1" in message and "Fila 2" in message


# SDD: 023 REQ-003 AC-003.6
def test_a_manual_row_does_not_look_at_the_usda_table(env):
    """Una fila `manual` se carga aunque no haya ningún alimento de USDA."""
    env.session.query(Food).delete()
    env.session.commit()

    summary = env.load([manual()])

    assert summary.added == 1


# --------------------------------------------------------------------------
# El catálogo no cambia ante cualquier error
# --------------------------------------------------------------------------


def _missing_file(env):
    return env.run_path(env.write([], name="otra.csv").with_name("no-existe.csv"))


def _missing_synonyms_column(env):
    columns = [c for c in CATALOG_COLUMNS if c != "synonyms"]
    return env.load([chicken()], columns=columns)


def _protein_120_in_row_3(env):
    return env.load([banana(), rice(), chicken(protein_g="120")])


def _repeated_id(env):
    return env.load([rice(), banana(id="arroz-blanco-cocido")])


def _repeated_name(env):
    return env.load([rice(), banana(name="Arroz blanco cocido")])


def _synonym_equal_to_another_name(env):
    return env.load([rice(), banana(synonyms="arroz blanco cocido")])


def _manual_without_reference(env):
    return env.load([banana(), manual(reference="")])


def _usda_without_fdc_id(env):
    return env.load([banana(), chicken(fdc_id="")])


def _empty_value(env):
    return env.load([banana(), chicken(carbs_g="")])


def _different_value_than_usda(env):
    return env.load([banana(), chicken(fat_g="3.6")])


def _unknown_fdc_id(env):
    return env.load([banana(), chicken(fdc_id="424242")])


ERROR_SCENARIOS = [
    pytest.param(_missing_file, id="AC-003.1-missing-file"),
    pytest.param(_missing_synonyms_column, id="AC-003.2-missing-column"),
    pytest.param(_protein_120_in_row_3, id="AC-003.3-protein-120"),
    pytest.param(_repeated_id, id="AC-003.4-repeated-id"),
    pytest.param(_repeated_name, id="AC-003.4-repeated-name"),
    pytest.param(_synonym_equal_to_another_name, id="AC-003.4-synonym-as-name"),
    pytest.param(_manual_without_reference, id="AC-003.7-manual-without-reference"),
    pytest.param(_usda_without_fdc_id, id="AC-003.7-usda-without-fdc-id"),
    pytest.param(_empty_value, id="AC-003.8-empty-value"),
    pytest.param(_different_value_than_usda, id="AC-003.5-different-value"),
    pytest.param(_unknown_fdc_id, id="AC-003.6-unknown-fdc-id"),
]


# SDD: 023 REQ-003 AC-003.1 AC-003.2 AC-003.3 AC-003.4 AC-003.5 AC-003.6 AC-003.7 AC-003.8
@pytest.mark.parametrize("scenario", ERROR_SCENARIOS)
def test_any_error_leaves_a_preloaded_catalog_untouched(env, scenario):
    """Con un catálogo ya cargado, cualquier error de archivo, fila, unicidad o
    USDA termina en `CatalogFileError`, sin confirmar nada y sin cambiar el
    catálogo (ni añadir, ni actualizar, ni quitar)."""
    env.load([rice(), manual(), chicken()])
    before = env.snapshot()
    commits_before = env.unit_of_work.commits

    with pytest.raises(CatalogFileError):
        scenario(env)

    assert env.snapshot() == before
    assert env.unit_of_work.commits == commits_before


# SDD: 023 REQ-003 AC-003.3
def test_an_error_does_not_load_the_valid_rows_either(env):
    """Dos filas válidas y una tercera con 120 de proteína: no se carga ninguna."""
    with pytest.raises(CatalogFileError):
        env.load([chicken(), rice(), banana(protein_g="120")])

    assert env.snapshot() == []


# SDD: 023 REQ-003 AC-003.1
def test_the_error_of_a_missing_file_names_the_file(env, tmp_path):
    """La ruta que no existe aparece en el mensaje."""
    path = tmp_path / "no-existe.csv"

    with pytest.raises(CatalogFileError) as exc_info:
        env.run_path(path)

    assert str(path) in str(exc_info.value)


# SDD: 023 REQ-003 AC-003.7
def test_an_error_while_writing_rolls_back_and_is_raised_again(db_session, tmp_path):
    """Si la escritura falla (aquí, un repositorio que lanza), se deshace y el
    error se vuelve a lanzar."""

    class WriteFailure(Exception):
        pass

    class BrokenRepository(CatalogFoodRepository):
        def create(self, instance):
            raise WriteFailure("fallo de prueba")

    uow = CountingUnitOfWork(db_session)
    service = CatalogLoadService(BrokenRepository(db_session), FoodRepository(db_session), uow)
    path = write_catalog_csv(tmp_path / "c.csv", [manual()])

    with pytest.raises(WriteFailure):
        service.run(path)

    assert uow.rollbacks == 1
    assert uow.commits == 0
    assert db_session.scalars(select(CatalogFood)).all() == []
