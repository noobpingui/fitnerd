export type LibraryNutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type LibraryPer100g = Record<LibraryNutrientKey, number>
export type CatalogLibraryFood = {
  kind: "catalog"
  id: string
  name: string
  per_100g: LibraryPer100g
  favorite: boolean
}
export type CustomLibraryFood = {
  kind: "custom"
  id: number
  name: string
  per_100g: LibraryPer100g
  favorite: boolean
}
export type LibraryFood = CatalogLibraryFood | CustomLibraryFood
export type CustomFoodUpdatePayload = { name: string; per_100g: LibraryPer100g }
export type RecentFood =LibraryFood & { last_grams: number }
