import { apiFetch } from "@/lib/apiClient"
import { diaryResponseSchema, mealPhotoAnalysisSchema, mealResponseSchema } from "./schemas"
import type { AddMealItemsPayload, Diary, Meal, MealPhotoAnalysis } from "./types"

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

// Envía un único archivo en `image` y valida la respuesta.
export async function analyzeMealPhoto(image: Blob): Promise<MealPhotoAnalysis> {
  const form = new FormData()
  form.append("image", image, "comida.jpg")
  return mealPhotoAnalysisSchema.parse(
    await apiFetch<unknown>("/api/meals/analyze", { method: "POST", body: form })
  )
}
