import { z } from "zod"

// Valida el voto antes de enviarlo (Art. 7.3).
export const coachFeedbackPayloadSchema = z.object({
  feedback_id: z.string().min(1),
  rating: z.enum(["up", "down"]),
})
