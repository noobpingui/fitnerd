import type { WeightUnit } from "@/features/onboarding/types"

export function makeMetricCorrectionSchema(
  _weightUnit: WeightUnit,
  _originalWeightDisplay: string,
  _originalWeightKg: number | null,
): never {
  throw new Error("not implemented")
}

export function correctionPayload(
  _values: unknown,
  _weightUnit: WeightUnit,
  _original: unknown,
): never {
  throw new Error("not implemented")
}
