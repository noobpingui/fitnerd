import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import type { LibraryFood, RecentFood } from "./types"

export const foodLibraryKeys = {
  all: ["food-library"] as const,
  search: (query: string) => ["food-library", "search", query] as const,
  recent: () => ["food-library", "recent"] as const,
  favorites: () => ["food-library", "favorites"] as const,
}

export function useFoodLibrarySearch(_query: string | null): UseQueryResult<LibraryFood[], Error> {
  throw new Error("not implemented")
}

export function useRecentFoods(): UseQueryResult<RecentFood[], Error> {
  throw new Error("not implemented")
}

export function useFavoriteFoods(): UseQueryResult<LibraryFood[], Error> {
  throw new Error("not implemented")
}

export function useSetFoodFavorite(): UseMutationResult<
  void,
  Error,
  { food: LibraryFood; favorite: boolean }
> {
  throw new Error("not implemented")
}

export function useDeleteCustomFood(): UseMutationResult<void, Error, number> {
  throw new Error("not implemented")
}
