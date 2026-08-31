import { apiFetch } from "@/lib/apiClient"
import type {
  AddWeeklyPlanEntryPayload,
  WeeklyPlanEntry,
} from "@/features/weekly-plan/types"

export function listWeeklyPlan() {
  return apiFetch<WeeklyPlanEntry[]>("/api/weekly-plan")
}

export function addWeeklyPlanEntry(payload: AddWeeklyPlanEntryPayload) {
  return apiFetch<WeeklyPlanEntry>("/api/weekly-plan", {
    method: "POST",
    body: payload,
  })
}

export function removeWeeklyPlanEntry(entryId: string) {
  return apiFetch<void>(`/api/weekly-plan/${entryId}`, {
    method: "DELETE",
  })
}
