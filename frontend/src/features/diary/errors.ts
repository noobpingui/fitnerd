import { ApiError } from "@/lib/apiClient"
import type { PortionChatAnswer } from "./types"

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

export const CUSTOM_FOOD_NAME_TAKEN_MESSAGE = "Ya tienes un alimento con ese nombre."
export const UPDATE_CUSTOM_FOOD_FAILED_MESSAGE = "No se pudo guardar el alimento."
export const CUSTOM_FOOD_NOT_FOUND_MESSAGE = "No encontramos ese alimento."

export type UpdateCustomFoodErrorView =
  | { kind: "name_taken" }
  | { kind: "not_found"; message: string }
  | { kind: "message"; message: string }

export function updateCustomFoodErrorView(error: unknown): UpdateCustomFoodErrorView {
  if (error instanceof ApiError) {
    if (error.status === 409) return { kind: "name_taken" }
    if (error.status === 404) return { kind: "not_found", message: CUSTOM_FOOD_NOT_FOUND_MESSAGE }
    if (error.status === 400) return { kind: "message", message: error.message }
  }
  return { kind: "message", message: UPDATE_CUSTOM_FOOD_FAILED_MESSAGE }
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

export const PORTION_ESTIMATE_FAILED_MESSAGE = "No se pudo estimar el peso. Vuelve a intentarlo."

export function portionEstimateErrorAnswer(
  error: unknown
): Extract<PortionChatAnswer, { kind: "notice" | "error" }> {
  if (error instanceof ApiError) {
    if (error.status === 429) return { kind: "notice", text: error.message }
    if (error.status === 400 || error.status === 503) return { kind: "error", text: error.message }
  }
  return { kind: "error", text: PORTION_ESTIMATE_FAILED_MESSAGE }
}
