import { useMutation } from "@tanstack/react-query"
import { askCoach } from "@/features/coach/api"

// mutation, no query: cada pregunta es una accion puntual, no un dato que
// se cachea por key - el "historial" real vive en el estado local de
// CoachPage (un array de mensajes), no en la cache de TanStack Query.
export function useAskCoach() {
  return useMutation({
    mutationFn: askCoach,
  })
}
