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

export type AskCoachResponse = {
  answer: string
}
