import type { BodyMetric } from "@/features/body-metrics/types"
import { parseLocalDate } from "@/features/body-metrics/dateUtils"
import type { Goal } from "@/features/onboarding/types"

// TEMPORAL (fase de diseño): indicadores derivados del historial, calculados
// en el frontend. En la fase SDD se decidirá si se quedan aquí o los
// devuelve el backend (el análisis de IA los necesitará también).

const DAY_MS = 24 * 60 * 60 * 1000

export type NumericField =
  | "weight"
  | "body_fat_percentage"
  | "muscle_mass_percentage"

export type SeriesPoint = { date: string; value: number }

// Puntos de un campo en orden cronológico, solo donde ese campo tiene valor.
export function seriesOf(metrics: BodyMetric[], field: NumericField) {
  return metrics
    .filter((m) => m[field] !== null)
    .map((m) => ({ date: m.recorded_at, value: m[field] as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function daysBetween(a: string, b: string) {
  return (parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / DAY_MS
}

// Media móvil de 7 días: para cada registro, el promedio de los registros
// de esa semana hacia atrás. El peso diario sube y baja por agua, sal o
// digestión; la tendencia enseña el cambio real.
export function movingAverage(series: SeriesPoint[], windowDays = 7) {
  return series.map((point) => {
    const inWindow = series.filter((p) => {
      const d = daysBetween(p.date, point.date)
      return d >= 0 && d < windowDays
    })
    const avg = inWindow.reduce((s, p) => s + p.value, 0) / inWindow.length
    return { date: point.date, value: Math.round(avg * 10) / 10 }
  })
}

// Último valor y su cambio frente al registro más cercano a hace `days`
// días (o el primero, si el historial es más corto).
export function latestWithDelta(series: SeriesPoint[], days = 30) {
  if (series.length === 0) return null
  const latest = series[series.length - 1]
  const cutoff = parseLocalDate(latest.date).getTime() - days * DAY_MS
  const reference =
    [...series].reverse().find((p) => parseLocalDate(p.date).getTime() <= cutoff) ??
    series[0]
  return {
    value: latest.value,
    date: latest.date,
    delta: reference === latest ? null : latest.value - reference.value,
  }
}

// Ritmo en kg/semana: pendiente de una regresión lineal sobre los últimos
// 28 días. Necesita al menos 3 registros que cubran 10 días o más; con
// menos, cualquier "ritmo" sería ruido.
export function weeklyRate(series: SeriesPoint[], windowDays = 28) {
  if (series.length === 0) return null
  const last = series[series.length - 1].date
  const recent = series.filter((p) => daysBetween(p.date, last) <= windowDays)
  if (recent.length < 3 || daysBetween(recent[0].date, last) < 10) return null

  const xs = recent.map((p) => daysBetween(recent[0].date, p.date))
  const ys = recent.map((p) => p.value)
  const meanX = xs.reduce((s, x) => s + x, 0) / xs.length
  const meanY = ys.reduce((s, y) => s + y, 0) / ys.length
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - meanX) * (ys[i] - meanY)
    den += (x - meanX) ** 2
  })
  return den === 0 ? null : (num / den) * 7
}

// Ritmo esperado por meta, en % del peso corporal por semana. Valores
// orientativos y provisionales (se revisarán en la fase SDD).
const EXPECTED_RATE: Record<Goal, [number, number]> = {
  lose: [-1.0, -0.5],
  lose_slow: [-0.5, -0.25],
  maintain: [-0.2, 0.2],
  gain_slow: [0.1, 0.25],
  gain: [0.25, 0.5],
}

export type PaceStatus = "on_track" | "too_slow" | "too_fast"

export function paceStatus(
  rateKgPerWeek: number,
  weightKg: number,
  goal: Goal
): PaceStatus {
  const pct = (rateKgPerWeek / weightKg) * 100
  const [low, high] = EXPECTED_RATE[goal]
  if (pct >= low && pct <= high) return "on_track"
  // "Lento" es quedarse corto en la dirección de la meta; "rápido",
  // pasarse. En mantener, cualquier desvío cuenta como "rápido".
  if (goal === "maintain") return "too_fast"
  const losing = goal === "lose" || goal === "lose_slow"
  return (losing ? pct > high : pct < low) ? "too_slow" : "too_fast"
}

// Composición corporal del último registro que tenga peso y % de grasa.
export function composition(metrics: BodyMetric[], heightCm: number) {
  const m = [...metrics]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .find((x) => x.weight !== null && x.body_fat_percentage !== null)
  const latestWeight = seriesOf(metrics, "weight").at(-1)?.value
  const heightM2 = (heightCm / 100) ** 2

  const fatKg = m ? (m.weight! * m.body_fat_percentage!) / 100 : null
  const leanKg = m && fatKg !== null ? m.weight! - fatKg : null

  return {
    fatKg,
    leanKg,
    bmi: latestWeight ? latestWeight / heightM2 : null,
    // FFMI: masa libre de grasa / altura². Mejor que el IMC para quien
    // entrena, porque no confunde músculo con grasa.
    ffmi: leanKg !== null ? leanKg / heightM2 : null,
    date: m?.recorded_at ?? null,
  }
}

// Lunes de la semana de una fecha, como número de día (para comparar).
function weekStart(isoDate: string) {
  const d = parseLocalDate(isoDate)
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Math.round(monday.getTime() / DAY_MS)
}

// Racha: semanas seguidas (de lunes a domingo) con al menos un registro,
// contando hacia atrás desde esta semana. Si esta semana aún no hay
// registro, la racha sigue viva si la semana pasada sí lo tuvo.
export function streak(metrics: BodyMetric[], today: string) {
  const weeks = new Set(metrics.map((m) => weekStart(m.recorded_at)))
  let current = weekStart(today)
  if (!weeks.has(current)) current -= 7
  let count = 0
  while (weeks.has(current)) {
    count += 1
    current -= 7
  }

  const last30 = metrics.filter((m) => {
    const d = daysBetween(m.recorded_at, today)
    return d >= 0 && d <= 30
  }).length

  const lastDate = metrics.reduce<string | null>(
    (max, m) => (max === null || m.recorded_at > max ? m.recorded_at : max),
    null
  )

  return { weeks: count, last30, total: metrics.length, lastDate }
}
