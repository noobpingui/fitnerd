import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query"
import {
  addMealItems,
  analyzeMealPhoto,
  getDiary,
  removeMealItem,
  updateMealItemGrams,
} from "./api"
import type { AddMealItemsPayload, Meal, MealPhotoAnalysis, RemovalUndo } from "./types"

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
  return useMutation<MealPhotoAnalysis, Error, Blob>({
    mutationFn: (image) => analyzeMealPhoto(image),
    retry: false,
  })
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
  return useMutation<string | null, Error, { mealId: number; itemId: number }>({
    mutationFn: ({ mealId, itemId }) => removeMealItem(mealId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

export function useRestoreMealItem(_date: string): UseMutationResult<Meal, Error, string> {
  throw new Error("not implemented")
}

export function useDeleteMeal(_date: string): UseMutationResult<void, Error, number> {
  throw new Error("not implemented")
}

export function useToday(_paused?: boolean, _intervalMs?: number): string {
  throw new Error("not implemented")
}

export type RemovalUndoState = {
  notice: RemovalUndo | null
  offer: (notice: RemovalUndo | null) => void
  undo: () => void
  isRestoring: boolean
  error: string | null
}

export function useRemovalUndo(_date: string, _durationMs?: number): RemovalUndoState {
  throw new Error("not implemented")
}
