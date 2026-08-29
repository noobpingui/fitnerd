import { useMutation } from "@tanstack/react-query"
import { createFeedback } from "@/features/feedback/api"

// Sin queryKey/invalidacion como en body-metrics: no existe (todavia) ninguna
// pantalla que liste el feedback enviado, asi que no hay cache que mantener
// al dia despues de un envio exitoso.
export function useCreateFeedback() {
  return useMutation({
    mutationFn: createFeedback,
  })
}
