import { useMutation } from "@tanstack/react-query"
import { askCoach, sendCoachFeedback } from "@/features/coach/api"

// mutation, no query: cada pregunta es una accion puntual, no un dato que
// se cachea por key - el "historial" real vive en el estado local de
// CoachPage (un array de mensajes), no en la cache de TanStack Query.
export function useAskCoach() {
  return useMutation({
    mutationFn: askCoach,
  })
}

// Igual que useAskCoach: el voto es una accion puntual, no hay datos que cachear.
export function useSendCoachFeedback() {
  return useMutation({
    mutationFn: sendCoachFeedback,
  })
}
