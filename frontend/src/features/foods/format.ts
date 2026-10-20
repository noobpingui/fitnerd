import type { FoodDataType } from "./types"

export const DATA_TYPE_LABELS: Record<FoodDataType, string> = {
  foundation: "Foundation",
  sr_legacy: "SR Legacy",
}

const calorieFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 })
const gramFormat = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatCalories(value: number | null): string {
  return value === null ? "— kcal" : `${calorieFormat.format(value)} kcal`
}

export function formatGrams(value: number | null, label: string): string {
  return value === null ? `— ${label}` : `${gramFormat.format(value)} g ${label}`
}
