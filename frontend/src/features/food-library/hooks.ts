import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import {
  deleteCustomFood,
  getFavoriteFoods,
  getRecentFoods,
  searchFoodLibrary,
  setFoodFavorite,
} from "./api"
import type { LibraryFood, RecentFood } from "./types"

export const foodLibraryKeys = {
  all: ["food-library"] as const,
  search: (query: string) => ["food-library", "search", query] as const,
  recent: () => ["food-library", "recent"] as const,
  favorites: () => ["food-library", "favorites"] as const,
}

const SEARCH_STALE_MS = 60_000

// La clave lleva la consulta: una respuesta tardía de otra consulta nunca se muestra.
export function useFoodLibrarySearch(query: string | null): UseQueryResult<LibraryFood[], Error> {
  return useQuery({
    queryKey: foodLibraryKeys.search(query ?? ""),
    queryFn: () => searchFoodLibrary(query as string),
    enabled: query !== null,
    retry: false,
    staleTime: SEARCH_STALE_MS,
  })
}

// Se vuelven a pedir cada vez que se montan (staleTime 0).
export function useRecentFoods(): UseQueryResult<RecentFood[], Error> {
  return useQuery({
    queryKey: foodLibraryKeys.recent(),
    queryFn: getRecentFoods,
    retry: false,
    staleTime: 0,
  })
}

export function useFavoriteFoods(): UseQueryResult<LibraryFood[], Error> {
  return useQuery({
    queryKey: foodLibraryKeys.favorites(),
    queryFn: getFavoriteFoods,
    retry: false,
    staleTime: 0,
  })
}

// Sin actualización optimista: onSuccess devuelve la promesa de la invalidación,
// así el botón cambia cuando llegan los datos nuevos.
export function useSetFoodFavorite(): UseMutationResult<
  void,
  Error,
  { food: LibraryFood; favorite: boolean }
> {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { food: LibraryFood; favorite: boolean }>({
    mutationFn: ({ food, favorite }) => setFoodFavorite(food, favorite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodLibraryKeys.all }),
  })
}

// Un 404 cuenta como éxito: el alimento ya no existe, que es lo que se pedía.
export function useDeleteCustomFood(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (customFoodId) => {
      try {
        await deleteCustomFood(customFoodId)
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodLibraryKeys.all }),
  })
}
