import type { FoodDataType } from "./types"

export const DATA_TYPE_LABELS: Record<FoodDataType, string> = {
  foundation: "Foundation",
  sr_legacy: "SR Legacy",
}

export function formatCalories(_value: number | null): string {
  throw new Error("not implemented")
}

export function formatGrams(_value: number | null, _label: string): string {
  throw new Error("not implemented")
}
