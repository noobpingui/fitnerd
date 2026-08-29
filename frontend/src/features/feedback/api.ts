import { apiFetch } from "@/lib/apiClient"
import type { CreateFeedbackPayload, Feedback } from "@/features/feedback/types"

export function createFeedback(payload: CreateFeedbackPayload) {
  return apiFetch<Feedback>("/api/feedback", {
    method: "POST",
    body: payload,
  })
}
