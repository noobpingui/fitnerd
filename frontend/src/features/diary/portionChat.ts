import type { PortionChatAnswer, PortionEstimate } from "./types"

export function formatEstimatedGrams(grams: number): string {
  return `Unos ${String(grams)} g`
}

export function portionAnswerFromEstimate(estimate: PortionEstimate): PortionChatAnswer {
  if (estimate.status === "estimated") {
    return { kind: "estimate", grams: estimate.grams, unit: estimate.unit, note: estimate.note }
  }
  return { kind: "message", text: estimate.message }
}
