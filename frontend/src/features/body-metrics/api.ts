import { apiFetch } from "@/lib/apiClient"
import {
  analysisRequestSchema,
  analysisResponseSchema,
} from "@/features/body-metrics/schemas"
import type {
  AnalysisRequest,
  AnalysisResponse,
  BodyMetric,
  CreateBodyMetricPayload,
  UpdateBodyMetricPayload,
} from "@/features/body-metrics/types"

export function listBodyMetrics() {
  return apiFetch<BodyMetric[]>("/api/body-metrics")
}

export function createBodyMetric(payload: CreateBodyMetricPayload) {
  return apiFetch<BodyMetric>("/api/body-metrics", {
    method: "POST",
    body: payload,
  })
}

export function updateBodyMetric(
  id: string,
  payload: UpdateBodyMetricPayload
) {
  return apiFetch<BodyMetric>(`/api/body-metrics/${id}`, {
    method: "PUT",
    body: payload,
  })
}

export function deleteBodyMetric(id: string) {
  return apiFetch<void>(`/api/body-metrics/${id}`, { method: "DELETE" })
}

// POST porque dispara una acción real (llama a Claude del lado del
// backend): no es un simple GET idempotente o cacheable. El cuerpo lleva el
// contexto que ya calcula la pantalla; sin perfil se envía sin cuerpo y el
// servidor responde 409.
export async function analyzeBodyMetrics(
  request: AnalysisRequest | null
): Promise<AnalysisResponse> {
  const body =
    request === null ? undefined : analysisRequestSchema.parse(request)
  return analysisResponseSchema.parse(
    await apiFetch<unknown>("/api/body-metrics/analysis", {
      method: "POST",
      body,
    })
  )
}
