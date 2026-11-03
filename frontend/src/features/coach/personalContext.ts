import { buildAnalysisRequest } from "@/features/body-metrics/analysisRequest"
import type { BodyMetric } from "@/features/body-metrics/types"
import { calculateMacros } from "@/features/macros/calculations"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import type { CoachPersonalContext } from "@/features/coach/types"
import { parseLocalDate } from "@/lib/dates"

// Calorías, macros e indicadores con las mismas funciones y el mismo día que
// pintan /home y Métricas (spec 034, ADR-0038). Las calorías van siempre en
// kcal, sin depender del selector kJ de /home.
export function buildCoachPersonalContext(
  metrics: BodyMetric[],
  profile: OnboardingAnswers,
  today: string
): CoachPersonalContext {
  const summary = calculateMacros(profile, parseLocalDate(today))
  const grams = (key: "protein" | "carbs" | "fat") =>
    summary.macros.find((m) => m.key === key)?.grams ?? 0

  return {
    today,
    macros: {
      maintenance_kcal: summary.maintenanceKcal,
      target_kcal: summary.targetKcal,
      protein_g: grams("protein"),
      carbs_g: grams("carbs"),
      fat_g: grams("fat"),
    },
    indicators:
      metrics.length > 0 ? buildAnalysisRequest(metrics, profile, today).indicators : null,
  }
}
