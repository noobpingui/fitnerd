import { apiFetch } from "@/lib/apiClient"
import { libraryResultsSchema, recentResultsSchema } from "./schemas"
import type { CustomFoodUpdatePayload, CustomLibraryFood, LibraryFood, RecentFood } from "./types"

const BASE = "/api/food-library"

export async function searchFoodLibrary(query: string): Promise<LibraryFood[]> {
  const params = new URLSearchParams({ q: query })
  const data = await apiFetch<unknown>(`${BASE}/search?${params}`)
  return libraryResultsSchema.parse(data).results
}

export async function getRecentFoods(): Promise<RecentFood[]> {
  const data = await apiFetch<unknown>(`${BASE}/recent`)
  return recentResultsSchema.parse(data).results
}

export async function getFavoriteFoods(): Promise<LibraryFood[]> {
  const data = await apiFetch<unknown>(`${BASE}/favorites`)
  return libraryResultsSchema.parse(data).results
}

export async function setFoodFavorite(
  food: Pick<LibraryFood, "kind" | "id">,
  favorite: boolean
): Promise<void> {
  await apiFetch<unknown>(`${BASE}/favorites/${food.kind}/${encodeURIComponent(String(food.id))}`, {
    method: favorite ? "PUT" : "DELETE",
  })
}

// PATCH /api/food-library/custom/{id}; valida la respuesta con customLibraryFoodSchema.
export async function updateCustomFood(
  _customFoodId: number,
  _payload: CustomFoodUpdatePayload
): Promise<CustomLibraryFood> {
  throw new Error("not implemented")
}

export async function deleteCustomFood(customFoodId: number): Promise<void> {
  await apiFetch<unknown>(`${BASE}/custom/${customFoodId}`, { method: "DELETE" })
}
