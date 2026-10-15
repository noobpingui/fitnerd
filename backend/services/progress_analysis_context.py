"""Validación del cuerpo y armado del mensaje del análisis de progreso (spec 010).

Son funciones puras: reciben los datos ya leídos y devuelven valores o lanzan
`ValidationError`. El servidor no reformatea los indicadores que llegan del
cliente (ya vienen con el mismo texto que ve el usuario, ADR-0021).
"""

import math
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from exceptions.custom_exceptions import ValidationError
from services.calorie_suggestion import (
    PACE_STATUSES_WITH_RATE,
    CalorieSuggestion,
    is_unrealistic_rate,
)
from services.number_validation import is_int, is_number

INVALID_ANALYSIS_REQUEST_MESSAGE = (
    "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."
)

LB_PER_KG_FACTOR = 0.45359237
MAX_TEXT_LENGTH = 32
MAX_COUNTER = 100000
MAX_KCAL = 10000
UNAVAILABLE = "no disponible"

UNREALISTIC = "unrealistic"
PACE_STATUSES = (
    "on_track",
    "too_slow",
    "too_fast",
    "off_range",
    "insufficient",
    "stale",
    UNREALISTIC,
)

# Lista blanca: dígitos, letras, puntuación numérica, signos, espacios y "%" o "/".
# Impide saltos de línea y, con el tope de longitud, instrucciones largas.
_TEXT_PATTERN = re.compile(r"^[0-9A-Za-z.,+\-−   %/]+$")
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

GENDER_LABELS = {"male": "hombre", "female": "mujer"}
ACTIVITY_LABELS = {
    "low": "Bajo",
    "moderate": "Moderado",
    "high": "Alto",
    "very_high": "Muy alto",
    "athlete": "Atleta",
}
GOAL_LABELS = {
    "lose": "Perder peso",
    "lose_slow": "Perder peso lentamente",
    "maintain": "Mantener peso",
    "gain_slow": "Aumentar peso lentamente",
    "gain": "Aumentar peso",
}
PACE_LABELS = {
    "on_track": "En ritmo con tu meta",
    "too_slow": "Más lento que tu meta",
    "too_fast": "Más rápido que tu meta",
    "off_range": "Fuera del rango de tu meta",
    "insufficient": "Faltan registros para calcularlo",
    "stale": "Sin registros recientes",
    UNREALISTIC: "Revisa tus mediciones",
}
UNREALISTIC_SUGGESTION_TEXT = (
    "No se sugiere un ajuste de calorías: el ritmo no es realista y "
    "probablemente alguna medición de peso es errónea."
)

_TEXT_INDICATORS = (
    "weight",
    "weight_change_30d",
    "body_fat",
    "body_fat_change_30d",
    "rate",
    "fat_mass",
    "lean_mass",
    "bmi",
    "ffmi",
)
_COUNTER_INDICATORS = ("streak_weeks", "records_last_30_days", "total_records")


@dataclass(frozen=True)
class Calories:
    maintenance_kcal: int
    target_kcal: int


@dataclass(frozen=True)
class AnalysisRequest:
    today: str
    indicators: dict
    pace_status: str
    rate_kg_per_week: float | None
    latest_weight_kg: float | None
    calories: Calories


def _invalid() -> ValidationError:
    return ValidationError(INVALID_ANALYSIS_REQUEST_MESSAGE)


def _parse_date(value: Any) -> date:
    if not isinstance(value, str) or not _DATE_PATTERN.match(value):
        raise _invalid()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise _invalid()


def parse_analysis_request(data: Any, server_today: date) -> AnalysisRequest:
    if not isinstance(data, dict):
        raise _invalid()
    indicators = data.get("indicators")
    calories = data.get("calories")
    if not isinstance(indicators, dict) or not isinstance(calories, dict):
        raise _invalid()

    today = _parse_date(data.get("today"))
    if abs(today - server_today) > timedelta(days=1):
        raise _invalid()

    clean: dict = {}
    for key in _TEXT_INDICATORS:
        value = indicators.get(key)
        if value is not None:
            if (
                not isinstance(value, str)
                or not 1 <= len(value) <= MAX_TEXT_LENGTH
                or not _TEXT_PATTERN.match(value)
            ):
                raise _invalid()
        clean[key] = value

    pace_status = indicators.get("pace_status")
    if pace_status not in PACE_STATUSES:
        raise _invalid()

    rate = data.get("rate_kg_per_week")
    latest = data.get("latest_weight_kg")
    if pace_status == UNREALISTIC:
        if not is_number(rate) or not is_number(latest) or not 20 <= latest <= 400:
            raise _invalid()
    elif pace_status in PACE_STATUSES_WITH_RATE:
        if not is_number(rate) or not -10 <= rate <= 10:
            raise _invalid()
        if not is_number(latest) or not 20 <= latest <= 400:
            raise _invalid()
        if is_unrealistic_rate(rate, latest):
            pace_status = UNREALISTIC
    elif rate is not None or latest is not None:
        raise _invalid()

    for key in _COUNTER_INDICATORS:
        value = indicators.get(key)
        if not is_int(value) or not 0 <= value <= MAX_COUNTER:
            raise _invalid()
        clean[key] = value

    last_record = indicators.get("last_record_date")
    if last_record is not None:
        _parse_date(last_record)
    clean["last_record_date"] = last_record

    kcal = {}
    for key in ("maintenance_kcal", "target_kcal"):
        value = calories.get(key)
        if not is_int(value) or not 1 <= value <= MAX_KCAL:
            raise _invalid()
        kcal[key] = value

    return AnalysisRequest(
        today=data["today"],
        indicators=clean,
        pace_status=pace_status,
        rate_kg_per_week=rate,
        latest_weight_kg=latest,
        calories=Calories(**kcal),
    )


def format_decimal(value: float) -> str:
    """Hasta un decimal con coma y sin ',0' (79.4 -> '79,4', 180.0 -> '180')."""
    rounded = math.floor(value * 10 + 0.5) / 10
    if rounded == int(rounded):
        return str(int(rounded))
    return str(rounded).replace(".", ",")


def to_display_weight(kg: float, unit: str) -> float:
    """Peso en la unidad del perfil; en lb redondea como `Math.round` del frontend."""
    if unit == "lb":
        return math.floor(kg / LB_PER_KG_FACTOR * 10 + 0.5) / 10
    return kg


def format_height(profile: Any) -> str:
    if profile.height_unit == "ft":
        return f"{profile.height_ft} ft {profile.height_in} in"
    return f"{format_decimal(profile.height_cm)} cm"


def _or_unavailable(value: str | None) -> str:
    return value if value is not None else UNAVAILABLE


def _plural(count: int, singular: str, plural: str) -> str:
    return f"{count} {singular if count == 1 else plural}"


def _suggestion_block(suggestion: CalorieSuggestion | None, pace_status: str) -> str:
    if pace_status == UNREALISTIC:
        return UNREALISTIC_SUGGESTION_TEXT
    if suggestion is None:
        return "No hay datos recientes suficientes para sugerir un ajuste de calorías."
    if suggestion.kind == "on_track":
        return (
            "El ritmo encaja con la meta: "
            f"mantener {suggestion.target_kcal} kcal al día."
        )
    if suggestion.kind == "at_floor":
        return (
            "El objetivo diario ya está en el mínimo recomendado de "
            f"{suggestion.floor_kcal} kcal; no se sugiere bajarlo."
        )
    text = (
        f"Ajuste: {suggestion.adjustment_kcal:+d} kcal al día. "
        f"Calorías sugeridas: {suggestion.suggested_kcal} kcal al día."
    )
    if suggestion.kind == "floor_limited":
        text += f" Limitado por el mínimo recomendado de {suggestion.floor_kcal} kcal."
    return text


def _format_history(history: Any, unit: str) -> str:
    lines = []
    for metric in history:
        parts = []
        if metric.weight is not None:
            parts.append(f"peso {format_decimal(to_display_weight(metric.weight, unit))} {unit}")
        if metric.body_fat_percentage is not None:
            parts.append(f"grasa corporal {format_decimal(metric.body_fat_percentage)} %")
        if metric.muscle_mass_percentage is not None:
            parts.append(f"masa muscular {format_decimal(metric.muscle_mass_percentage)} %")
        if metric.notes:
            parts.append(f'notas: "{metric.notes}"')
        lines.append(f"{metric.recorded_at.isoformat()}: {', '.join(parts)}")
    return "\n".join(lines)


def build_user_message(
    profile: Any,
    age: int | None,
    request: AnalysisRequest,
    history: Any,
    suggestion: CalorieSuggestion | None,
    months: int,
) -> str:
    ind = request.indicators
    age_text = f"{age} años" if age is not None else UNAVAILABLE

    if request.pace_status in PACE_STATUSES_WITH_RATE or request.pace_status == UNREALISTIC:
        rate_text = _or_unavailable(ind["rate"])
    else:
        rate_text = UNAVAILABLE
    rate_line = f"Ritmo semanal: {rate_text} ({PACE_LABELS[request.pace_status]})"

    body_fat = _or_unavailable(ind["body_fat"])
    if ind["body_fat"] is not None and ind["body_fat_change_30d"] is not None:
        body_fat += f" (cambio en 30 días: {ind['body_fat_change_30d']})"

    profile_block = [
        "Perfil del usuario:",
        f"Sexo: {GENDER_LABELS[profile.gender]}",
        f"Edad: {age_text}",
        f"Altura: {format_height(profile)}",
        f"Nivel de actividad: {ACTIVITY_LABELS[profile.activity_level]}",
        f"Meta: {GOAL_LABELS[profile.goal]}",
    ]
    indicators_block = [
        "Indicadores de progreso (tal como los ve el usuario en Métricas):",
        f"Peso actual: {_or_unavailable(ind['weight'])} "
        f"(cambio en 30 días: {_or_unavailable(ind['weight_change_30d'])})",
        f"% de grasa: {body_fat}",
        rate_line,
        f"Masa grasa: {_or_unavailable(ind['fat_mass'])}",
        f"Masa magra: {_or_unavailable(ind['lean_mass'])}",
        f"IMC: {_or_unavailable(ind['bmi'])}",
        f"FFMI: {_or_unavailable(ind['ffmi'])}",
        f"Racha: {_plural(ind['streak_weeks'], 'semana', 'semanas')}",
        "Registros en los últimos 30 días: "
        f"{_plural(ind['records_last_30_days'], 'registro', 'registros')}",
        f"Total de registros: {ind['total_records']} en total",
        f"Último registro: {_or_unavailable(ind['last_record_date'])}",
    ]
    calories_block = [
        "Calorías (Macros):",
        f"Mantenimiento: {request.calories.maintenance_kcal} kcal",
        f"Objetivo diario: {request.calories.target_kcal} kcal",
    ]
    suggestion_block = [
        "Ajuste de calorías sugerido (calculado por la app):",
        _suggestion_block(suggestion, request.pace_status),
    ]
    history_block = [
        f"Historial de métricas corporales (últimos {months} meses):",
        _format_history(history, profile.weight_unit),
    ]

    blocks = [profile_block, indicators_block, calories_block, suggestion_block, history_block]
    return "\n\n".join("\n".join(block) for block in blocks)
