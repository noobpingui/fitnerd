import { ApiError } from "@/lib/apiClient"

export const SAVE_FAILED_MESSAGE = "No se pudo guardar. Vuelve a intentarlo."
export const REMOVE_FAILED_MESSAGE = "No se pudo quitar el alimento. Vuelve a intentarlo."

export function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return error.message
  return SAVE_FAILED_MESSAGE
}

export const ANALYSIS_FAILED_MESSAGE = "No se pudo analizar la foto. Vuelve a intentarlo."
export const NO_FOODS_MESSAGE = "No reconocimos alimentos en la foto."
export type AnalysisErrorView = {
  message: string
  canRetry: boolean
  canChangePhoto: boolean
  canRegisterManually: boolean
}

export function analysisErrorView(_error: unknown): AnalysisErrorView {
  throw new Error("not implemented")
}
