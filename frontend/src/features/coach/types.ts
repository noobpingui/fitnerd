// Mismo shape que espera/devuelve el backend (ver routes/coach_routes.py) - "history" es
// la conversacion completa ANTERIOR a la pregunta nueva, la mantiene el frontend en
// memoria (useState en CoachPage), no hay persistencia del lado del servidor todavia.

import type { AnalysisRequest } from "@/features/body-metrics/types"

export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type CoachMacros = {
  maintenance_kcal: number
  target_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type CoachIndicators = AnalysisRequest["indicators"]

export type CoachPersonalContext = {
  today: string // "YYYY-MM-DD"
  macros: CoachMacros
  indicators: CoachIndicators | null
}

export type AskCoachPayload = {
  question: string
  history: ChatMessage[]
  use_personal_context: boolean
  personal_context?: CoachPersonalContext
}

export type CoachFeedbackRating = "up" | "down"

export type CoachFeedbackPayload = {
  feedback_id: string
  rating: CoachFeedbackRating
}

export type AskCoachResponse = {
  answer: string
  feedback_id: string | null
}

// Mensaje del estado local de la conversación: ChatMessage es lo que viaja como
// historial; feedbackId solo lo usa la UI para mostrar los botones de valoración.
export type ConversationMessage = ChatMessage & {
  feedbackId?: string | null
}
