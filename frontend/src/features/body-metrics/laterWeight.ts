import type { BodyMetric } from "@/features/body-metrics/types"

// La medición con peso de fecha más reciente cuya fecha es posterior a
// `today` ("YYYY-MM-DD"), o null si no hay ninguna.
export function laterWeightMetric(
  _metrics: BodyMetric[],
  _today: string
): BodyMetric | null {
  throw new Error("not implemented")
}
