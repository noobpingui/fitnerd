import { apiFetch } from "@/lib/apiClient"
import type { AskCoachPayload, AskCoachResponse } from "@/features/coach/types"

export function askCoach(payload: AskCoachPayload) {
  return apiFetch<AskCoachResponse>("/api/coach/ask", {
    method: "POST",
    body: payload,
  })
}
