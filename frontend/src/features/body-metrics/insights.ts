import type { BodyMetric } from "@/features/body-metrics/types"
import type { Goal } from "@/features/onboarding/types"

// Indicadores derivados del historial, calculados en el frontend como
// funciones puras (reciben `today` como parámetro).

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

// Número de día entero de una fecha ISO. Con Date.UTC no depende del huso
// horario ni de los cambios de horario de verano.
export function dayNumber(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function daysBetween(a: string, b: string) {
  return dayNumber(b) - dayNumber(a)
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

// Último valor y su cambio frente al registro más reciente con al menos
// `days` días de antigüedad respecto al último (o el primero, si el
// historial es más corto).
export function latestWithDelta(series: SeriesPoint[], days = 30) {
  if (series.length === 0) return null
  const latest = series[series.length - 1]
  const reference =
    [...series].reverse().find((p) => daysBetween(p.date, latest.date) >= days) ??
    series[0]
  return {
    value: latest.value,
    date: latest.date,
    delta: reference === latest ? null : latest.value - reference.value,
  }
}

const RATE_WINDOW_DAYS = 28

// Pendiente (por semana) de una regresión lineal por mínimos cuadrados.
function weeklySlope(points: SeriesPoint[]) {
  const first = points[0].date
  const xs = points.map((p) => daysBetween(first, p.date))
  const ys = points.map((p) => p.value)
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

export type RateIndicator =
  | { kind: "stale" }
  | { kind: "insufficient" }
  | { kind: "ok"; kgPerWeek: number; latestKg: number }

// Ritmo sobre los últimos 28 días. Necesita al menos 3 registros que cubran
// 10 días o más; con menos, cualquier "ritmo" sería ruido. Si el último
// registro de peso tiene más de 28 días, el ritmo ya no es actual.
export function rateIndicator(
  weightSeries: SeriesPoint[],
  today: string
): RateIndicator {
  if (weightSeries.length === 0) return { kind: "insufficient" }
  const last = weightSeries[weightSeries.length - 1]
  if (daysBetween(last.date, today) > RATE_WINDOW_DAYS) return { kind: "stale" }
  const recent = weightSeries.filter(
    (p) => daysBetween(p.date, last.date) <= RATE_WINDOW_DAYS
  )
  if (recent.length < 3 || daysBetween(recent[0].date, last.date) < 10) {
    return { kind: "insufficient" }
  }
  const kgPerWeek = weeklySlope(recent)
  if (kgPerWeek === null) return { kind: "insufficient" }
  return { kind: "ok", kgPerWeek, latestKg: last.value }
}

// Ritmo esperado por meta, en % del peso corporal por semana.
const EXPECTED_RATE: Record<Goal, [number, number]> = {
  lose: [-1.0, -0.5],
  lose_slow: [-0.5, -0.25],
  maintain: [-0.2, 0.2],
  gain_slow: [0.1, 0.25],
  gain: [0.25, 0.5],
}

const EPS = 1e-9

export type PaceStatus = "on_track" | "too_slow" | "too_fast" | "off_range"

export function ratePercent(kgPerWeek: number, latestKg: number): number {
  return (kgPerWeek / latestKg) * 100
}

export function paceStatusFromPercent(pct: number, goal: Goal): PaceStatus {
  const [low, high] = EXPECTED_RATE[goal]
  if (pct >= low - EPS && pct <= high + EPS) return "on_track"
  if (goal === "maintain") return "off_range"
  // "Lento" es quedarse corto en la dirección de la meta (o ir en la
  // contraria); "rápido", pasarse.
  const losing = goal === "lose" || goal === "lose_slow"
  return (losing ? pct > high : pct < low) ? "too_slow" : "too_fast"
}

export type ChartPoint = { date: string; value: number; trend?: number }

// Datos del gráfico desde `fromIso`. La tendencia del peso es el promedio de
// 7 días calculado en kg sobre toda la serie (incluidos los registros
// anteriores al periodo) y convertido al final.
export function trendChartData(
  metrics: BodyMetric[],
  field: NumericField,
  fromIso: string,
  toDisplayWeight: (kg: number) => number
): ChartPoint[] {
  const series = seriesOf(metrics, field)
  const isWeight = field === "weight"
  return series
    .filter((p) => p.date >= fromIso)
    .map((p) => {
      if (!isWeight) return { date: p.date, value: p.value }
      const inWindow = series.filter((q) => {
        const d = daysBetween(q.date, p.date)
        return d >= 0 && d < 7
      })
      const avg = inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length
      return {
        date: p.date,
        value: toDisplayWeight(p.value),
        trend: round1(toDisplayWeight(avg)),
      }
    })
}

// Composición corporal del último registro que tenga peso y % de grasa.
export function composition(metrics: BodyMetric[], heightCm: number | null) {
  const m = [...metrics]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .find((x) => x.weight !== null && x.body_fat_percentage !== null)
  const latestWeight = seriesOf(metrics, "weight").at(-1)?.value
  const heightM2 =
    heightCm !== null && Number.isFinite(heightCm) && heightCm > 0
      ? (heightCm / 100) ** 2
      : null

  const fatKg = m ? (m.weight! * m.body_fat_percentage!) / 100 : null
  const leanKg = m && fatKg !== null ? m.weight! - fatKg : null

  return {
    fatKg,
    leanKg,
    bmi:
      latestWeight !== undefined && heightM2 !== null
        ? latestWeight / heightM2
        : null,
    // FFMI: masa libre de grasa / altura². Mejor que el IMC para quien
    // entrena, porque no confunde músculo con grasa.
    ffmi: leanKg !== null && heightM2 !== null ? leanKg / heightM2 : null,
    date: m?.recorded_at ?? null,
  }
}

// Lunes de la semana de una fecha, como número de día (para comparar).
function weekStart(isoDate: string) {
  const n = dayNumber(isoDate)
  // El día 0 (1970-01-01) fue jueves: (n + 3) % 7 vale 0 en lunes.
  return n - ((((n + 3) % 7) + 7) % 7)
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

export const UNREALISTIC_RATE_PCT = 2

export function rateWindow(_weightSeries: SeriesPoint[]): SeriesPoint[] {
  throw new Error("not implemented")
}

export function isUnrealisticRate(_kgPerWeek: number, _latestKg: number): boolean {
  throw new Error("not implemented")
}

export function median(_values: number[]): number {
  throw new Error("not implemented")
}

export function suspiciousPoint(_window: SeriesPoint[]): SeriesPoint | null {
  throw new Error("not implemented")
}
