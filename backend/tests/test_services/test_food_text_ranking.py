"""Orden de los candidatos de texto (spec 021, REQ-006) contra el Postgres de
prueba: una descripción corta y exacta no debe perderse entre muchas
descripciones largas que solo mencionan la palabra."""

from models import Food
from repositories.food_repository import FoodRepository

TEXT_CANDIDATES = 40


def seed(db_session, *foods):
    for fdc_id, description in foods:
        db_session.add(Food(fdc_id=fdc_id, description=description, data_type="sr_legacy"))
    db_session.commit()


# SDD: 021 REQ-006 AC-006.10
def test_descripcion_corta_y_exacta_entra_en_los_candidatos_y_va_por_delante_de_las_largas(
    db_session,
):
    # Las largas tienen FDC ID menor: si solo empata el rango, ganarían ellas.
    long_ids = list(range(1, 51))
    foods = [
        (
            fdc_id,
            f"Babyfood, banana apple dessert, strained, variante {fdc_id}, "
            "con cereal y otros ingredientes añadidos",
        )
        for fdc_id in long_ids
    ]
    short_id = 173944
    foods.append((short_id, "Bananas, raw"))
    seed(db_session, *foods)

    result = FoodRepository(db_session).find_text_matches("banana", TEXT_CANDIDATES)

    assert len(result) == TEXT_CANDIDATES
    assert short_id in result
    assert result.index(short_id) < min(result.index(i) for i in long_ids if i in result)


# SDD: 021 REQ-006 AC-006.10
def test_descripcion_corta_va_primero_entre_pocas_largas(db_session):
    seed(
        db_session,
        (1, "Babyfood, banana no tapioca, strained"),
        (2, "Babyfood, banana apple dessert, strained"),
        (3, "Bananas, raw"),
    )

    result = FoodRepository(db_session).find_text_matches("banana", TEXT_CANDIDATES)

    assert result[0] == 3
    assert sorted(result) == [1, 2, 3]
