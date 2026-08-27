import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  analyzeBodyMetrics,
  createBodyMetric,
  deleteBodyMetric,
  listBodyMetrics,
} from "@/features/body-metrics/api"

export const bodyMetricsKeys = {
  list: ["body-metrics"] as const,
}

export function useBodyMetrics() {
  return useQuery({
    queryKey: bodyMetricsKeys.list,
    queryFn: listBodyMetrics,
  })
}

export function useCreateBodyMetric() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBodyMetric,
    // Un registro nuevo cambia el historial completo (y su orden) - la
    // forma mas simple y confiable de mantener la lista al dia es pedirle
    // a TanStack Query que la vuelva a traer, en vez de intentar insertar
    // el nuevo registro "a mano" en la cache existente.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bodyMetricsKeys.list })
    },
  })
}

export function useDeleteBodyMetric() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBodyMetric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bodyMetricsKeys.list })
    },
  })
}

// mutation en vez de query: se dispara con un click de boton, no
// automaticamente al montar la pantalla - ademas no tendria sentido
// cachearlo por queryKey, cada click es una lectura nueva (y potencialmente
// distinta, aunque los datos no hayan cambiado) generada por Claude.
export function useAnalyzeBodyMetrics() {
  return useMutation({
    mutationFn: analyzeBodyMetrics,
  })
}
