import type { BodyMetric } from "@/features/body-metrics/types"
import { isWithinLastMonths } from "@/features/body-metrics/dateUtils"

export type MetricChartPoint = { date: string; value: number }

type NumericField = "weight" | "body_fat_percentage" | "muscle_mass_percentage"

// El historial llega ordenado del mas nuevo al mas viejo (asi conviene
// para la lista de abajo). Los charts necesitan el orden cronologico
// inverso (viejo -> nuevo, izquierda a derecha), recortado a los ultimos
// `months` meses, y solo con las entradas donde ESE campo puntual no es
// null - un check-in puede cargar solo el peso, por ejemplo, y no
// queremos inventar un hueco o un cero falso en la linea de % grasa.
export function buildMetricSeries(
  metrics: BodyMetric[],
  field: NumericField,
  months = 12
): MetricChartPoint[] {
  return metrics
    .filter(
      (metric) =>
        metric[field] !== null && isWithinLastMonths(metric.recorded_at, months)
    )
    .map((metric) => ({ date: metric.recorded_at, value: metric[field] as number }))
    // Las fechas vienen como "YYYY-MM-DD": ese formato ordena
    // correctamente como texto plano, sin necesidad de parsear a Date.
    .sort((a, b) => a.date.localeCompare(b.date))
}
