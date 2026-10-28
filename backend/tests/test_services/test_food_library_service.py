"""Tests UNITARIOS de `FoodLibraryService` (spec 028): no tocan Postgres ni la
red. El servicio recibe por constructor fakes escritos a mano (catálogo,
alimentos propios, favoritos, comidas, usuario con bloqueo y `FakeUnitOfWork`).
Los mensajes se comparan con el texto literal de la sección 6 de la spec.
"""

from decimal import Decimal
from pathlib import Path

import pytest

from exceptions.custom_exceptions import ConflictError, ResourceNotFoundError, ValidationError
from services.catalog_csv_reader import read_catalog_csv
from services.catalog_search_service import (
    SearchCandidate,
    TypoSearchStats,
    typo_comparison_bound,
)
from services.food_library_rules import LibraryFood, RecentFoodRow
from services.food_library_service import FoodLibraryService
from tests.fakes import (
    FakeCatalogFoodRepository,
    FakeCustomFoodRepository,
    FakeFoodFavoriteRepository,
    FakeLockingUserRepository,
    FakeMealRepository,
    FakeUnitOfWork,
    make_catalog_food,
    make_custom_food,
    make_favorite,
)

USER = "user-1"
OTHER = "user-2"

EMPTY_QUERY = "Escribe qué alimento quieres buscar."
SHORT_QUERY = "La búsqueda debe tener al menos 2 caracteres."
LONG_QUERY = "La búsqueda no puede superar los 100 caracteres."
NOT_FOUND = "No encontramos ese alimento."
FAVORITES_LIMIT = "Ya tienes 100 favoritos. Quita alguno para añadir otro."

BANANA = make_catalog_food(
    "banano", "Banano", ["guineo"], calories_kcal=89.0, protein_g=1.09, carbs_g=22.84, fat_g=0.33
)
RICE = make_catalog_food(
    "arroz-blanco-cocido",
    "Arroz blanco cocido",
    calories_kcal=130.0,
    protein_g=2.69,
    carbs_g=28.17,
    fat_g=0.28,
)
OATS = make_catalog_food("avena-cocida", "Avena cocida", calories_kcal=71.0)
YOGURT = make_catalog_food("yogur-natural", "Yogur natural", calories_kcal=61.0)


def gallo(food_id=1, user_id=USER, name="Gallo pinto", **values):
    values = {"calories_kcal": 180.0, "protein_g": 6.0, "carbs_g": 30.0, "fat_g": 4.0, **values}
    return make_custom_food(food_id, user_id, name, **values)


class Env:
    """El servicio con todos sus dobles a la vista."""

    def __init__(
        self, catalog=None, customs=None, favorites=None, recent_rows=None, known_ids=None
    ):
        self.catalog = FakeCatalogFoodRepository(catalog if catalog is not None else [])
        self.customs = FakeCustomFoodRepository(customs)
        self.favorites = FakeFoodFavoriteRepository(favorites)
        self.meals = FakeMealRepository(recent_rows=recent_rows)
        self.users = FakeLockingUserRepository(known_ids)
        self.uow = FakeUnitOfWork()
        self.service = FoodLibraryService(
            self.catalog, self.customs, self.favorites, self.meals, self.users, self.uow
        )


def row(catalog_id=None, custom_food_id=None, grams="100"):
    return RecentFoodRow(
        catalog_id=catalog_id, custom_food_id=custom_food_id, grams=Decimal(grams)
    )


def identities(foods):
    return [(food.kind, food.id) for food in foods]


def names(foods):
    return [food.name for food in foods]


def expect_error(error_type, callable_, *args, **kwargs):
    with pytest.raises(error_type) as exc_info:
        callable_(*args, **kwargs)
    return str(exc_info.value)


# --------------------------------------------------------------------------
# search: catálogo y alimentos propios (REQ-007)
# --------------------------------------------------------------------------


# SDD: 028 REQ-007 AC-007.1
def test_search_returns_catalog_and_own_foods_with_their_kind_and_id():
    """`arroz` encuentra «Arroz blanco cocido» (catálogo) y el propio «Arroz con pollo de mamá»."""
    mamas = gallo(7, name="Arroz con pollo de mamá")
    env = Env(catalog=[RICE, BANANA], customs=[mamas])

    results = env.service.search(USER, "arroz")

    assert identities(results) == [("catalog", "arroz-blanco-cocido"), ("custom", 7)]
    assert all(isinstance(food, LibraryFood) for food in results)


# SDD: 028 REQ-007 AC-007.1
def test_search_returns_the_name_and_the_four_values_per_100g_as_floats():
    """El resultado lleva el nombre y `per_100g` con los cuatro valores."""
    env = Env(catalog=[RICE], customs=[gallo(3, name="Arroz casero", calories_kcal=150.0)])

    catalog_food, own_food = env.service.search(USER, "arroz")

    assert catalog_food.name == "Arroz blanco cocido"
    assert catalog_food.per_100g == {
        "calories_kcal": 130.0,
        "protein_g": 2.69,
        "carbs_g": 28.17,
        "fat_g": 0.28,
    }
    assert own_food.per_100g == {
        "calories_kcal": 150.0,
        "protein_g": 6.0,
        "carbs_g": 30.0,
        "fat_g": 4.0,
    }
    assert own_food.last_grams is None


# SDD: 028 REQ-007 AC-007.2
def test_search_never_returns_the_own_foods_of_another_user():
    """El «Gallo pinto» del usuario B no aparece en la búsqueda del usuario A."""
    env = Env(customs=[gallo(1, user_id=OTHER)])

    assert env.service.search(USER, "gallo") == []
    assert identities(env.service.search(OTHER, "gallo")) == [("custom", 1)]


# SDD: 028 REQ-007 AC-007.3
def test_search_puts_the_catalog_food_first_when_an_own_food_has_the_same_name():
    """Un propio llamado igual que uno del catálogo: aparecen los dos, el del catálogo primero."""
    twin = gallo(4, name="Arroz blanco cocido")
    env = Env(catalog=[RICE], customs=[twin])

    results = env.service.search(USER, "arroz blanco cocido")

    assert identities(results) == [("catalog", "arroz-blanco-cocido"), ("custom", 4)]


# SDD: 028 REQ-007 AC-007.4
def test_search_marks_the_favorites_of_the_user_only():
    """Un favorito del catálogo y uno propio llevan `favorite: True`; los demás, False."""
    env = Env(
        catalog=[RICE, make_catalog_food("arroz-integral", "Arroz integral")],
        customs=[gallo(2, name="Arroz del campo"), gallo(3, name="Arroz de la casa")],
        favorites=[
            make_favorite(USER, catalog_id="arroz-blanco-cocido"),
            make_favorite(USER, custom_food_id=2),
            make_favorite(OTHER, catalog_id="arroz-integral"),
            make_favorite(OTHER, custom_food_id=3),
        ],
    )

    results = env.service.search(USER, "arroz")

    assert {(food.kind, food.id): food.favorite for food in results} == {
        ("catalog", "arroz-blanco-cocido"): True,
        ("catalog", "arroz-integral"): False,
        ("custom", 2): True,
        ("custom", 3): False,
    }


# SDD: 028 REQ-007 AC-007.5
def test_search_returns_at_most_20_foods_from_both_origins():
    """15 del catálogo y 10 propios que coinciden: la respuesta tiene exactamente 20."""
    catalog = [make_catalog_food(f"arroz-{n:02d}", f"Arroz {n:02d}") for n in range(15)]
    customs = [gallo(n + 1, name=f"Arroz propio {n:02d}") for n in range(10)]
    env = Env(catalog=catalog, customs=customs)

    assert len(env.service.search(USER, "arroz")) == 20


# SDD: 028 REQ-007 AC-007.6
@pytest.mark.parametrize(
    "query, message",
    [(None, EMPTY_QUERY), ("", EMPTY_QUERY), ("   ", EMPTY_QUERY), ("a", SHORT_QUERY),
     (" a ", SHORT_QUERY), ("a" * 101, LONG_QUERY)],
)
def test_search_rejects_an_invalid_query_before_reading_anything(query, message):
    """Falta, muy corta o de 101 caracteres: los mensajes de la 023 y sin leer datos."""
    env = Env(catalog=[BANANA], customs=[gallo()])

    assert expect_error(ValidationError, env.service.search, USER, query) == message
    assert env.catalog.list_calls == []


# SDD: 028 REQ-007 AC-007.6
def test_search_accepts_a_query_of_exactly_100_characters():
    """100 caracteres es válido: se busca y no hay resultados."""
    env = Env(catalog=[BANANA])

    assert env.service.search(USER, "a" * 100) == []


# SDD: 028 REQ-007 AC-007.7
def test_search_tolerates_typos_in_the_own_foods():
    """`galo pinto` encuentra el alimento propio «Gallo pinto»."""
    env = Env(customs=[gallo(9)])

    assert identities(env.service.search(USER, "galo pinto")) == [("custom", 9)]


# SDD: 028 REQ-006 AC-006.2
def test_search_tolerates_typos_in_the_catalog():
    """`aroz` encuentra «Arroz blanco cocido» del catálogo."""
    env = Env(catalog=[RICE, BANANA])

    assert names(env.service.search(USER, "aroz")) == ["Arroz blanco cocido"]


# SDD: 028 REQ-007 AC-007.1
def test_search_finds_a_catalog_food_by_synonym_next_to_own_foods():
    """El sinónimo `guineo` encuentra el «Banano» del catálogo y no el propio
    «Gallo pinto» (los propios no tienen sinónimos)."""
    env = Env(catalog=[BANANA], customs=[gallo(5, name="Gallo pinto")])

    assert identities(env.service.search(USER, "guineo")) == [("catalog", "banano")]


# SDD: 028 REQ-007 AC-007.1
def test_search_does_not_write_or_lock_anything():
    """Buscar solo lee: ni commit, ni rollback, ni bloqueo de la fila del usuario."""
    env = Env(catalog=[BANANA])

    env.service.search(USER, "banano")

    assert env.uow.committed is False and env.uow.rolled_back is False
    assert env.users.for_update_calls == []


# SDD: 028 NFR-001 AC-N001.1
def test_search_recent_and_favorites_work_with_only_database_data():
    """Con fakes de repositorio, sin ningún otro servicio, las tres lecturas responden."""
    env = Env(
        catalog=[BANANA],
        customs=[gallo(1)],
        favorites=[make_favorite(USER, catalog_id="banano")],
        recent_rows=[row(catalog_id="banano", grams="150")],
    )

    assert names(env.service.search(USER, "banano")) == ["Banano"]
    assert names(env.service.recent(USER)) == ["Banano"]
    assert names(env.service.favorites(USER)) == ["Banano"]


# --------------------------------------------------------------------------
# recent (REQ-008)
# --------------------------------------------------------------------------


# SDD: 028 REQ-008 AC-008.1
def test_recent_keeps_the_order_of_the_rows_and_gives_the_last_grams():
    """«Banano» (150 g) primero y «Gallo pinto» propio (200 g) después,
    cada uno con su `last_grams`."""
    env = Env(
        catalog=[BANANA],
        customs=[gallo(8)],
        recent_rows=[row(catalog_id="banano", grams="150"), row(custom_food_id=8, grams="200")],
    )

    results = env.service.recent(USER)

    assert identities(results) == [("catalog", "banano"), ("custom", 8)]
    assert [food.last_grams for food in results] == [Decimal("150"), Decimal("200")]


# SDD: 028 REQ-008 AC-008.2
def test_recent_asks_the_repository_for_the_10_most_recent_foods():
    """Pide `list_recent_foods(user_id, 10)`; con 12 filas devuelve solo 10."""
    catalog = [make_catalog_food(f"fruta-{n:02d}", f"Fruta {n:02d}") for n in range(12)]
    rows = [row(catalog_id=f"fruta-{n:02d}") for n in range(12)]
    env = Env(catalog=catalog, recent_rows=rows)

    results = env.service.recent(USER)

    assert env.meals.recent_calls == [(USER, 10)]
    assert len(results) == 10


# SDD: 028 REQ-008 AC-008.4
def test_recent_skips_a_catalog_food_that_is_no_longer_in_the_catalog():
    """Un alimento del catálogo que una carga quitó no aparece; los demás sí."""
    env = Env(catalog=[BANANA], recent_rows=[row(catalog_id="quitado"), row(catalog_id="banano")])

    assert identities(env.service.recent(USER)) == [("catalog", "banano")]


# SDD: 028 REQ-008 AC-008.4
def test_recent_skips_an_own_food_that_was_deleted_from_the_library():
    """Un propio borrado (ya no está en la biblioteca) no aparece."""
    env = Env(customs=[gallo(8)], recent_rows=[row(custom_food_id=99), row(custom_food_id=8)])

    assert identities(env.service.recent(USER)) == [("custom", 8)]


# SDD: 028 REQ-008 AC-008.6
def test_recent_of_a_user_without_rows_is_empty():
    """Sin comidas, lista vacía."""
    assert Env(catalog=[BANANA]).service.recent(USER) == []


# SDD: 028 REQ-008 AC-008.7
def test_recent_never_returns_an_own_food_of_another_user():
    """Una fila con el `custom_food_id` de otro usuario no devuelve su alimento."""
    env = Env(customs=[gallo(8, user_id=OTHER)], recent_rows=[row(custom_food_id=8)])

    assert env.service.recent(USER) == []


# SDD: 028 REQ-008 AC-008.8
def test_recent_gives_the_current_values_of_an_own_food():
    """Si el alimento propio se actualizó, aparece con los valores actuales."""
    own = gallo(8, calories_kcal=180.0)
    env = Env(customs=[own], recent_rows=[row(custom_food_id=8, grams="200")])
    own.calories_kcal = 170.0
    own.name = "gallo PINTO"

    (result,) = env.service.recent(USER)

    assert result.name == "gallo PINTO"
    assert result.per_100g["calories_kcal"] == 170.0


# SDD: 028 REQ-008 AC-008.1
def test_recent_gives_the_current_values_of_a_catalog_food_and_its_favorite_flag():
    """Los valores del catálogo son los actuales y `favorite` refleja los favoritos del usuario."""
    env = Env(
        catalog=[BANANA, RICE],
        favorites=[make_favorite(USER, catalog_id="banano")],
        recent_rows=[
            row(catalog_id="banano", grams="120.5"),
            row(catalog_id="arroz-blanco-cocido"),
        ],
    )

    banana, rice = env.service.recent(USER)

    assert banana.per_100g["calories_kcal"] == 89.0
    assert banana.last_grams == Decimal("120.5")
    assert (banana.favorite, rice.favorite) == (True, False)


# SDD: 028 REQ-008 AC-008.1
def test_recent_does_not_write_or_lock_anything():
    """Leer los recientes no hace commit ni bloquea al usuario."""
    env = Env(catalog=[BANANA], recent_rows=[row(catalog_id="banano")])

    env.service.recent(USER)

    assert env.uow.committed is False
    assert env.users.for_update_calls == []


# --------------------------------------------------------------------------
# favorites (REQ-010)
# --------------------------------------------------------------------------


# SDD: 028 REQ-010 AC-010.1
def test_favorites_are_ordered_by_name_with_kind_and_favorite_true():
    """«Avena cocida», «Gallo pinto» y «Yogur natural», en ese orden."""
    env = Env(
        catalog=[YOGURT, OATS],
        customs=[gallo(2)],
        favorites=[
            make_favorite(USER, catalog_id="yogur-natural"),
            make_favorite(USER, custom_food_id=2),
            make_favorite(USER, catalog_id="avena-cocida"),
        ],
    )

    results = env.service.favorites(USER)

    assert names(results) == ["Avena cocida", "Gallo pinto", "Yogur natural"]
    assert [food.kind for food in results] == ["catalog", "custom", "catalog"]
    assert all(food.favorite is True for food in results)


# SDD: 028 REQ-010 AC-010.1
def test_favorites_order_ignores_case_and_accents():
    """El orden por nombre no distingue mayúsculas ni tildes."""
    env = Env(
        catalog=[make_catalog_food("name", "Ñame"), make_catalog_food("acido", "Ácido cítrico")],
        customs=[gallo(1, name="arroz casero")],
        favorites=[
            make_favorite(USER, catalog_id="name"),
            make_favorite(USER, custom_food_id=1),
            make_favorite(USER, catalog_id="acido"),
        ],
    )

    assert names(env.service.favorites(USER)) == ["Ácido cítrico", "arroz casero", "Ñame"]


# SDD: 028 REQ-010 AC-010.1
def test_favorites_give_the_current_values():
    """Los favoritos llevan los valores actuales del alimento."""
    env = Env(catalog=[BANANA], favorites=[make_favorite(USER, catalog_id="banano")])

    (result,) = env.service.favorites(USER)

    assert result.per_100g["calories_kcal"] == 89.0
    assert result.last_grams is None


# SDD: 028 REQ-010 AC-010.2
def test_favorites_omit_a_catalog_food_that_is_no_longer_in_the_catalog_and_bring_it_back():
    """Un favorito quitado del catálogo no aparece y vuelve a aparecer
    si el catálogo lo recupera."""
    env = Env(catalog=[OATS], favorites=[make_favorite(USER, catalog_id="yogur-natural")])
    assert env.service.favorites(USER) == []

    env.catalog.foods.append(YOGURT)

    assert names(env.service.favorites(USER)) == ["Yogur natural"]


# SDD: 028 REQ-010 AC-010.3
def test_favorites_of_a_user_without_any_are_empty():
    """Sin favoritos, lista vacía."""
    assert Env(catalog=[BANANA]).service.favorites(USER) == []


# SDD: 028 REQ-009 AC-009.5
def test_favorites_do_not_include_the_ones_of_another_user():
    """Si A marca «Banano», el usuario B no lo ve en sus favoritos."""
    env = Env(catalog=[BANANA], favorites=[make_favorite(USER, catalog_id="banano")])

    assert env.service.favorites(OTHER) == []


# --------------------------------------------------------------------------
# add_favorite / remove_favorite (REQ-009)
# --------------------------------------------------------------------------


# SDD: 028 REQ-009 AC-009.1
def test_add_favorite_of_a_catalog_food_saves_it_and_commits():
    """Marcar «banano»: queda un favorito con ese `catalog_id`, se confirma
    y se bloquea al usuario."""
    env = Env(catalog=[BANANA])

    env.service.add_favorite(USER, "catalog", "banano")

    (favorite,) = env.favorites.created
    assert (str(favorite.user_id), favorite.catalog_id, favorite.custom_food_id) == (
        USER,
        "banano",
        None,
    )
    assert env.uow.committed is True
    assert env.users.for_update_calls == [USER]


# SDD: 028 REQ-009 AC-009.1
def test_add_favorite_of_an_own_food_saves_it_with_its_custom_food_id():
    """Marcar un propio guarda `custom_food_id` y deja `catalog_id` vacío."""
    env = Env(customs=[gallo(4)])

    env.service.add_favorite(USER, "custom", 4)

    (favorite,) = env.favorites.created
    assert (favorite.catalog_id, favorite.custom_food_id) == (None, 4)


# SDD: 028 REQ-009 AC-009.1
def test_add_favorite_accepts_the_own_food_id_as_text():
    """Los parámetros de ruta llegan como texto: `"4"` vale como 4."""
    env = Env(customs=[gallo(4)])

    env.service.add_favorite(USER, "custom", "4")

    assert [f.custom_food_id for f in env.favorites.created] == [4]


# SDD: 028 REQ-009 AC-009.1
def test_add_favorite_twice_does_not_duplicate_it():
    """Marcar dos veces el mismo alimento deja un solo favorito y no falla."""
    env = Env(catalog=[BANANA])

    env.service.add_favorite(USER, "catalog", "banano")
    env.service.add_favorite(USER, "catalog", "banano")

    assert len(env.favorites.favorites) == 1
    assert len(env.favorites.created) == 1


# SDD: 028 REQ-009 AC-009.3
@pytest.mark.parametrize("kind, food_id", [("catalog", "no-existe"), ("catalog", "Banano!"),
                                            ("catalog", ""), ("catalog", 5), ("catalog", None)])
def test_add_favorite_of_a_missing_or_invalid_catalog_food_is_not_found(kind, food_id):
    """Un `catalog_id` que no existe en el catálogo da el 404 de la spec y no guarda nada."""
    env = Env(catalog=[BANANA])

    message = expect_error(ResourceNotFoundError, env.service.add_favorite, USER, kind, food_id)

    assert message == NOT_FOUND
    assert env.favorites.created == []
    assert env.uow.committed is False


# SDD: 028 REQ-009 AC-009.3
@pytest.mark.parametrize("food_id", [99, "99", "abc", 0, "0", 2_147_483_648, None])
def test_add_favorite_of_a_missing_or_invalid_own_food_is_not_found(food_id):
    """Un `custom_food_id` que no existe o no es válido da 404."""
    env = Env(customs=[gallo(4)])

    message = expect_error(
        ResourceNotFoundError, env.service.add_favorite, USER, "custom", food_id
    )

    assert message == NOT_FOUND
    assert env.favorites.created == []


# SDD: 028 REQ-009 AC-009.3
def test_add_favorite_of_an_own_food_of_another_user_is_not_found():
    """El alimento propio de B no se puede marcar desde la cuenta de A."""
    env = Env(customs=[gallo(4, user_id=OTHER)])

    message = expect_error(ResourceNotFoundError, env.service.add_favorite, USER, "custom", 4)

    assert message == NOT_FOUND
    assert env.favorites.created == []


# SDD: 028 REQ-009 AC-009.3
@pytest.mark.parametrize("kind", ["foods", "", "CATALOG", None])
def test_add_and_remove_favorite_with_an_unknown_kind_is_not_found(kind):
    """Un tipo distinto de `catalog` y `custom` da 404."""
    env = Env(catalog=[BANANA])

    add_message = expect_error(
        ResourceNotFoundError, env.service.add_favorite, USER, kind, "banano"
    )
    remove_message = expect_error(
        ResourceNotFoundError, env.service.remove_favorite, USER, kind, "banano"
    )

    assert add_message == remove_message == NOT_FOUND
    assert env.favorites.created == []


def hundred_favorites():
    return [make_favorite(USER, catalog_id=f"fruta-{n:03d}") for n in range(100)]


def hundred_fruits():
    """Las 100 frutas de `hundred_favorites()` en el catálogo: desde AC-009.6 los
    favoritos cuyo alimento ya no está en el catálogo no cuentan para el límite."""
    return [make_catalog_food(f"fruta-{n:03d}", f"Fruta {n:03d}") for n in range(100)]


# SDD: 028 REQ-009 AC-009.4
def test_add_favorite_with_100_favorites_is_rejected_with_the_limit_message():
    """Con 100 favoritos, marcar uno nuevo da el 400 de la spec y no guarda nada."""
    env = Env(catalog=[BANANA, *hundred_fruits()], favorites=hundred_favorites())

    message = expect_error(ValidationError, env.service.add_favorite, USER, "catalog", "banano")

    assert message == FAVORITES_LIMIT
    assert len(env.favorites.favorites) == 100
    assert env.uow.committed is False


# SDD: 028 REQ-009 AC-009.4
def test_add_favorite_that_already_is_a_favorite_works_with_100_favorites():
    """Con 100 favoritos, volver a marcar uno que ya lo es no falla ni lo duplica."""
    env = Env(catalog=hundred_fruits(), favorites=hundred_favorites())

    env.service.add_favorite(USER, "catalog", "fruta-000")

    assert len(env.favorites.favorites) == 100


# SDD: 028 REQ-009 AC-009.4
def test_the_favorites_limit_counts_only_the_favorites_of_the_user():
    """Los 100 favoritos de otro usuario no impiden marcar el primero de este."""
    others = [make_favorite(OTHER, catalog_id=f"fruta-{n:03d}") for n in range(100)]
    env = Env(catalog=[BANANA], favorites=others)

    env.service.add_favorite(USER, "catalog", "banano")

    assert len(env.favorites.created) == 1


# SDD: 028 REQ-009 AC-009.2
def test_remove_favorite_deletes_it_and_commits():
    """Quitar «banano» borra el favorito, confirma y bloquea al usuario."""
    env = Env(catalog=[BANANA], favorites=[make_favorite(USER, catalog_id="banano")])

    env.service.remove_favorite(USER, "catalog", "banano")

    assert env.favorites.favorites == []
    assert len(env.favorites.deleted) == 1
    assert env.uow.committed is True
    assert env.users.for_update_calls == [USER]


# SDD: 028 REQ-009 AC-009.2
def test_remove_favorite_twice_does_not_fail():
    """Quitar dos veces es idempotente: la segunda no encuentra el favorito y responde igual."""
    env = Env(catalog=[BANANA], favorites=[make_favorite(USER, catalog_id="banano")])

    env.service.remove_favorite(USER, "catalog", "banano")
    env.service.remove_favorite(USER, "catalog", "banano")

    assert env.favorites.favorites == []
    assert len(env.favorites.deleted) == 1


# SDD: 028 REQ-009 AC-009.2
def test_remove_favorite_of_an_own_food_deletes_it():
    """Quitar el favorito de un propio borra solo ese favorito."""
    env = Env(
        customs=[gallo(4), gallo(5, name="Avena casera")],
        favorites=[make_favorite(USER, custom_food_id=4), make_favorite(USER, custom_food_id=5)],
    )

    env.service.remove_favorite(USER, "custom", 4)

    assert [f.custom_food_id for f in env.favorites.favorites] == [5]


# SDD: 028 REQ-009 AC-009.2
def test_remove_favorite_of_a_food_that_was_not_a_favorite_works():
    """Quitar un alimento que existe y no era favorito responde bien y no borra nada."""
    env = Env(catalog=[BANANA])

    env.service.remove_favorite(USER, "catalog", "banano")

    assert env.favorites.deleted == []


# SDD: 028 REQ-009 AC-009.3
def test_remove_favorite_of_a_missing_food_is_not_found():
    """Un alimento que no existe da 404 también al quitar."""
    env = Env(catalog=[BANANA], customs=[gallo(4, user_id=OTHER)])

    catalog_message = expect_error(
        ResourceNotFoundError, env.service.remove_favorite, USER, "catalog", "no-existe"
    )
    custom_message = expect_error(
        ResourceNotFoundError, env.service.remove_favorite, USER, "custom", 4
    )
    invalid_message = expect_error(
        ResourceNotFoundError, env.service.remove_favorite, USER, "custom", "abc"
    )

    assert catalog_message == custom_message == invalid_message == NOT_FOUND


# --------------------------------------------------------------------------
# delete_custom_food (REQ-004)
# --------------------------------------------------------------------------


# SDD: 028 REQ-004 AC-004.1
def test_delete_custom_food_removes_it_and_commits_after_locking_the_user():
    """Borrar un propio lo quita de la biblioteca, confirma y bloquea la fila del usuario."""
    own = gallo(4)
    env = Env(customs=[own, gallo(5, name="Avena casera")])

    env.service.delete_custom_food(USER, 4)

    assert env.customs.deleted == [own]
    assert [food.id for food in env.customs.foods] == [5]
    assert env.uow.committed is True
    assert env.users.for_update_calls == [USER]


# SDD: 028 REQ-004 AC-004.3
def test_delete_custom_food_accepts_the_id_as_text():
    """Los parámetros de ruta llegan como texto."""
    env = Env(customs=[gallo(4)])

    env.service.delete_custom_food(USER, "4")

    assert env.customs.foods == []


# SDD: 028 REQ-004 AC-004.2
def test_delete_custom_food_of_another_user_is_not_found_and_unchanged():
    """El alimento de B no se borra desde la cuenta de A."""
    other = gallo(4, user_id=OTHER)
    env = Env(customs=[other])

    message = expect_error(ResourceNotFoundError, env.service.delete_custom_food, USER, 4)

    assert message == NOT_FOUND
    assert env.customs.foods == [other]
    assert env.customs.deleted == []
    assert env.uow.committed is False


# SDD: 028 REQ-004 AC-004.3
@pytest.mark.parametrize("food_id", [99, "99", "abc", "", 0, -3, 2_147_483_648, None, 1.5])
def test_delete_custom_food_that_does_not_exist_or_is_not_valid_is_not_found(food_id):
    """Un identificador que no existe, `abc` o fuera de rango da 404 con el mensaje de la spec."""
    env = Env(customs=[gallo(4)])

    message = expect_error(ResourceNotFoundError, env.service.delete_custom_food, USER, food_id)

    assert message == NOT_FOUND
    assert len(env.customs.foods) == 1


# --------------------------------------------------------------------------
# update_custom_food (spec 029, REQ-001 a REQ-004)
# --------------------------------------------------------------------------

NAME_REQUIRED = "Escribe el nombre del alimento."
INVALID_REQUEST = "La petición no es válida"
NAME_TAKEN = "Ya tienes un alimento con ese nombre."


def edit_body(name="Gallo pinto con huevo", **values):
    """Cuerpo de edición válido; `values` sustituye a los valores por 100 g."""
    per_100g = {"calories_kcal": 200, "protein_g": 9, "carbs_g": 28, "fat_g": 6, **values}
    return {"name": name, "per_100g": per_100g}


def values_of(food):
    return (food.name, food.calories_kcal, food.protein_g, food.carbs_g, food.fat_g)


class OrderedLockingUsers(FakeLockingUserRepository):
    """Anota en una lista compartida el momento del bloqueo de la fila del usuario."""

    def __init__(self, log):
        super().__init__()
        self.log = log

    def get_by_id_for_update(self, user_id):
        self.log.append("lock")
        return super().get_by_id_for_update(user_id)


class OrderedCustomFoods(FakeCustomFoodRepository):
    """Anota en la lista compartida cada lectura del alimento."""

    def __init__(self, log, foods):
        super().__init__(foods)
        self.log = log

    def get_by_id_and_user(self, custom_food_id, user_id):
        self.log.append("read")
        return super().get_by_id_and_user(custom_food_id, user_id)


# SDD: 029 REQ-001 AC-001.1
def test_update_custom_food_replaces_name_and_values_and_keeps_the_id():
    """Edita nombre (recortado) y los cuatro valores en su sitio, sin cambiar el id."""
    own = gallo(12)
    env = Env(customs=[own], favorites=[make_favorite(USER, custom_food_id=12)])

    result = env.service.update_custom_food(USER, 12, edit_body(name="  Gallo pinto con huevo "))

    assert result == LibraryFood(
        kind="custom",
        id=12,
        name="Gallo pinto con huevo",
        per_100g={"calories_kcal": 200.0, "protein_g": 9.0, "carbs_g": 28.0, "fat_g": 6.0},
        favorite=True,
        last_grams=None,
    )
    assert values_of(own) == ("Gallo pinto con huevo", 200.0, 9.0, 28.0, 6.0)
    assert own.id == 12
    assert env.customs.created == []
    assert env.uow.committed is True


# SDD: 029 REQ-001 AC-001.1
def test_update_custom_food_updates_the_name_key_used_to_find_duplicates():
    """Tras renombrar, la clave de nombre es la del nombre nuevo."""
    own = gallo(12)
    env = Env(customs=[own])

    env.service.update_custom_food(USER, 12, edit_body(name="Pinto  ÁGIL"))

    assert own.name_key == "pinto agil"


# SDD: 029 REQ-001 AC-001.1
def test_update_custom_food_accepts_the_id_as_text():
    """El parámetro de ruta llega como texto."""
    env = Env(customs=[gallo(12)])

    result = env.service.update_custom_food(USER, "12", edit_body())

    assert result.id == 12


# SDD: 029 REQ-001 AC-001.1
def test_update_custom_food_keeps_the_favorite_without_touching_favorites():
    """El favorito sigue siendo el mismo: no se crea ni se borra ninguno."""
    favorite = make_favorite(USER, custom_food_id=12)
    env = Env(customs=[gallo(12)], favorites=[favorite])

    env.service.update_custom_food(USER, 12, edit_body())

    assert env.favorites.favorites == [favorite]
    assert env.favorites.created == [] and env.favorites.deleted == []


# SDD: 029 REQ-001 AC-001.6
def test_update_custom_food_of_a_non_favorite_answers_favorite_false():
    """Sin favorito: `favorite: False` y no se crea ninguno."""
    env = Env(customs=[gallo(12)], favorites=[make_favorite(USER, custom_food_id=99)])

    result = env.service.update_custom_food(USER, 12, edit_body())

    assert result.favorite is False
    assert env.favorites.created == []


# SDD: 029 REQ-001 AC-001.3
def test_update_custom_food_allows_changing_only_the_case_of_its_own_name():
    """«gallo PINTO» sobre «Gallo pinto» no es un nombre repetido."""
    own = gallo(12)
    env = Env(customs=[own])

    result = env.service.update_custom_food(
        USER, 12, edit_body(name="gallo PINTO", calories_kcal=180, protein_g=6, carbs_g=30, fat_g=4)
    )

    assert result.name == "gallo PINTO"
    assert own.name == "gallo PINTO"
    assert env.uow.committed is True


# SDD: 029 REQ-001 AC-001.4
def test_update_custom_food_with_the_same_name_and_values_succeeds_unchanged():
    """Mismos nombre y valores: 200 con el alimento tal cual."""
    own = gallo(12)
    env = Env(customs=[own])
    before = values_of(own)

    result = env.service.update_custom_food(
        USER, 12, edit_body(name="Gallo pinto", calories_kcal=180, protein_g=6, carbs_g=30, fat_g=4)
    )

    assert values_of(own) == before
    assert result.name == "Gallo pinto" and result.per_100g["calories_kcal"] == 180.0


# SDD: 029 REQ-001 AC-001.5
def test_update_custom_food_may_take_the_name_of_a_catalog_food():
    """Los nombres del catálogo no cuentan como repetidos."""
    own = gallo(12, name="Arroz de la casa")
    env = Env(catalog=[RICE], customs=[own])

    result = env.service.update_custom_food(USER, 12, edit_body(name="Arroz blanco cocido"))

    assert result.name == "Arroz blanco cocido"
    assert env.uow.committed is True


# SDD: 029 REQ-001 AC-001.1
def test_update_custom_food_locks_the_user_row_before_reading_the_food():
    """El bloqueo de la fila del usuario (ADR-0020) va antes de leer el alimento."""
    log = []
    users = OrderedLockingUsers(log)
    customs = OrderedCustomFoods(log, [gallo(12)])
    env = Env()
    env.users = users
    env.customs = customs
    service = FoodLibraryService(
        env.catalog, customs, env.favorites, env.meals, users, env.uow
    )

    service.update_custom_food(USER, 12, edit_body())

    assert log[:2] == ["lock", "read"]
    assert users.for_update_calls == [USER]


# SDD: 029 REQ-002 AC-002.1
@pytest.mark.parametrize("body", ["hola", None, [], [edit_body()], 5])
def test_update_custom_food_rejects_a_body_that_is_not_an_object(body):
    """Texto, `None`, lista o número: 400 «La petición no es válida» y nada cambia."""
    own = gallo(12)
    env = Env(customs=[own])

    message = expect_error(ValidationError, env.service.update_custom_food, USER, 12, body)

    assert message == INVALID_REQUEST
    assert values_of(own) == ("Gallo pinto", 180.0, 6.0, 30.0, 4.0)
    assert env.uow.committed is False


# SDD: 029 REQ-002 AC-002.1
def test_update_custom_food_reports_an_invalid_field_with_the_022_message_and_changes_nothing():
    """Un campo no válido da el mensaje de la 022 y no se modifica ni se confirma nada."""
    own = gallo(12)
    env = Env(customs=[own])

    message = expect_error(
        ValidationError, env.service.update_custom_food, USER, 12, edit_body(name="  ")
    )

    assert message == NAME_REQUIRED
    assert values_of(own) == ("Gallo pinto", 180.0, 6.0, 30.0, 4.0)
    assert env.uow.committed is False


# SDD: 029 REQ-003 AC-003.1
def test_update_custom_food_with_the_name_of_another_own_food_is_a_conflict():
    """«  ARROZ con   pollo de mama » choca con «Arroz con pollo de mamá» (otra mayúscula,
    tilde y espacios repetidos): 409, rollback y ningún alimento cambia."""
    own = gallo(12)
    other = gallo(13, name="Arroz con pollo de mamá", calories_kcal=150.0)
    env = Env(customs=[own, other])

    message = expect_error(
        ConflictError,
        env.service.update_custom_food,
        USER,
        12,
        edit_body(name="  ARROZ con   pollo de mama "),
    )

    assert message == NAME_TAKEN
    assert values_of(own) == ("Gallo pinto", 180.0, 6.0, 30.0, 4.0)
    assert values_of(other) == ("Arroz con pollo de mamá", 150.0, 6.0, 30.0, 4.0)
    assert env.uow.rolled_back is True
    assert env.uow.committed is False


# SDD: 029 REQ-003 AC-003.2
def test_update_custom_food_may_take_a_name_that_only_another_user_has():
    """Los nombres de otros usuarios no cuentan."""
    own = gallo(12)
    env = Env(customs=[own, gallo(13, user_id=OTHER, name="Arroz con pollo de mamá")])

    result = env.service.update_custom_food(USER, 12, edit_body(name="Arroz con pollo de mamá"))

    assert result.name == "Arroz con pollo de mamá"
    assert env.uow.committed is True


# SDD: 029 REQ-004 AC-004.2
@pytest.mark.parametrize("food_id", ["abc", "0", "2147483648", "", None, 1.5, -3])
def test_update_custom_food_with_an_invalid_id_is_not_found(food_id):
    """Un identificador que no es un entero entre 1 y 2.147.483.647: 404 y nada cambia."""
    own = gallo(12)
    env = Env(customs=[own])

    message = expect_error(
        ResourceNotFoundError, env.service.update_custom_food, USER, food_id, edit_body()
    )

    assert message == NOT_FOUND
    assert values_of(own) == ("Gallo pinto", 180.0, 6.0, 30.0, 4.0)
    assert env.uow.committed is False


# SDD: 029 REQ-004 AC-004.2
def test_update_custom_food_checks_the_id_before_the_body():
    """Con un id no válido y un cuerpo no válido, gana el 404 (orden del plan 3.3)."""
    env = Env(customs=[gallo(12)])

    message = expect_error(
        ResourceNotFoundError, env.service.update_custom_food, USER, "abc", "hola"
    )

    assert message == NOT_FOUND


# SDD: 029 REQ-004 AC-004.1
def test_update_custom_food_that_does_not_exist_is_not_found():
    """Un id válido que no existe."""
    env = Env(customs=[gallo(12)])

    message = expect_error(
        ResourceNotFoundError, env.service.update_custom_food, USER, 99, edit_body()
    )

    assert message == NOT_FOUND
    assert env.uow.committed is False


# SDD: 029 REQ-004 AC-004.1
def test_update_custom_food_of_another_user_is_not_found_and_unchanged():
    """El alimento de B no se edita desde la cuenta de A."""
    other = gallo(12, user_id=OTHER)
    env = Env(customs=[other])

    message = expect_error(
        ResourceNotFoundError, env.service.update_custom_food, USER, 12, edit_body()
    )

    assert message == NOT_FOUND
    assert values_of(other) == ("Gallo pinto", 180.0, 6.0, 30.0, 4.0)
    assert env.uow.committed is False


# --------------------------------------------------------------------------
# Iteración 2: favoritos retirados del catálogo (REQ-009, F3)
# --------------------------------------------------------------------------


# SDD: 028 REQ-009 AC-009.6
def test_a_favorite_whose_food_left_the_catalog_does_not_count_for_the_limit():
    """99 favoritos visibles más uno retirado: marcar «Banano» crea el favorito y
    la lista de favoritos tiene 100 alimentos, entre ellos el nuevo."""
    visible = hundred_fruits()[:99]
    env = Env(catalog=[BANANA, *visible], favorites=hundred_favorites())

    env.service.add_favorite(USER, "catalog", "banano")

    assert len(env.favorites.created) == 1
    assert env.uow.committed is True
    favorites = env.service.favorites(USER)
    assert len(favorites) == 100
    assert ("catalog", "banano") in identities(favorites)


# SDD: 028 REQ-009 AC-009.7
def test_remove_favorite_of_a_food_that_left_the_catalog_deletes_it_for_good():
    """Quitar un favorito retirado lo borra y confirma; si «Banano» vuelve al
    catálogo, no reaparece en los favoritos."""
    env = Env(catalog=[], favorites=[make_favorite(USER, catalog_id="banano")])

    env.service.remove_favorite(USER, "catalog", "banano")

    assert env.favorites.favorites == []
    assert len(env.favorites.deleted) == 1
    assert env.uow.committed is True
    env.catalog.foods.append(BANANA)
    assert env.service.favorites(USER) == []


# SDD: 028 REQ-009 AC-009.8
def test_remove_favorite_of_a_food_nowhere_for_this_user_is_not_found():
    """El favorito retirado de otro usuario no cuenta: 404 y sus favoritos no cambian.
    En el mismo escenario, el favorito retirado del propio usuario sí se quita."""
    other_favorite = make_favorite(OTHER, catalog_id="banano")
    env = Env(catalog=[], favorites=[other_favorite, make_favorite(USER, catalog_id="queso")])

    env.service.remove_favorite(USER, "catalog", "queso")
    message = expect_error(
        ResourceNotFoundError, env.service.remove_favorite, USER, "catalog", "banano"
    )

    assert message == NOT_FOUND
    assert env.favorites.favorites == [other_favorite]
    assert len(env.favorites.deleted) == 1


# --------------------------------------------------------------------------
# Iteración 2: coste acotado de la búsqueda conjunta (NFR-004, F4)
# --------------------------------------------------------------------------

CATALOG_CSV = Path(__file__).resolve().parents[2] / "scripts" / "data" / "food_catalog.csv"
LONG_GIBBERISH = "arroces " * 12 + "qzxw"
SYLLABLES = ["ba", "ke", "di", "mo", "tu", "fa", "li", "ne", "so", "gu"]


def catalog_023():
    return [
        make_catalog_food(record.id, record.name, record.synonyms)
        for record in read_catalog_csv(CATALOG_CSV)
    ]


def own_foods_500():
    """500 alimentos propios con nombres deterministas de 2 a 5 palabras."""
    foods = []
    for n in range(500):
        name_words = []
        for k in range(2 + n % 4):
            word = SYLLABLES[(n // 10**k) % 10] + SYLLABLES[(n * (k + 3) + k) % 10]
            word += "".join(SYLLABLES[(n + k + j) % 10] for j in range(k % 2))
            name_words.append(word)
        foods.append(gallo(1000 + n, name=" ".join(name_words).capitalize()))
    return foods


def joint_search(query):
    """Resultados, comparaciones y cota de la búsqueda conjunta con la 023 y 500 propios."""
    env = Env(catalog=catalog_023(), customs=own_foods_500())
    stats = TypoSearchStats()
    results = env.service.search(USER, query, stats=stats)
    candidates = [
        SearchCandidate(food.name, food.synonyms, 0, str(food.id), food)
        for food in env.catalog.list_all()
    ] + [
        SearchCandidate(food.name, (), 1, str(food.id), food)
        for food in env.customs.list_by_user(USER)
    ]
    return results, stats.comparisons, typo_comparison_bound(candidates, query)


# SDD: 028 NFR-004 AC-N004.1
def test_the_joint_search_with_the_long_query_stays_within_the_bound_like_the_short_one():
    """Con la 023 y 500 propios, `"arroces " * 12 + "qzxw"` no encuentra nada, hace como
    mucho F × P comparaciones y las mismas que `arroces qzxw`."""
    assert len(LONG_GIBBERISH) == 100

    long_results, long_comparisons, long_bound = joint_search(LONG_GIBBERISH)
    short_results, short_comparisons, short_bound = joint_search("arroces qzxw")

    assert long_results == [] and short_results == []
    assert short_comparisons > 0
    assert long_comparisons == short_comparisons
    assert long_bound == short_bound
    assert long_comparisons <= long_bound


# SDD: 028 NFR-004 AC-N004.2
def test_the_joint_search_with_typos_finds_the_food_within_the_bound():
    """`arroces integrale` incluye «Arroz integral cocido» sin pasar de F × P."""
    results, comparisons, bound = joint_search("arroces integrale")

    assert "Arroz integral cocido" in names(results)
    assert 0 < comparisons <= bound


# SDD: 028 NFR-004 AC-N004.3
def test_the_joint_search_with_exact_matches_or_short_forms_makes_no_comparisons():
    """`arroz` y `pam` hacen 0 comparaciones; `arroces qzxw`, que necesita tolerancia, hace más."""
    rice, rice_comparisons, _ = joint_search("arroz")
    _, pam_comparisons, _ = joint_search("pam")
    _, typo_comparisons, _ = joint_search("arroces qzxw")

    assert "Arroz blanco cocido" in names(rice)
    assert rice_comparisons == 0
    assert pam_comparisons == 0
    assert typo_comparisons > 0
