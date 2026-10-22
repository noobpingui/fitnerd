import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query"
import {
  addMealItems,
  getDiary,
  removeMealItem,
  updateMealItemGrams,
} from "./api"
import type { AddMealItemsPayload, Meal, MealPhotoAnalysis } from "./types"

export const diaryKeys = { day: (date: string) => ["diary", date] as const }

export function useDiary(date: string) {
  return useQuery({ queryKey: diaryKeys.day(date), queryFn: () => getDiary(date) })
}

// onSuccess devuelve la promesa de la invalidación: la mutación no termina
// hasta que el diario se ha vuelto a leer.
export function useAddMealItems(date: string) {
  const queryClient = useQueryClient()
  return useMutation<Meal, Error, AddMealItemsPayload>({
    mutationFn: (payload) => addMealItems(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

// Sin reintentos: cada análisis cuenta para el límite de 10 por hora.
export function useAnalyzeMealPhoto(): UseMutationResult<MealPhotoAnalysis, Error, Blob> {
  throw new Error("not implemented")
}

export function useUpdateMealItemGrams(date: string) {
  const queryClient = useQueryClient()
  return useMutation<Meal, Error, { mealId: number; itemId: number; grams: number }>({
    mutationFn: ({ mealId, itemId, grams }) => updateMealItemGrams(mealId, itemId, grams),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

export function useRemoveMealItem(date: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { mealId: number; itemId: number }>({
    mutationFn: ({ mealId, itemId }) => removeMealItem(mealId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}
