import { apiFetch } from "@/lib/apiClient"
import type { ExerciseCategory } from "@/features/exercises/types"

// Capa "tonta": solo sabe pedirle datos al backend y devolverlos tipados.
// No sabe nada de cache ni de React - eso lo maneja hooks.ts.
export function listExerciseCategories() {
  return apiFetch<ExerciseCategory[]>("/api/exercise-categories")
}
