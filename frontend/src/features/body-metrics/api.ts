import { apiFetch } from "@/lib/apiClient"
import type {
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
  _id: string,
  _payload: UpdateBodyMetricPayload,
): Promise<BodyMetric> {
  throw new Error("not implemented")
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
