import { apiFetch } from "@/lib/apiClient"
import type {
  BodyRegion,
  Exercise,
  ExerciseCategory,
} from "@/features/exercises/types"

// Capa "tonta": solo sabe pedirle datos al backend y devolverlos tipados.
// No sabe nada de cache ni de React - eso lo maneja hooks.ts.
export function listBodyRegions() {
  return apiFetch<BodyRegion[]>("/api/body-regions")
}

// body_region_id es obligatorio del lado del backend (ver
// exercise_category_routes.py) - refleja que toda categoria vive dentro de
// una region, no hay forma de listarlas todas "sueltas".
export function listExerciseCategories(bodyRegionId: string) {
  return apiFetch<ExerciseCategory[]>(
    `/api/exercise-categories?body_region_id=${encodeURIComponent(bodyRegionId)}`
  )
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
