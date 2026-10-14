// Refleja _serialize() en routes/body_metric_routes.py. Los 3 valores
// numericos son individualmente nullable - un registro puede traer, por
// ejemplo, solo el peso y nada mas.
export type BodyMetric = {
  id: string
  weight: number | null
  body_fat_percentage: number | null
  muscle_mass_percentage: number | null
  notes: string | null
  recorded_at: string // "YYYY-MM-DD" (date.isoformat() del lado del backend)
}

// Lo que le mandamos a POST /api/body-metrics. Todo opcional porque el
// backend acepta cualquier combinacion (con la regla de "al menos uno",
// que el backend mismo valida y devuelve como error si se incumple).
export type CreateBodyMetricPayload = {
  weight?: number
  body_fat_percentage?: number
  muscle_mass_percentage?: number
  notes?: string
  recorded_at?: string
}

// Lo que le mandamos a PUT /api/body-metrics/<id>.
export type UpdateBodyMetricPayload = {
  weight: number | null
  body_fat_percentage: number | null
  muscle_mass_percentage: number | null
}

// Estado del ritmo que viaja al servidor: los cuatro de la meta más los dos
// casos sin ritmo calculable.
export type PaceStatusCode =
  | "on_track"
  | "too_slow"
  | "too_fast"
  | "off_range"
  | "insufficient"
  | "stale"
  | "unrealistic"

// Cuerpo de POST /api/body-metrics/analysis (spec 010, ADR-0021): los textos
// son exactamente los que ve el usuario en Métricas, `null` donde se pinta "—".
export type AnalysisRequest = {
  today: string // "YYYY-MM-DD"
  indicators: {
    weight: string | null
    weight_change_30d: string | null
    body_fat: string | null
    body_fat_change_30d: string | null
    rate: string | null
    pace_status: PaceStatusCode
    fat_mass: string | null
    lean_mass: string | null
    bmi: string | null
    ffmi: string | null
    streak_weeks: number
    records_last_30_days: number
    total_records: number
    last_record_date: string | null
  }
  rate_kg_per_week: number | null
  latest_weight_kg: number | null
  calories: { maintenance_kcal: number; target_kcal: number }
}

export type CalorieSuggestion = {
  kind: "adjust" | "floor_limited" | "at_floor" | "on_track"
  target_kcal: number
  suggested_kcal: number
  adjustment_kcal: number
  floor_kcal: number
}

export type AnalysisResponse = {
  analysis: string
  calorie_suggestion: CalorieSuggestion | null
}
