import { apiFetch } from "@/lib/apiClient"
import { diaryResponseSchema, mealResponseSchema } from "./schemas"
import type { AddMealItemsPayload, Diary, Meal } from "./types"

export async function getDiary(date: string): Promise<Diary> {
  const params = new URLSearchParams({ date })
  return diaryResponseSchema.parse(await apiFetch<unknown>(`/api/meals?${params}`))
}

export async function addMealItems(payload: AddMealItemsPayload): Promise<Meal> {
  return mealResponseSchema.parse(
    await apiFetch<unknown>("/api/meals", { method: "POST", body: payload })
  )
}

export async function updateMealItemGrams(
  mealId: number,
  itemId: number,
  grams: number
): Promise<Meal> {
  return mealResponseSchema.parse(
    await apiFetch<unknown>(`/api/meals/${mealId}/items/${itemId}`, {
      method: "PATCH",
      body: { grams },
    })
  )
}

export async function removeMealItem(mealId: number, itemId: number): Promise<void> {
  await apiFetch<void>(`/api/meals/${mealId}/items/${itemId}`, { method: "DELETE" })
}
