import type { UseMutationResult } from "@tanstack/react-query"
import type { CatalogSearchResponse } from "./types"

export function useCatalogSearch(): UseMutationResult<CatalogSearchResponse, Error, string> {
  throw new Error("not implemented")
}
