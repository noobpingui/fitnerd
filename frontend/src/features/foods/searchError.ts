import { ApiError } from "@/lib/apiClient"

export const SEARCH_FAILED_MESSAGE = "No se pudo completar la búsqueda."

export function searchErrorView(error: unknown): { message: string; canRetry: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 429) return { message: error.message, canRetry: false }
    if (error.status === 503) return { message: error.message, canRetry: true }
  }
  return { message: SEARCH_FAILED_MESSAGE, canRetry: true }
}
