"""Sugerencia de ajuste de calorías según el ritmo de peso (spec 010)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CalorieSuggestion:
    kind: str
    target_kcal: int
    suggested_kcal: int
    adjustment_kcal: int
    floor_kcal: int


def round_adjustment(_raw: float) -> int:
    raise NotImplementedError


def suggest_calories(
    _pace_status: str,
    _rate_kg_per_week: float | None,
    _latest_weight_kg: float | None,
    _goal: str,
    _gender: str,
    _target_kcal: int,
) -> CalorieSuggestion | None:
    raise NotImplementedError
