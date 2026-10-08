// Mismo shape que espera/devuelve el backend (ver routes/coach_routes.py) - "history" es
// la conversacion completa ANTERIOR a la pregunta nueva, la mantiene el frontend en
// memoria (useState en CoachPage), no hay persistencia del lado del servidor todavia.

export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type AskCoachPayload = {
  question: string
  history: ChatMessage[]
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

// Mensaje del estado local de la conversacion: ChatMessage es lo que viaja como
// historial; feedbackId solo lo usa la UI para mostrar los botones de valoracion.
export type ConversationMessage = ChatMessage & {
  feedbackId?: string | null
}
