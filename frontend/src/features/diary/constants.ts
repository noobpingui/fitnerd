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

export const SEARCH_DEBOUNCE_MS = 300
export const CUSTOM_FOOD_LIBRARY_NOTICE =
  "Se guardará en tus alimentos para usarlo otro día. Si ya tienes uno con el mismo nombre, se actualizarán sus valores."

export const DIARY_PAST_DAYS = 365
export const UNDO_DURATION_MS = 10_000
export const TODAY_CHECK_INTERVAL_MS = 30_000

export const PORTION_QUESTION_MAX_LENGTH = 200
