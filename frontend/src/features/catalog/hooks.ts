import { useMutation } from "@tanstack/react-query"
import { searchCatalog } from "./api"

// Cada búsqueda es una acción puntual: así «Reintentar» repite exactamente la última.
export function useCatalogSearch() {
  return useMutation({ mutationFn: (query: string) => searchCatalog(query), retry: false })
}
