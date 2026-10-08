import { apiFetch } from "@/lib/apiClient"
import { coachFeedbackPayloadSchema } from "@/features/coach/schemas"
import type {
  AskCoachPayload,
  AskCoachResponse,
  CoachFeedbackPayload,
} from "@/features/coach/types"

export function sendCoachFeedback(payload: CoachFeedbackPayload) {
  const body = coachFeedbackPayloadSchema.parse(payload)
  return apiFetch<void>("/api/coach/feedback", {
    method: "POST",
    body,
  })
}

export function askCoach(payload: AskCoachPayload) {
  return apiFetch<AskCoachResponse>("/api/coach/ask", {
    method: "POST",
    body: payload,
  })
}
