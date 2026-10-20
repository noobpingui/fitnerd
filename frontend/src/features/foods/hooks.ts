import { useMutation } from "@tanstack/react-query"
import { searchFoods } from "./api"

// Cada búsqueda es una acción puntual: así «Reintentar» repite exactamente la última.
export function useFoodSearch() {
  return useMutation({ mutationFn: (query: string) => searchFoods(query), retry: false })
}
