import { apiFetch } from "@/lib/apiClient"
import type { Exercise, ExerciseCategory } from "@/features/exercises/types"

// Capa "tonta": solo sabe pedirle datos al backend y devolverlos tipados.
// No sabe nada de cache ni de React - eso lo maneja hooks.ts.
export function listExerciseCategories() {
  return apiFetch<ExerciseCategory[]>("/api/exercise-categories")
}

export function listExercisesByCategory(categoryId: string) {
  return apiFetch<Exercise[]>(
    `/api/exercises?category_id=${encodeURIComponent(categoryId)}`
  )
}

export function listFavorites() {
  return apiFetch<Exercise[]>("/api/favorites")
}

export function addFavorite(exerciseId: string) {
  return apiFetch<void>(`/api/exercises/${exerciseId}/favorites`, {
    method: "POST",
  })
}

export function removeFavorite(exerciseId: string) {
  return apiFetch<void>(`/api/exercises/${exerciseId}/favorites`, {
    method: "DELETE",
  })
}
