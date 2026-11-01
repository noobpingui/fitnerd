import type { CustomFoodFormValues } from "./schemas"
import type {
  PortionChatAnswer,
  PortionChatTurn,
  PortionEstimate,
  PortionEstimateAnswer,
  PortionPer100g,
} from "./types"

export function formatEstimatedGrams(grams: number): string {
  return `Unos ${String(grams)} g`
}

export function portionAnswerFromEstimate(estimate: PortionEstimate): PortionChatAnswer {
  if (estimate.status === "estimated") {
    return { kind: "estimate", grams: estimate.grams, unit: estimate.unit, note: estimate.note }
  }
  return { kind: "message", text: estimate.message }
}

export function formatPer100gLine(_per100g: PortionPer100g): string {
  throw new Error("not implemented")
}

export function latestEstimateAnswer(_turns: PortionChatTurn[]): PortionEstimateAnswer | null {
  throw new Error("not implemented")
}

export function portionFoodFormDefaults(_answer: PortionEstimateAnswer): CustomFoodFormValues {
  throw new Error("not implemented")
}
