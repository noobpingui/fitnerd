import { ApiError } from "@/lib/apiClient"

export const SAVE_FAILED_MESSAGE = "No se pudo guardar. Vuelve a intentarlo."
export const REMOVE_FAILED_MESSAGE = "No se pudo quitar el alimento. Vuelve a intentarlo."

export function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return error.message
  return SAVE_FAILED_MESSAGE
}

export const FAVORITE_FAILED_MESSAGE = "No se pudo actualizar tus favoritos."
export const DELETE_CUSTOM_FOOD_FAILED_MESSAGE = "No se pudo borrar el alimento."
export const LIBRARY_LOAD_FAILED_MESSAGE = "No se pudieron cargar tus alimentos."

export function favoriteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return error.message
  return FAVORITE_FAILED_MESSAGE
}

export type UpdateCustomFoodErrorView =
  | { kind: "name_taken" }
  | { kind: "not_found"; message: string }
  | { kind: "message"; message: string }

export function updateCustomFoodErrorView(_error: unknown): UpdateCustomFoodErrorView {
  throw new Error("not implemented")
}

export const ANALYSIS_FAILED_MESSAGE = "No se pudo analizar la foto. Vuelve a intentarlo."
export const NO_FOODS_MESSAGE = "No reconocimos alimentos en la foto."
export type AnalysisErrorView = {
  message: string
  canRetry: boolean
  canChangePhoto: boolean
  canRegisterManually: boolean
}

export function analysisErrorView(error: unknown): AnalysisErrorView {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 413) {
      return {
        message: error.message,
        canRetry: false,
        canChangePhoto: true,
        canRegisterManually: false,
      }
    }
    if (error.status === 429) {
      return {
        message: error.message,
        canRetry: false,
        canChangePhoto: false,
        canRegisterManually: true,
      }
    }
    if (error.status === 503) {
      return {
        message: error.message,
        canRetry: true,
        canChangePhoto: false,
        canRegisterManually: true,
      }
    }
  }
  return {
    message: ANALYSIS_FAILED_MESSAGE,
    canRetry: true,
    canChangePhoto: false,
    canRegisterManually: true,
  }
}

export const DELETE_MEAL_FAILED_MESSAGE = "No se pudo borrar la comida. Vuelve a intentarlo."
export const UNDO_FAILED_MESSAGE = "No se pudo deshacer. Vuelve a intentarlo."

export function undoErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return error.message
  return UNDO_FAILED_MESSAGE
}
