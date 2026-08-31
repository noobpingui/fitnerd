import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addWeeklyPlanEntry,
  listWeeklyPlan,
  removeWeeklyPlanEntry,
} from "@/features/weekly-plan/api"

export const weeklyPlanKeys = {
  all: ["weekly-plan"] as const,
}

export function useWeeklyPlan() {
  return useQuery({
    queryKey: weeklyPlanKeys.all,
    queryFn: listWeeklyPlan,
  })
}

export function useAddWeeklyPlanEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addWeeklyPlanEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeklyPlanKeys.all })
    },
  })
}

export function useRemoveWeeklyPlanEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeWeeklyPlanEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weeklyPlanKeys.all })
    },
  })
}
