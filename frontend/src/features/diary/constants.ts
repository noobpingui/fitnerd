import type { MealType, NutrientKey } from "./types"

export const MEAL_SECTIONS: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Desayuno" },
  { type: "lunch", label: "Almuerzo" },
  { type: "dinner", label: "Cena" },
  { type: "snack", label: "Meriendas" },
]

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  calories_kcal: "Calorías",
  protein_g: "Proteína",
  carbs_g: "Carbohidratos",
  fat_g: "Grasa",
}

export const DIARY_PAST_DAYS = 365
export const UNDO_DURATION_MS = 10_000
export const TODAY_CHECK_INTERVAL_MS = 30_000
