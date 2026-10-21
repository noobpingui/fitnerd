export type CatalogNutrientKey = "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"
export type CatalogPer100g = Record<CatalogNutrientKey, number>
export type CatalogFood = { id: string; name: string; per_100g: CatalogPer100g }
export type CatalogSearchResponse = { results: CatalogFood[] }
