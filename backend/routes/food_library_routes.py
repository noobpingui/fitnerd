from flask import Blueprint, g, jsonify, request

from decorators import require_auth
from extensions import db
from repositories.catalog_food_repository import CatalogFoodRepository
from repositories.custom_food_repository import CustomFoodRepository
from repositories.food_favorite_repository import FoodFavoriteRepository
from repositories.meal_repository import MealRepository
from repositories.user_repository import UserRepository
from services.food_library_rules import LibraryFood
from services.food_library_service import FoodLibraryService
from unit_of_work.unit_of_work import UnitOfWork

food_library_bp = Blueprint("food_library", __name__, url_prefix="/api/food-library")


def _build_food_library_service() -> FoodLibraryService:
    return FoodLibraryService(
        CatalogFoodRepository(db.session),
        CustomFoodRepository(db.session),
        FoodFavoriteRepository(db.session),
        MealRepository(db.session),
        UserRepository(db.session),
        UnitOfWork(db.session),
    )


def library_food_to_json(food: LibraryFood) -> dict:
    data = {
        "kind": food.kind,
        "id": food.id,
        "name": food.name,
        "per_100g": {key: float(value) for key, value in food.per_100g.items()},
        "favorite": food.favorite,
    }
    if food.last_grams is not None:
        data["last_grams"] = float(food.last_grams)
    return data


def _results(foods: list[LibraryFood]):
    return jsonify(results=[library_food_to_json(food) for food in foods]), 200


@food_library_bp.route("/search", methods=["GET"])
@require_auth
def search():
    return _results(
        _build_food_library_service().search(g.decoded_token["id"], request.args.get("q"))
    )


@food_library_bp.route("/recent", methods=["GET"])
@require_auth
def recent():
    return _results(_build_food_library_service().recent(g.decoded_token["id"]))


@food_library_bp.route("/favorites", methods=["GET"])
@require_auth
def favorites():
    return _results(_build_food_library_service().favorites(g.decoded_token["id"]))


@food_library_bp.route("/favorites/<kind>/<food_id>", methods=["PUT"])
@require_auth
def add_favorite(kind, food_id):
    _build_food_library_service().add_favorite(g.decoded_token["id"], kind, food_id)
    return "", 204


@food_library_bp.route("/favorites/<kind>/<food_id>", methods=["DELETE"])
@require_auth
def remove_favorite(kind, food_id):
    _build_food_library_service().remove_favorite(g.decoded_token["id"], kind, food_id)
    return "", 204


@food_library_bp.route("/custom/<custom_food_id>", methods=["PATCH"])
@require_auth
def update_custom_food(custom_food_id):
    food = _build_food_library_service().update_custom_food(
        g.decoded_token["id"], custom_food_id, request.get_json(silent=True)
    )
    return jsonify(library_food_to_json(food)), 200


@food_library_bp.route("/custom/<custom_food_id>", methods=["DELETE"])
@require_auth
def delete_custom_food(custom_food_id):
    _build_food_library_service().delete_custom_food(g.decoded_token["id"], custom_food_id)
    return "", 204
