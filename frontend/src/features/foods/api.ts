import type { FoodSearchResponse } from "./types"

export function searchFoods(_query: string): Promise<FoodSearchResponse> {
  throw new Error("not implemented")
}
