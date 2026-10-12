import type { BodyMetric } from "@/features/body-metrics/types"
import type { WeightUnit } from "@/features/onboarding/types"

type MetricsHistoryProps = {
  metrics: BodyMetric[]
  weightUnit: WeightUnit
  toDisplayWeight: (kg: number) => number
}

export function MetricsHistory(_props: MetricsHistoryProps): never {
  throw new Error("not implemented")
}
