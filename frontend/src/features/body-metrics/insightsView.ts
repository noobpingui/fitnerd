import type { BodyMetric, PaceStatusCode } from "@/features/body-metrics/types"
import {
  composition,
  latestWithDelta,
  paceStatusFromPercent,
  ratePercent,
  rateIndicator,
  seriesOf,
  streak,
  type PaceStatus,
} from "@/features/body-metrics/insights"
import type {
  OnboardingAnswers,
  WeightUnit,
} from "@/features/onboarding/types"
import { KG_PER_LB, heightCmFromAnswers } from "@/features/onboarding/units"

// Cálculo y formato de los indicadores de Métricas. La página los pinta y el
// análisis de IA recibe exactamente los mismos textos (ADR-0021).

const one = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 })
const signed = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

type Tone = "good" | "warn" | "muted"

export const PACE_COPY: Record<PaceStatus, { label: string; tone: "good" | "warn" }> = {
  on_track: { label: "En ritmo con tu meta", tone: "good" },
  too_slow: { label: "Más lento que tu meta", tone: "warn" },
  too_fast: { label: "Más rápido que tu meta", tone: "warn" },
  off_range: { label: "Fuera del rango de tu meta", tone: "warn" },
}

const NO_RATE_COPY = {
  stale: "Sin registros recientes",
  insufficient: "Faltan registros para calcularlo",
} as const

export function buildInsights(
  metrics: BodyMetric[],
  profile: OnboardingAnswers | null,
  today: string
) {
  const heightCm = profile ? heightCmFromAnswers(profile) : null
  const weight = seriesOf(metrics, "weight")
  const rate = rateIndicator(weight, today)
  const goal = profile?.goal

  let paceStatus: PaceStatusCode | null = null
  if (rate.kind === "stale") {
    paceStatus = "stale"
  } else if (rate.kind === "insufficient") {
    paceStatus = "insufficient"
  } else if (goal) {
    paceStatus = paceStatusFromPercent(
      ratePercent(rate.kgPerWeek, rate.latestKg),
      goal
    )
  }

  return {
    weight: latestWithDelta(weight),
    fat: latestWithDelta(seriesOf(metrics, "body_fat_percentage")),
    rate,
    paceStatus,
    composition: composition(metrics, heightCm),
    streak: streak(metrics, today),
  }
}

export type Insights = ReturnType<typeof buildInsights>

// Lo que acepta formatInsights: el resultado de buildInsights (el estado de
// ritmo llega tipado como texto en algunos llamadores de los tests).
type InsightsInput = Insights | { paceStatus: string | null }

// Textos de las tarjetas; `null` donde la pantalla pinta "—".
export function formatInsights(input: InsightsInput, weightUnit: WeightUnit) {
  const insights = input as Insights
  // El backend guarda el peso en kg; se muestra en la unidad del perfil.
  const toDisplayWeight = (kg: number) =>
    weightUnit === "lb" ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg
  const mass = (kg: number | null) =>
    kg !== null ? `${one.format(toDisplayWeight(kg))} ${weightUnit}` : null
  const decimal = (value: number | null) =>
    value !== null ? one.format(value) : null

  let statusLabel: string | null = null
  let tone: Tone | null = null
  const status = insights.paceStatus
  if (status === "stale" || status === "insufficient") {
    statusLabel = NO_RATE_COPY[status]
    tone = "muted"
  } else if (status) {
    statusLabel = PACE_COPY[status].label
    tone = PACE_COPY[status].tone
  }

  const weightDelta = insights.weight?.delta
  const fatDelta = insights.fat?.delta

  return {
    weight: mass(insights.weight?.value ?? null),
    weightChange30d:
      weightDelta != null
        ? `${signed.format(toDisplayWeight(weightDelta))} ${weightUnit}`
        : null,
    rate:
      insights.rate.kind === "ok"
        ? `${signed.format(toDisplayWeight(insights.rate.kgPerWeek))} ${weightUnit}/sem`
        : null,
    bodyFat: insights.fat ? `${one.format(insights.fat.value)} %` : null,
    bodyFatChange30d:
      fatDelta != null ? `${signed.format(fatDelta)} pts` : null,
    fatMass: mass(insights.composition.fatKg),
    leanMass: mass(insights.composition.leanKg),
    bmi: decimal(insights.composition.bmi),
    ffmi: decimal(insights.composition.ffmi),
    statusLabel,
    tone,
  }
}

export type FormattedInsights = ReturnType<typeof formatInsights>
