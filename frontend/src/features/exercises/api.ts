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

// bodyRegionId es opcional: con el, filtra por region (nivel 2 del
// catalogo, ver CategoriesPage). Sin el, el backend devuelve TODAS las
// categorias activas - lo usa FavoritesPage para agrupar favoritos por
// categoria sin tener que conocer de antemano la region de cada uno.
export function listExerciseCategories(bodyRegionId?: string) {
  const query = bodyRegionId
    ? `?body_region_id=${encodeURIComponent(bodyRegionId)}`
    : ""
  return apiFetch<ExerciseCategory[]>(`/api/exercise-categories${query}`)
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
