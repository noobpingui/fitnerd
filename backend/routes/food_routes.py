from flask import Blueprint, g, jsonify, request

from decorators import require_auth
from extensions import db, embedding_client, rate_limiter
from models import Food
from repositories.food_repository import FoodRepository
from services.food_search_service import FoodSearchService

food_bp = Blueprint("foods", __name__, url_prefix="/api/foods")


def _build_food_search_service() -> FoodSearchService:
    return FoodSearchService(FoodRepository(db.session), embedding_client, rate_limiter)


def food_to_json(food: Food) -> dict:
    return {
        "fdc_id": food.fdc_id,
        "description": food.description,
        "data_type": food.data_type,
        "per_100g": {
            "calories_kcal": food.calories_kcal,
            "protein_g": food.protein_g,
            "carbs_g": food.carbs_g,
            "fat_g": food.fat_g,
        },
    }


@food_bp.route("/search", methods=["GET"])
@require_auth
def search():
    service = _build_food_search_service()
    foods = service.search(g.decoded_token["id"], request.args.get("q"))
    return jsonify(results=[food_to_json(food) for food in foods]), 200
