import { parseLocalDate } from "@/lib/dates"
import { DATA_TYPE_LABELS } from "@/features/foods/format"
import type { MealItem, Nutrients } from "./types"

const kcalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 })
const gramFormat = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const loggedFormat = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

export function formatDiaryDate(isoDate: string): string {
  return dateFormat.format(parseLocalDate(isoDate))
}

export function formatKcal(value: number | null): string {
  return value === null ? "— kcal" : `${kcalFormat.format(value)} kcal`
}

export function formatNutrientGrams(value: number): string {
  return gramFormat.format(value)
}

export function formatLoggedGrams(grams: number): string {
  return `${loggedFormat.format(grams)} g`
}

function previewGrams(value: number | null, label: string): string {
  return value === null ? `— ${label}` : `${formatNutrientGrams(value)} g ${label}`
}

export function formatPortionPreview(nutrients: Nutrients): string {
  return [
    formatKcal(nutrients.calories_kcal),
    previewGrams(nutrients.protein_g, "proteína"),
    previewGrams(nutrients.carbs_g, "carbohidratos"),
    previewGrams(nutrients.fat_g, "grasa"),
  ].join(" · ")
}

export function sourceLabel(item: MealItem): string {
  return item.data_type === null ? "Personalizado" : DATA_TYPE_LABELS[item.data_type]
}
