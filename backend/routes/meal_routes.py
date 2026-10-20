from flask import Blueprint, g, jsonify, request

from decorators import require_auth
from extensions import db
from repositories.food_repository import FoodRepository
from repositories.meal_repository import MealRepository
from repositories.user_repository import UserRepository
from services.meal_rules import NUTRIENT_KEYS
from services.meal_service import MealService, MealSummary
from unit_of_work.unit_of_work import UnitOfWork
from utils.clock import current_clock

meal_bp = Blueprint("meals", __name__, url_prefix="/api/meals")


def _build_meal_service() -> MealService:
    return MealService(
        MealRepository(db.session),
        FoodRepository(db.session),
        UserRepository(db.session),
        UnitOfWork(db.session),
        clock=current_clock(),
    )


def _number(value):
    return None if value is None else float(value)


def _serialize_numbers(values: dict) -> dict:
    return {key: _number(values[key]) for key in NUTRIENT_KEYS}


def _serialize_item(item) -> dict:
    return {
        "id": item.id,
        "source": item.source,
        "fdc_id": item.fdc_id,
        "name": item.name,
        "data_type": item.data_type,
        "grams": float(item.grams),
        "per_100g": {key: _number(getattr(item, f"per_100g_{key}")) for key in NUTRIENT_KEYS},
        "nutrients": {key: _number(getattr(item, key)) for key in NUTRIENT_KEYS},
    }


def _serialize_meal(summary: MealSummary) -> dict:
    meal = summary.meal
    return {
        "id": meal.id,
        "date": meal.meal_date.isoformat(),
        "meal_type": meal.meal_type,
        "items": [_serialize_item(item) for item in meal.items],
        "totals": _serialize_numbers(summary.totals),
        "incomplete": list(summary.incomplete),
    }


@meal_bp.route("", methods=["GET"])
@require_auth
def get_diary():
    summary = _build_meal_service().get_diary(g.decoded_token["id"], request.args.get("date"))
    return jsonify(
        date=summary.date.isoformat(),
        meals=[_serialize_meal(meal) for meal in summary.meals],
        totals=_serialize_numbers(summary.totals),
        incomplete=list(summary.incomplete),
    ), 200


@meal_bp.route("", methods=["POST"])
@require_auth
def add_items():
    data = request.get_json(silent=True)
    result = _build_meal_service().add_items(g.decoded_token["id"], data)
    return jsonify(_serialize_meal(result.meal)), (201 if result.created else 200)


@meal_bp.route("/<int:meal_id>/items/<int:item_id>", methods=["PATCH"])
@require_auth
def update_item(meal_id, item_id):
    data = request.get_json(silent=True)
    summary = _build_meal_service().update_item_grams(
        g.decoded_token["id"], meal_id, item_id, data
    )
    return jsonify(_serialize_meal(summary)), 200


@meal_bp.route("/<int:meal_id>/items/<int:item_id>", methods=["DELETE"])
@require_auth
def remove_item(meal_id, item_id):
    _build_meal_service().remove_item(g.decoded_token["id"], meal_id, item_id)
    return "", 204


@meal_bp.route("/<int:meal_id>", methods=["DELETE"])
@require_auth
def delete_meal(meal_id):
    _build_meal_service().delete_meal(g.decoded_token["id"], meal_id)
    return "", 204
