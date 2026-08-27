import { apiFetch } from "@/lib/apiClient"
import type {
  BodyMetric,
  CreateBodyMetricPayload,
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

export function deleteBodyMetric(id: string) {
  return apiFetch<void>(`/api/body-metrics/${id}`, { method: "DELETE" })
}

// POST porque dispara una accion real (llama a Claude del lado del
// backend) - no es un simple GET idempotente/cacheable.
export function analyzeBodyMetrics() {
  return apiFetch<{ analysis: string }>("/api/body-metrics/analysis", {
    method: "POST",
  })
}
