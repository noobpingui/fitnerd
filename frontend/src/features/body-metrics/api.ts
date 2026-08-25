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
