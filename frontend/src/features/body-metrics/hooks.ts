import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import {
  analyzeBodyMetrics,
  createBodyMetric,
  deleteBodyMetric,
  listBodyMetrics,
  updateBodyMetric,
} from "@/features/body-metrics/api"
import type {
  AnalysisRequest,
  UpdateBodyMetricPayload,
} from "@/features/body-metrics/types"
import { profileKeys } from "@/features/profile/hooks"

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
    // Un registro nuevo cambia el historial completo (y su orden) y puede
    // cambiar el peso del perfil: se recarga todo.
    onSuccess: () => invalidateMetricsAndProfile(queryClient),
  })
}

// Registrar, corregir o borrar una medición cambia también el peso del perfil
// (lo sincroniza el servidor). Se devuelve la promesa para que la mutación siga
// pendiente hasta que las queries activas se recarguen.
function invalidateMetricsAndProfile(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: bodyMetricsKeys.list }),
    queryClient.invalidateQueries({ queryKey: profileKeys.detail }),
  ])
}

export function useUpdateBodyMetric() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateBodyMetricPayload
    }) => updateBodyMetric(id, payload),
    onSuccess: () => invalidateMetricsAndProfile(queryClient),
  })
}

export function useDeleteBodyMetric() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBodyMetric,
    onSuccess: () => invalidateMetricsAndProfile(queryClient),
  })
}

// mutation en vez de query: se dispara con un click de boton, no
// automaticamente al montar la pantalla - ademas no tendria sentido
// cachearlo por queryKey, cada click es una lectura nueva (y potencialmente
// distinta, aunque los datos no hayan cambiado) generada por Claude.
export function useAnalyzeBodyMetrics() {
  return useMutation({
    mutationFn: (request: AnalysisRequest | null) =>
      analyzeBodyMetrics(request),
  })
}
