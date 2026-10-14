"""Unitarios de la regla del ajuste de calorías (spec 010). Son funciones
puras: no hay dependencias que sustituir, así que no se usan fakes."""

from services.calorie_suggestion import (
    is_unrealistic_rate,
    round_adjustment,
    suggest_calories,
)


# SDD: REQ-004 AC-004.1
def test_too_slow_pace_suggests_a_deficit_rounded_to_50():
    """Perder peso a -0,2 kg/sem con 79,4 kg: ajuste bruto -435, redondeado a -450."""
    result = suggest_calories("too_slow", -0.2, 79.4, "lose", "male", 2200)

    assert result.kind == "adjust"
    assert result.target_kcal == 2200
    assert result.adjustment_kcal == -450
    assert result.suggested_kcal == 1750
    assert result.floor_kcal == 1500


# SDD: REQ-004 AC-004.2
def test_too_fast_pace_suggests_a_surplus():
    """Perder -1 kg/sem con 77 kg es más rápido que la meta: +450 kcal."""
    result = suggest_calories("too_fast", -1.0, 77.0, "lose", "male", 2170)

    assert result.kind == "adjust"
    assert result.adjustment_kcal == 450
    assert result.suggested_kcal == 2620


# SDD: REQ-004 AC-004.3
def test_off_range_pace_for_maintain_goal_corrects_towards_zero_rate():
    """Meta mantener con +0,3 kg/sem: ajuste bruto -330, redondeado a -350."""
    result = suggest_calories("off_range", 0.3, 80.9, "maintain", "male", 2773)

    assert result.kind == "adjust"
    assert result.adjustment_kcal == -350
    assert result.suggested_kcal == 2423


# SDD: REQ-004 AC-004.4
def test_adjustment_is_capped_at_500_kcal():
    """Un ajuste bruto de +873,8 kcal se limita a +500 (3283 -> 3783)."""
    result = suggest_calories("too_slow", -0.5, 78.5, "gain", "male", 3283)

    assert result.kind == "adjust"
    assert result.adjustment_kcal == 500
    assert result.suggested_kcal == 3783


# SDD: REQ-004 AC-004.5
def test_round_adjustment_ties_go_towards_the_smaller_absolute_value():
    """-325 es empate entre -300 y -350 y gana -300; -330 ya cae en -350."""
    assert round_adjustment(-325) == -300
    assert round_adjustment(-330) == -350
    assert round_adjustment(325) == 300
    assert round_adjustment(375) == 350
    assert round_adjustment(-435.05) == -450


# SDD: REQ-004 AC-004.5
def test_round_adjustment_caps_the_absolute_value_at_500():
    """Ningún ajuste supera 500 kcal en valor absoluto, ni positivo ni negativo."""
    assert round_adjustment(873.8) == 500
    assert round_adjustment(-873.8) == -500
    assert round_adjustment(500) == 500


# SDD: REQ-004 AC-004.6
def test_a_small_raw_adjustment_rounds_to_zero():
    """Un ajuste bruto de +20 kcal redondea a 0."""
    assert round_adjustment(20) == 0
    assert round_adjustment(-20) == 0
    assert round_adjustment(0) == 0


# SDD: REQ-004 AC-004.6
def test_zero_adjustment_is_treated_as_on_track():
    """Con un estado 'más lento' pero ajuste bruto de +20, no hay cambio: on_track."""
    # Meta mantener (ritmo objetivo 0) y ritmo de -20/1100 kg/sem: bruto = +20.
    result = suggest_calories("too_slow", -20 / 1100, 100.0, "maintain", "male", 2500)

    assert result.kind == "on_track"
    assert result.adjustment_kcal == 0
    assert result.suggested_kcal == 2500


# SDD: REQ-005 AC-005.1
def test_suggestion_below_the_floor_is_raised_to_the_floor():
    """1703 - 450 = 1253 queda bajo 1500: se sugiere 1500 con ajuste -203."""
    result = suggest_calories("too_slow", -0.2, 79.4, "lose", "male", 1703)

    assert result.kind == "floor_limited"
    assert result.suggested_kcal == 1500
    assert result.adjustment_kcal == -203
    assert result.floor_kcal == 1500


# SDD: REQ-005 AC-005.2
def test_target_already_at_the_floor_does_not_suggest_lowering_it():
    """Mujer con objetivo 1200 (su suelo) y ajuste negativo: at_floor, sin cambio."""
    result = suggest_calories("too_slow", -0.1, 60.2, "lose", "female", 1200)

    assert result.kind == "at_floor"
    assert result.floor_kcal == 1200
    assert result.suggested_kcal == 1200
    assert result.adjustment_kcal == 0


# SDD: REQ-005 AC-005.3
def test_floor_does_not_apply_to_a_positive_adjustment():
    """Con ajuste positivo el suelo no interviene: 2170 + 450 = 2620."""
    result = suggest_calories("too_fast", -1.0, 77.0, "lose", "male", 2170)

    assert result.kind == "adjust"
    assert result.suggested_kcal == 2620
    assert result.adjustment_kcal == 450


# SDD: REQ-006 AC-006.1
def test_on_track_pace_keeps_the_current_target():
    """En ritmo no se sugiere ningún cambio: se mantienen 2189 kcal."""
    result = suggest_calories("on_track", -0.5, 78.5, "lose", "male", 2189)

    assert result.kind == "on_track"
    assert result.target_kcal == 2189
    assert result.suggested_kcal == 2189
    assert result.adjustment_kcal == 0


# SDD: REQ-006 AC-006.2
def test_insufficient_records_give_no_suggestion():
    """Sin registros suficientes para el ritmo no se calcula ninguna sugerencia."""
    assert suggest_calories("insufficient", None, None, "lose", "male", 2200) is None


# SDD: REQ-006 AC-006.3
def test_stale_records_give_no_suggestion():
    """Con el último registro de hace más de 28 días tampoco hay sugerencia."""
    assert suggest_calories("stale", None, None, "lose", "male", 2200) is None


# --- Spec 011: ritmo poco realista ---


# SDD: REQ-001 AC-001.1
def test_a_big_gain_is_an_unrealistic_rate():
    """+12,6 kg/sem con 98 kg (12,9 % por semana) es poco realista."""
    assert is_unrealistic_rate(12.6, 98) is True


# SDD: REQ-001 AC-001.2
def test_a_big_loss_is_an_unrealistic_rate():
    """-12,6 kg/sem con 80 kg (15,75 % por semana) es poco realista."""
    assert is_unrealistic_rate(-12.6, 80) is True


# SDD: REQ-001 AC-001.3
def test_exactly_two_percent_per_week_is_not_unrealistic():
    """+2 kg/sem con 100 kg es exactamente el 2 %: sigue siendo realista."""
    assert is_unrealistic_rate(2.0, 100) is False


# SDD: REQ-001 AC-001.4
def test_just_above_two_percent_per_week_is_unrealistic():
    """+2,1 kg/sem con 100,2 kg (2,096 %) supera el 2 %."""
    assert is_unrealistic_rate(2.1, 100.2) is True


# SDD: REQ-006 AC-006.3
def test_two_percent_with_floating_point_noise_is_not_unrealistic():
    """1,6 / 80 da 2,0000000000000004 en coma flotante; con la tolerancia no cuenta."""
    assert is_unrealistic_rate(1.6, 80) is False


# SDD: REQ-001 AC-001.6
def test_a_normal_pace_is_not_unrealistic():
    """-0,5 kg/sem con 79,4 kg (0,63 %) es un ritmo normal."""
    assert is_unrealistic_rate(-0.5, 79.4) is False


# SDD: REQ-004 AC-004.1
def test_unrealistic_pace_gives_no_suggestion():
    """Con el estado 'unrealistic' no se calcula ninguna sugerencia."""
    # El umbral es lo nuevo: con ese ritmo el estado correcto es 'unrealistic'.
    assert is_unrealistic_rate(12.6, 98) is True
    assert suggest_calories("unrealistic", 12.6, 98, "lose", "male", 2200) is None
