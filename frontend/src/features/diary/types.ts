import type { FoodDataType } from "@/features/foods/types"

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type NutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type Nutrients = Record<NutrientKey, number | null>
export type NutrientTotals = Record<NutrientKey, number>
export type MealItemSource = "usda" | "custom"
export type MealItem = {
  id: number
  source: MealItemSource
  fdc_id: number | null
  name: string
  data_type: FoodDataType | null
  grams: number
  per_100g: Nutrients
  nutrients: Nutrients
}
export type Meal = {
  id: number
  date: string
  meal_type: MealType
  items: MealItem[]
  totals: NutrientTotals
  incomplete: NutrientKey[]
}
export type Diary = {
  date: string
  meals: Meal[]
  totals: NutrientTotals
  incomplete: NutrientKey[]
}
export type UsdaItemPayload = { fdc_id: number; grams: number }
export type CustomItemPayload = {
  name: string
  grams: number
  per_100g: Record<NutrientKey, number>
}
export type AddMealItemsPayload = {
  date: string
  meal_type: MealType
  items: (UsdaItemPayload | CustomItemPayload)[]
}
