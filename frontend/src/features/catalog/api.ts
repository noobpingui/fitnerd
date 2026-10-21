import { apiFetch } from "@/lib/apiClient"
import { catalogSearchResponseSchema } from "./schemas"
import type { CatalogSearchResponse } from "./types"

export async function searchCatalog(query: string): Promise<CatalogSearchResponse> {
  const params = new URLSearchParams({ q: query })
  return catalogSearchResponseSchema.parse(
    await apiFetch<unknown>(`/api/catalog/search?${params}`)
  )
}
