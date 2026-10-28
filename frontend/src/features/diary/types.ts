import type { FoodDataType } from "@/features/foods/types"

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type NutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type Nutrients = Record<NutrientKey, number | null>
export type NutrientTotals = Record<NutrientKey, number>
export type MealItemSource = "catalog" | "usda" | "custom"
export type MealItem = {
  id: number
  source: MealItemSource
  catalog_id: string | null
  fdc_id: number | null
  custom_food_id?: number | null
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
export type CatalogItemPayload = { catalog_id: string; grams: number }
export type UsdaItemPayload = { fdc_id: number; grams: number }
export type CustomItemPayload = {
  name: string
  grams: number
  per_100g: Record<NutrientKey, number>
}
export type LibraryItemPayload = { custom_food_id: number; grams: number }
export type AnalysisConfidence = "high" | "medium" | "low"
export type ProposedFood = {
  catalog_id: string
  name: string
  grams: number
  confidence: AnalysisConfidence
  per_100g: Record<NutrientKey, number>
  nutrients: Nutrients
}
export type UnmatchedFood = { name: string; grams: number; confidence: AnalysisConfidence }
export type MealPhotoAnalysis = {
  items: ProposedFood[]
  unmatched: UnmatchedFood[]
  totals: NutrientTotals
}
// Un alimento de la propuesta. `grams` es el texto del campo (coma o punto) en los que se guardan.
export type ProposalEntry =
  | {
      kind: "catalog"
      catalogId: string
      name: string
      per100g: Record<NutrientKey, number>
      grams: string
      tag: AnalysisConfidence | "user" // "user" = «Añadido por ti»
    }
  | {
      kind: "custom"
      name: string
      per100g: Record<NutrientKey, number>
      grams: string
      customFoodId?: number // solo los alimentos propios ya guardados
    }
  | { kind: "unmatched"; name: string; grams: number; confidence: AnalysisConfidence }
export type ProposalFormEntry = ProposalEntry & { key: string }
export type ProposalFormValues = { entries: ProposalFormEntry[] }
export type SavableItemPayload = CatalogItemPayload | CustomItemPayload | LibraryItemPayload
export type AddMealItemsPayload = {
  date: string
  meal_type: MealType
  items: (CatalogItemPayload | UsdaItemPayload | CustomItemPayload | LibraryItemPayload)[]
}
export type RemovalUndo = { token: string; name: string; mealType: MealType }
