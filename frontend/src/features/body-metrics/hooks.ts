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
    // Un registro nuevo cambia el historial completo (y su orden) - la
    // forma mas simple y confiable de mantener la lista al dia es pedirle
    // a TanStack Query que la vuelva a traer, en vez de intentar insertar
    // el nuevo registro "a mano" en la cache existente.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bodyMetricsKeys.list })
    },
  })
}

// Corregir o borrar una medición cambia también el peso del perfil (lo
// sincroniza el servidor). Se devuelve la promesa para que la mutación siga
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
