import type { BodyMetric } from "@/features/body-metrics/types"

// La medición con peso de fecha más reciente cuya fecha es posterior a
// `today` ("YYYY-MM-DD"), o null si no hay ninguna.
export function laterWeightMetric(
  metrics: BodyMetric[],
  today: string
): BodyMetric | null {
  let latest: BodyMetric | null = null
  for (const metric of metrics) {
    if (metric.weight === null || metric.recorded_at <= today) continue
    if (latest === null || metric.recorded_at > latest.recorded_at) {
      latest = metric
    }
  }
  return latest
}
