import { apiFetch } from "@/lib/apiClient"
import { foodSearchResponseSchema } from "./schemas"
import type { FoodSearchResponse } from "./types"

export async function searchFoods(query: string): Promise<FoodSearchResponse> {
  const params = new URLSearchParams({ q: query })
  return foodSearchResponseSchema.parse(
    await apiFetch<unknown>(`/api/foods/search?${params}`)
  )
}
