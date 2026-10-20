import { ApiError } from "@/lib/apiClient"

export const SAVE_FAILED_MESSAGE = "No se pudo guardar. Vuelve a intentarlo."
export const REMOVE_FAILED_MESSAGE = "No se pudo quitar el alimento. Vuelve a intentarlo."

export function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return error.message
  return SAVE_FAILED_MESSAGE
}
