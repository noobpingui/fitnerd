"""Sugerencia de ajuste de calorías según el ritmo de peso (spec 010)."""

import math
from dataclasses import dataclass

# Punto medio del ritmo semanal objetivo de cada meta, en % del peso corporal por semana.
GOAL_RATE_MIDPOINT_PCT = {
    "lose": -0.75,
    "lose_slow": -0.375,
    "maintain": 0.0,
    "gain_slow": 0.175,
    "gain": 0.375,
}
KCAL_PER_KG = 7700
ROUND_STEP_KCAL = 50
MAX_ADJUSTMENT_KCAL = 500
FLOOR_KCAL = {"male": 1500, "female": 1200}
PACE_STATUSES_WITH_RATE = ("on_track", "too_slow", "too_fast", "off_range")


@dataclass(frozen=True)
class CalorieSuggestion:
    kind: str
    target_kcal: int
    suggested_kcal: int
    adjustment_kcal: int
    floor_kcal: int


def round_adjustment(raw: float) -> int:
    """Redondea a múltiplos de 50 (empates al menor valor absoluto) con tope de 500."""
    m = abs(raw) / ROUND_STEP_KCAL
    whole = math.floor(m)
    n = whole + 1 if m - whole > 0.5 + 1e-9 else whole
    value = min(n * ROUND_STEP_KCAL, MAX_ADJUSTMENT_KCAL)
    if value == 0:
        return 0
    return value if raw > 0 else -value


def suggest_calories(
    pace_status: str,
    rate_kg_per_week: float | None,
    latest_weight_kg: float | None,
    goal: str,
    gender: str,
    target_kcal: int,
) -> CalorieSuggestion | None:
    if pace_status not in PACE_STATUSES_WITH_RATE:
        return None

    floor = FLOOR_KCAL[gender]

    def on_track() -> CalorieSuggestion:
        return CalorieSuggestion("on_track", target_kcal, target_kcal, 0, floor)

    if pace_status == "on_track":
        return on_track()

    target_rate = GOAL_RATE_MIDPOINT_PCT[goal] * latest_weight_kg / 100
    raw = (target_rate - rate_kg_per_week) * KCAL_PER_KG / 7
    adjustment = round_adjustment(raw)

    if adjustment == 0:
        return on_track()
    if adjustment < 0 and target_kcal <= floor:
        return CalorieSuggestion("at_floor", target_kcal, target_kcal, 0, floor)
    if target_kcal + adjustment < floor:
        return CalorieSuggestion("floor_limited", target_kcal, floor, floor - target_kcal, floor)
    return CalorieSuggestion("adjust", target_kcal, target_kcal + adjustment, adjustment, floor)


UNREALISTIC_RATE_PCT = 2.0
RATE_EPS = 1e-9


def is_unrealistic_rate(_rate_kg_per_week: float, _latest_weight_kg: float) -> bool:
    raise NotImplementedError("not implemented")
