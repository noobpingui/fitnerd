import { useQuery } from "@tanstack/react-query"
import { listExerciseCategories } from "@/features/exercises/api"

// "Query key factory": centraliza las keys de cache de esta feature en un
// solo lugar. Hoy solo tenemos una query, pero cuando agreguemos mutations
// (crear/borrar categoria) van a necesitar invalidar exactamente esta misma
// key para forzar un refetch - tenerla en un solo lugar evita typos como
// ["exercise-categories"] vs ["exerciseCategories"] en dos archivos distintos.
export const exercisesKeys = {
  categories: ["exercise-categories"] as const,
}

export function useExerciseCategories() {
  return useQuery({
    queryKey: exercisesKeys.categories,
    queryFn: listExerciseCategories,
  })
}
