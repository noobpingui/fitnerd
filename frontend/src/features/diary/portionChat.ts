import { formatPortionPreview, gramsText } from "./format"
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
    return {
      kind: "estimate",
      grams: estimate.grams,
      unit: estimate.unit,
      note: estimate.note,
      name: estimate.name ?? undefined,
      per100g: estimate.per_100g ?? undefined,
    }
  }
  return { kind: "message", text: estimate.message }
}

export function formatPer100gLine(per100g: PortionPer100g): string {
  return `Por 100 g: ${formatPortionPreview(per100g)}`
}

export function latestEstimateAnswer(turns: PortionChatTurn[]): PortionEstimateAnswer | null {
  const answer = turns.length === 0 ? null : turns[turns.length - 1].answer
  return answer !== null && answer.kind === "estimate" ? answer : null
}

export function portionFoodFormDefaults(answer: PortionEstimateAnswer): CustomFoodFormValues {
  const per100g = answer.per100g
  return {
    name: answer.name ?? "",
    grams: String(answer.grams),
    calories: per100g ? gramsText(per100g.calories_kcal) : "",
    protein: per100g ? gramsText(per100g.protein_g) : "",
    carbs: per100g ? gramsText(per100g.carbs_g) : "",
    fat: per100g ? gramsText(per100g.fat_g) : "",
  }
}
