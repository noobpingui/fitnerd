"""Importación de alimentos de USDA (spec 021) con el repositorio y el
UnitOfWork reales sobre el Postgres de prueba y un cliente de embeddings de
mentira. Nada llama a Voyage.
"""

import pytest

from models import Food
from repositories.food_repository import FoodRepository
from services.food_import_service import (
    FoodImportService,
    ImportSummary,
    SourceSummary,
    UsdaSource,
    format_summary,
)
from services.usda_csv_reader import UsdaFileError
from tests.fakes import FakeFoodEmbeddingClient
from tests.usda_samples import (
    FOUNDATION_TYPE,
    SR_LEGACY_TYPE,
    macro_nutrients,
    write_usda_dataset,
)
from unit_of_work.unit_of_work import UnitOfWork


def make_service(db_session, embedding_client=None, batch_size=128):
    embedding_client = embedding_client or FakeFoodEmbeddingClient()
    service = FoodImportService(
        FoodRepository(db_session), UnitOfWork(db_session), embedding_client, batch_size=batch_size
    )
    return service, embedding_client


def foundation_dir(tmp_path, name="foundation", descriptions=None, protein_of_first=22.5):
    descriptions = descriptions or [
        "Chicken, breast, raw",
        "Rice, white, raw",
        "Egg, whole, raw",
    ]
    foods = [(1001 + index, FOUNDATION_TYPE, text) for index, text in enumerate(descriptions)]
    nutrients = []
    for index, (fdc_id, _, _) in enumerate(foods):
        protein = protein_of_first if index == 0 else 5.0 + index
        nutrients += macro_nutrients(fdc_id, kcal=100.0 + index, protein=protein, carbs=1.0 + index, fat=2.0)
    return write_usda_dataset(tmp_path / name, foods, nutrients)


def sr_legacy_dir(tmp_path, name="sr_legacy"):
    foods = [
        (2001, SR_LEGACY_TYPE, "Milk, whole, 3.25% milkfat"),
        (2002, SR_LEGACY_TYPE, "Bread, white"),
    ]
    nutrients = macro_nutrients(2001, kcal=61.0, protein=3.2, carbs=4.8, fat=3.3) + macro_nutrients(
        2002, kcal=266.0, protein=8.9, carbs=50.6, fat=3.3
    )
    return write_usda_dataset(tmp_path / name, foods, nutrients)


def foundation_source(directory):
    return UsdaSource("foundation", directory)


def sr_legacy_source(directory):
    return UsdaSource("sr_legacy", directory)


def stored(db_session, fdc_id):
    db_session.expire_all()
    return db_session.get(Food, fdc_id)


def count_foods(db_session):
    db_session.expire_all()
    return db_session.query(Food).count()


# SDD: 021 REQ-001 AC-001.1
def test_imports_foundation_foods_with_their_values_and_origin(db_session, tmp_path):
    """Los 3 alimentos de Foundation quedan guardados con FDC ID, descripción,
    origen `foundation` y los cuatro valores del archivo."""
    service, _ = make_service(db_session)

    service.run([foundation_source(foundation_dir(tmp_path))])

    assert count_foods(db_session) == 3
    chicken = stored(db_session, 1001)
    assert chicken.description == "Chicken, breast, raw"
    assert chicken.data_type == "foundation"
    assert (chicken.calories_kcal, chicken.protein_g, chicken.carbs_g, chicken.fat_g) == (
        100.0,
        22.5,
        1.0,
        2.0,
    )


# SDD: 021 REQ-001 AC-001.2
def test_imports_sr_legacy_foods_with_their_origin(db_session, tmp_path):
    """Los 2 alimentos de SR Legacy quedan guardados con el origen `sr_legacy`."""
    service, _ = make_service(db_session)

    service.run([sr_legacy_source(sr_legacy_dir(tmp_path))])

    assert count_foods(db_session) == 2
    milk = stored(db_session, 2001)
    assert milk.data_type == "sr_legacy"
    assert (milk.calories_kcal, milk.protein_g, milk.carbs_g, milk.fat_g) == (61.0, 3.2, 4.8, 3.3)


# SDD: 021 REQ-001 AC-001.4
def test_missing_nutrient_is_stored_as_null_not_zero(db_session, tmp_path):
    """Un alimento sin carbohidratos se guarda con `carbs_g` nulo, no 0."""
    directory = write_usda_dataset(
        tmp_path / "foundation",
        [(1, FOUNDATION_TYPE, "Food without carbs")],
        macro_nutrients(1, kcal=100.0, protein=10.0, fat=2.0),
    )
    service, _ = make_service(db_session)

    service.run([foundation_source(directory)])

    food = stored(db_session, 1)
    assert food.carbs_g is None
    assert food.protein_g == 10.0


# SDD: 021 REQ-005 AC-005.1
def test_summary_counts_added_foods_per_source(db_session, tmp_path):
    """Con base vacía, 3 de Foundation y 2 de SR Legacy: 3 y 2 añadidos y 0
    sin representación semántica en cada conjunto."""
    service, _ = make_service(db_session)

    summary = service.run(
        [foundation_source(foundation_dir(tmp_path)), sr_legacy_source(sr_legacy_dir(tmp_path))]
    )

    assert list(summary.sources) == ["foundation", "sr_legacy"]
    foundation = summary.sources["foundation"]
    legacy = summary.sources["sr_legacy"]
    assert (foundation.added, foundation.updated, foundation.unchanged, foundation.missing_embedding) == (
        3,
        0,
        0,
        0,
    )
    assert (legacy.added, legacy.updated, legacy.unchanged, legacy.missing_embedding) == (2, 0, 0, 0)
    assert summary.embedding_failed is False


# SDD: 021 REQ-002 AC-002.1
def test_reimporting_the_same_file_does_not_duplicate_foods(db_session, tmp_path):
    """Volver a importar el mismo archivo deja exactamente 3 alimentos con los
    mismos valores."""
    directory = foundation_dir(tmp_path)
    service, _ = make_service(db_session)
    service.run([foundation_source(directory)])

    service.run([foundation_source(directory)])

    assert count_foods(db_session) == 3
    assert stored(db_session, 1001).protein_g == 22.5


# SDD: 021 REQ-002 AC-002.2
def test_reimporting_updates_description_and_protein(db_session, tmp_path):
    """Si el mismo FDC ID trae otra descripción y otra proteína, el alimento
    queda con los valores nuevos."""
    service, _ = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path, name="v1"))])
    changed = foundation_dir(
        tmp_path,
        name="v2",
        descriptions=["Chicken, breast, cooked", "Rice, white, raw", "Egg, whole, raw"],
        protein_of_first=31.0,
    )

    service.run([foundation_source(changed)])

    assert count_foods(db_session) == 3
    chicken = stored(db_session, 1001)
    assert chicken.description == "Chicken, breast, cooked"
    assert chicken.protein_g == 31.0


# SDD: 021 REQ-002 AC-002.3
def test_foods_missing_from_a_new_file_are_kept(db_session, tmp_path):
    """Un archivo que ya no incluye un alimento no lo borra."""
    service, _ = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path, name="v1"))])
    smaller = foundation_dir(tmp_path, name="v2", descriptions=["Chicken, breast, raw"])

    service.run([foundation_source(smaller)])

    assert count_foods(db_session) == 3
    assert stored(db_session, 1002).description == "Rice, white, raw"


# SDD: 021 REQ-005 AC-005.2
def test_summary_counts_one_updated_and_two_unchanged_on_reimport(db_session, tmp_path):
    """Si cambia 1 de 3 alimentos: 0 añadidos, 1 actualizado y 2 sin cambios."""
    service, _ = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path, name="v1"))])
    changed = foundation_dir(tmp_path, name="v2", protein_of_first=30.0)

    summary = service.run([foundation_source(changed)])

    foundation = summary.sources["foundation"]
    assert (foundation.added, foundation.updated, foundation.unchanged) == (0, 1, 2)


# SDD: 021 REQ-003 AC-003.1
def test_new_foods_get_a_semantic_representation(db_session, tmp_path):
    """Los 3 alimentos nuevos quedan con representación semántica y se pidió
    una por cada descripción."""
    service, client = make_service(db_session)

    service.run([foundation_source(foundation_dir(tmp_path))])

    requested = [text for call in client.document_calls for text in call]
    assert sorted(requested) == sorted(["Chicken, breast, raw", "Rice, white, raw", "Egg, whole, raw"])
    for fdc_id in (1001, 1002, 1003):
        assert stored(db_session, fdc_id).embedding is not None


# SDD: 021 REQ-003 AC-003.1
def test_embeddings_are_requested_in_batches_of_the_given_size(db_session, tmp_path):
    """Con lotes de 2 y 3 alimentos nuevos se hacen 2 peticiones (2 y 1)."""
    service, client = make_service(db_session, batch_size=2)

    service.run([foundation_source(foundation_dir(tmp_path))])

    assert sorted(len(call) for call in client.document_calls) == [1, 2]
    assert count_foods(db_session) == 3


# SDD: 021 REQ-003 AC-003.2
def test_reimporting_the_same_file_requests_no_embeddings(db_session, tmp_path):
    """Si todos los alimentos ya tienen representación y no cambian, no se
    pide ninguna al proveedor."""
    directory = foundation_dir(tmp_path)
    service, client = make_service(db_session)
    service.run([foundation_source(directory)])
    client.document_calls.clear()

    service.run([foundation_source(directory)])

    assert client.document_calls == []


# SDD: 021 REQ-003 AC-003.3
def test_changed_description_requests_an_embedding_only_for_that_food(db_session, tmp_path):
    """Al cambiar la descripción de un alimento se pide una representación
    nueva solo para ese."""
    service, client = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path, name="v1"))])
    client.document_calls.clear()
    changed = foundation_dir(
        tmp_path,
        name="v2",
        descriptions=["Chicken, breast, cooked", "Rice, white, raw", "Egg, whole, raw"],
    )

    service.run([foundation_source(changed)])

    assert [text for call in client.document_calls for text in call] == ["Chicken, breast, cooked"]
    assert stored(db_session, 1001).embedding is not None


# SDD: 021 REQ-003 AC-003.3
def test_changing_only_a_nutrient_does_not_request_a_new_embedding(db_session, tmp_path):
    """Un cambio de proteína sin cambio de descripción no recalcula el vector."""
    service, client = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path, name="v1"))])
    client.document_calls.clear()

    service.run([foundation_source(foundation_dir(tmp_path, name="v2", protein_of_first=40.0))])

    assert client.document_calls == []
    assert stored(db_session, 1001).embedding is not None


# SDD: 021 REQ-004 AC-004.1
def test_missing_file_fails_naming_it_and_leaves_stored_foods_unchanged(db_session, tmp_path):
    """Una ruta inexistente termina con un error que nombra el archivo y los
    alimentos guardados no cambian."""
    service, _ = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path))])
    missing = tmp_path / "does-not-exist"

    with pytest.raises(UsdaFileError) as error:
        service.run([foundation_source(missing)])

    assert str(error.value) == f"No se encontró el archivo {missing / 'food.csv'}."
    assert count_foods(db_session) == 3
    assert stored(db_session, 1001).description == "Chicken, breast, raw"


# SDD: 021 REQ-004 AC-004.1
def test_a_failing_second_source_prevents_writing_the_first(db_session, tmp_path):
    """Los archivos de todas las fuentes se validan antes de escribir: si la
    segunda falla, la base queda vacía aunque la primera sea válida."""
    service, client = make_service(db_session)

    with pytest.raises(UsdaFileError):
        service.run(
            [foundation_source(foundation_dir(tmp_path)), sr_legacy_source(tmp_path / "does-not-exist")]
        )

    assert count_foods(db_session) == 0
    assert client.document_calls == []


# SDD: 021 REQ-004 AC-004.2
def test_missing_column_fails_naming_file_and_column_without_changes(db_session, tmp_path):
    """Un archivo sin columna obligatoria termina con un error que nombra
    archivo y columna; los alimentos guardados no cambian."""
    service, _ = make_service(db_session)
    service.run([foundation_source(foundation_dir(tmp_path))])
    broken = write_usda_dataset(
        tmp_path / "broken",
        [(1001, FOUNDATION_TYPE, "Changed")],
        [],
        food_columns=["fdc_id", "data_type"],
    )

    with pytest.raises(UsdaFileError) as error:
        service.run([foundation_source(broken)])

    assert "«description»" in str(error.value)
    assert str(broken / "food.csv") in str(error.value)
    assert stored(db_session, 1001).description == "Chicken, breast, raw"
    assert count_foods(db_session) == 3


# SDD: 021 REQ-004 AC-004.3
def test_provider_failure_keeps_foods_without_embeddings_and_reports_it(db_session, tmp_path):
    """Si el proveedor falla, los 3 alimentos quedan con sus nutrientes y sin
    representación semántica, y el resumen lo indica."""
    client = FakeFoodEmbeddingClient(raise_error=RuntimeError("voyage down"))
    service, _ = make_service(db_session, embedding_client=client)

    summary = service.run([foundation_source(foundation_dir(tmp_path))])

    assert count_foods(db_session) == 3
    chicken = stored(db_session, 1001)
    assert chicken.protein_g == 22.5
    assert chicken.embedding is None
    assert summary.embedding_failed is True
    foundation = summary.sources["foundation"]
    assert foundation.added == 3
    assert foundation.missing_embedding == 3


# SDD: 021 REQ-004 AC-004.4
def test_next_run_completes_the_pending_embeddings(db_session, tmp_path):
    """Con 3 alimentos sin representación y un proveedor que ya responde, la
    siguiente ejecución los deja todos con representación."""
    directory = foundation_dir(tmp_path)
    client = FakeFoodEmbeddingClient(raise_error=RuntimeError("voyage down"))
    service, _ = make_service(db_session, embedding_client=client)
    service.run([foundation_source(directory)])
    client.raise_error = None
    client.document_calls.clear()

    summary = service.run([foundation_source(directory)])

    for fdc_id in (1001, 1002, 1003):
        assert stored(db_session, fdc_id).embedding is not None
    assert len([text for call in client.document_calls for text in call]) == 3
    assert summary.embedding_failed is False
    assert summary.sources["foundation"].missing_embedding == 0
    assert summary.sources["foundation"].unchanged == 3


# SDD: 021 REQ-005 AC-005.1
def test_format_summary_prints_one_line_per_source_in_the_given_order():
    """Una línea por conjunto, en el orden recibido, con los cuatro contadores."""
    summary = ImportSummary(
        sources={
            "sr_legacy": SourceSummary(added=2, updated=0, unchanged=0, missing_embedding=0),
            "foundation": SourceSummary(added=3, updated=1, unchanged=4, missing_embedding=5),
        }
    )

    assert format_summary(summary).splitlines() == [
        "SR Legacy: 2 añadidos, 0 actualizados, 0 sin cambios, 0 sin representación semántica.",
        "Foundation: 3 añadidos, 1 actualizados, 4 sin cambios, 5 sin representación semántica.",
    ]


# SDD: 021 REQ-005 AC-005.2
def test_format_summary_adds_a_final_line_when_the_provider_failed():
    """Si el proveedor de embeddings falló, el resumen termina con el aviso."""
    summary = ImportSummary(
        sources={"foundation": SourceSummary(added=0, updated=1, unchanged=2, missing_embedding=0)},
        embedding_failed=True,
    )

    lines = format_summary(summary).splitlines()

    assert lines[0] == "Foundation: 0 añadidos, 1 actualizados, 2 sin cambios, 0 sin representación semántica."
    assert lines[-1] == (
        "El proveedor de embeddings falló: vuelve a ejecutar la importación para "
        "completar las representaciones semánticas pendientes."
    )
    assert len(lines) == 2


# SDD: 021 REQ-005 AC-005.1
def test_format_summary_has_no_failure_line_when_the_provider_worked():
    """Sin fallo del proveedor no hay línea final de aviso."""
    summary = ImportSummary(sources={"foundation": SourceSummary(added=3)})

    assert len(format_summary(summary).splitlines()) == 1
