from flask import Blueprint, jsonify, request

from decorators import require_auth
from extensions import db
from models import CatalogFood
from repositories.catalog_food_repository import CatalogFoodRepository
from services.catalog_search_service import CatalogSearchService

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api/catalog")


def _build_catalog_search_service() -> CatalogSearchService:
    return CatalogSearchService(CatalogFoodRepository(db.session))


def catalog_food_to_json(food: CatalogFood) -> dict:
    return {
        "id": food.id,
        "name": food.name,
        "per_100g": {
            "calories_kcal": float(food.calories_kcal),
            "protein_g": float(food.protein_g),
            "carbs_g": float(food.carbs_g),
            "fat_g": float(food.fat_g),
        },
    }


@catalog_bp.route("/search", methods=["GET"])
@require_auth
def search():
    foods = _build_catalog_search_service().search(request.args.get("q"))
    return jsonify(results=[catalog_food_to_json(food) for food in foods]), 200
