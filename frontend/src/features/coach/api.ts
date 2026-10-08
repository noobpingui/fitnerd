import { apiFetch } from "@/lib/apiClient"
import type {
  AskCoachPayload,
  AskCoachResponse,
  CoachFeedbackPayload,
} from "@/features/coach/types"

export function sendCoachFeedback(_payload: CoachFeedbackPayload): Promise<void> {
  throw new Error("not implemented")
}

export function askCoach(payload: AskCoachPayload) {
  return apiFetch<AskCoachResponse>("/api/coach/ask", {
    method: "POST",
    body: payload,
  })
}
