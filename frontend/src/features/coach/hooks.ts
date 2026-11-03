import { useCallback, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { askCoach, sendCoachFeedback } from "@/features/coach/api"
import {
  readPersonalContextPreference,
  writePersonalContextPreference,
} from "@/features/coach/personalContextPreference"

// mutation, no query: cada pregunta es una accion puntual, no un dato que
// se cachea por key - el "historial" real vive en el estado local de
// CoachPage (un array de mensajes), no en la cache de TanStack Query.
export function useAskCoach() {
  return useMutation({
    mutationFn: askCoach,
  })
}

// Interruptor de datos personales (spec 034): se recuerda en este navegador.
export function usePersonalContextPreference(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(readPersonalContextPreference)
  const update = useCallback((next: boolean) => {
    setEnabled(next)
    writePersonalContextPreference(next)
  }, [])
  return [enabled, update]
}

// Igual que useAskCoach: el voto es una accion puntual, no hay datos que cachear.
export function useSendCoachFeedback() {
  return useMutation({
    mutationFn: sendCoachFeedback,
  })
}
