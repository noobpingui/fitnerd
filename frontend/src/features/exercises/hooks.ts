import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addFavorite,
  listBodyRegions,
  listExerciseCategories,
  listExercisesByCategory,
  listFavorites,
  removeFavorite,
} from "@/features/exercises/api"

// "Query key factory": centraliza las keys de cache de esta feature en un
// solo lugar, para no repetir strings sueltos por distintos archivos.
// byRegion/byCategory son FUNCIONES porque cada region/categoria tiene su
// propia entrada de cache - las categorias de "Tren Superior" y las de
// "Tren Inferior" no deben pisarse entre si (mismo criterio ya aplicado a
// byCategory para los ejercicios).
export const exercisesKeys = {
  regions: ["body-regions"] as const,
  categoriesByRegion: (regionId: string) =>
    ["exercise-categories", "by-region", regionId] as const,
  byCategory: (categoryId: string) =>
    ["exercises", "by-category", categoryId] as const,
  favorites: ["favorites"] as const,
}

export function useBodyRegions() {
  return useQuery({
    queryKey: exercisesKeys.regions,
    queryFn: listBodyRegions,
  })
}

export function useExerciseCategories(regionId: string) {
  return useQuery({
    queryKey: exercisesKeys.categoriesByRegion(regionId),
    queryFn: () => listExerciseCategories(regionId),
  })
}

export function useExercisesByCategory(categoryId: string) {
  return useQuery({
    queryKey: exercisesKeys.byCategory(categoryId),
    queryFn: () => listExercisesByCategory(categoryId),
  })
}

export function useFavorites() {
  return useQuery({
    queryKey: exercisesKeys.favorites,
    queryFn: listFavorites,
  })
}

export function useAddFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addFavorite,
    // Al agregar un favorito, la cache de "favorites" que ya tenemos
    // guardada quedo desactualizada. invalidateQueries la marca como
    // "stale" -> TanStack Query la vuelve a pedir sola, y cualquier
    // pantalla que este usando useFavorites() se actualiza automaticamente.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exercisesKeys.favorites })
    },
  })
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exercisesKeys.favorites })
    },
  })
}
