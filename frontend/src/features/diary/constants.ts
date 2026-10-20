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
