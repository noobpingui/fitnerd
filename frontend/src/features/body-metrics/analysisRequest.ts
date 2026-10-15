import { buildInsights, formatInsights } from "@/features/body-metrics/insightsView"
import type { AnalysisRequest, BodyMetric } from "@/features/body-metrics/types"
import { calculateMacros } from "@/features/macros/calculations"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import { parseLocalDate } from "@/lib/dates"

// Arma el cuerpo de POST /api/body-metrics/analysis con los mismos textos que
// pinta Métricas y las mismas calorías que muestra Macros (ADR-0021).
export function buildAnalysisRequest(
  metrics: BodyMetric[],
  profile: OnboardingAnswers,
  today: string
): AnalysisRequest {
  const insights = buildInsights(metrics, profile, today)
  const text = formatInsights(insights, profile.weightUnit)
  const macros = calculateMacros(profile, parseLocalDate(today))

  const { rate } = insights
  const sentRate = rate.kind === "ok" && insights.paceStatus !== null ? rate : null

  return {
    today,
    indicators: {
      weight: text.weight,
      weight_change_30d: text.weightChange30d,
      body_fat: text.bodyFat,
      body_fat_change_30d: text.bodyFatChange30d,
      rate: text.rate,
      pace_status: insights.paceStatus ?? "insufficient",
      fat_mass: text.fatMass,
      lean_mass: text.leanMass,
      bmi: text.bmi,
      ffmi: text.ffmi,
      streak_weeks: insights.streak.weeks,
      records_last_30_days: insights.streak.last30,
      total_records: insights.streak.total,
      last_record_date: insights.streak.lastDate,
    },
    rate_kg_per_week: sentRate?.kgPerWeek ?? null,
    latest_weight_kg: sentRate?.latestKg ?? null,
    calories: {
      maintenance_kcal: macros.maintenanceKcal,
      target_kcal: macros.targetKcal,
    },
  }
}
