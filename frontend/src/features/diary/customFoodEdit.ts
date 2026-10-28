import type { CustomFoodUpdatePayload, CustomLibraryFood } from "@/features/food-library/types"
import { gramsText } from "./format"
import { parseDecimalText, parseSignedDecimalText, type CustomFoodEditValues } from "./schemas"

// Aviso mientras se comprueba el nombre y se pulsa Intro.
export const CUSTOM_FOOD_NAME_CHECKING_MESSAGE = "Comprobando el nombre…"

// Valores del formulario a partir del alimento (números con coma decimal, como gramsText).
export function customFoodEditDefaults(food: CustomLibraryFood): CustomFoodEditValues {
  return {
    name: food.name,
    calories: gramsText(food.per_100g.calories_kcal),
    protein: gramsText(food.per_100g.protein_g),
    carbs: gramsText(food.per_100g.carbs_g),
    fat: gramsText(food.per_100g.fat_g),
  }
}

// Cuerpo del PATCH: nombre sin los espacios de los extremos y los cuatro números (solo con valores válidos).
export function customFoodEditPayload(values: CustomFoodEditValues): CustomFoodUpdatePayload {
  return {
    name: values.name.trim(),
    per_100g: {
      calories_kcal: parseSignedDecimalText(values.calories) as number,
      protein_g: parseSignedDecimalText(values.protein) as number,
      carbs_g: parseSignedDecimalText(values.carbs) as number,
      fat_g: parseSignedDecimalText(values.fat) as number,
    },
  }
}

// REQ-008: true si el nombre recortado es idéntico y los cuatro campos son el mismo número; un campo no válido es un cambio.
export function isCustomFoodEditUnchanged(
  values: CustomFoodEditValues,
  food: CustomLibraryFood
): boolean {
  if (values.name.trim() !== food.name) return false
  return (
    parseDecimalText(values.calories) === food.per_100g.calories_kcal &&
    parseDecimalText(values.protein) === food.per_100g.protein_g &&
    parseDecimalText(values.carbs) === food.per_100g.carbs_g &&
    parseDecimalText(values.fat) === food.per_100g.fat_g
  )
}
