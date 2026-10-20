export const SEARCH_FAILED_MESSAGE = "No se pudo completar la búsqueda."

export function searchErrorView(_error: unknown): { message: string; canRetry: boolean } {
  throw new Error("not implemented")
}
