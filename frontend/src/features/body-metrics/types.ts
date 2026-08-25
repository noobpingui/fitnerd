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
