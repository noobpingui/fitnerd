export type FoodDataType = "foundation" | "sr_legacy"
export type FoodPer100g = {
  calories_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}
export type Food = {
  fdc_id: number
  description: string
  data_type: FoodDataType
  per_100g: FoodPer100g
}
export type FoodSearchResponse = { results: Food[] }
