// Tests UNITARIOS puros de insightsView (spec 010): el cálculo y el formato de
// los indicadores de Métricas que la página pinta y que el análisis de IA
// recibe. Sin React ni red; "hoy" se pasa como argumento (lunes 12 de octubre
// de 2026).
import { describe, expect, it } from "vitest"
import { formatDate } from "./dateUtils"
import { buildInsights, formatInsights } from "./insightsView"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { OnboardingAnswers, WeightUnit } from "@/features/onboarding/types"
import { makeAnswers } from "@/test/profileFixtures"

const TODAY = "2026-10-12"

function m(
  recorded_at: string,
  weight: number | null,
  fat: number | null = null
): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: fat,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

// Perfil base de la spec 010: hombre de 30 años, 180 cm, actividad alta, meta
// perder peso. El peso del perfil es el de la última medición.
const PROFILE = makeAnswers({
  gender: "male",
  dateOfBirth: "1996-10-12",
  heightCm: "180",
  weight: "79.4",
  activityLevel: "high",
  goal: "lose",
})

// Mediciones "más lento": -0,2 kg/sem.
const SLOWER = [
  m("2026-09-20", 80),
  m("2026-09-27", 79.8),
  m("2026-10-04", 79.6),
  m("2026-10-11", 79.4),
]
// Mediciones "en ritmo": -0,5 kg/sem, con 20 % de grasa en la última.
const ON_TRACK = [
  m("2026-09-20", 80),
  m("2026-09-27", 79.5),
  m("2026-10-04", 79),
  m("2026-10-11", 78.5, 20),
]

function view(
  metrics: BodyMetric[],
  profile: OnboardingAnswers | null = PROFILE,
  unit: WeightUnit = "kg"
) {
  const insights = buildInsights(metrics, profile, TODAY)
  const text = formatInsights(insights, unit)
  return { insights, text }
}

describe("insightsView", () => {
  // SDD: REQ-002 AC-002.1
  it("da el peso, su cambio en 30 días, el ritmo y el estado 'too_slow'", () => {
    const { insights, text } = view(SLOWER)

    expect(text.weight).toBe("79,4 kg")
    expect(text.weightChange30d).toBe("-0,6 kg")
    expect(text.rate).toBe("-0,2 kg/sem")
    expect(insights.paceStatus).toBe("too_slow")
    expect(text.statusLabel).toBe("Más lento que tu meta")
  })

  // SDD: REQ-002 AC-002.2
  it("da el estado 'on_track' y la composición corporal del último registro", () => {
    const { insights, text } = view(ON_TRACK)

    expect(insights.paceStatus).toBe("on_track")
    expect(text.statusLabel).toBe("En ritmo con tu meta")
    expect(text.bodyFat).toBe("20 %")
    expect(text.fatMass).toBe("15,7 kg")
    expect(text.leanMass).toBe("62,8 kg")
    expect(text.bmi).toBe("24,2")
    expect(text.ffmi).toBe("19,4")
    // Un solo registro con grasa: no hay cambio en 30 días que mostrar.
    expect(text.bodyFatChange30d).toBeNull()
  })

  // SDD: REQ-002 AC-002.3
  it("con pocos registros no hay ritmo y el estado es 'insufficient'", () => {
    const metrics = [
      m("2026-10-02", 80),
      m("2026-10-06", 79.8),
      m("2026-10-11", 79.6),
    ]

    const { insights, text } = view(metrics)

    expect(insights.paceStatus).toBe("insufficient")
    expect(text.rate).toBeNull()
    expect(text.statusLabel).toBe("Faltan registros para calcularlo")
  })

  // SDD: REQ-002 AC-002.4
  it("con el último peso de hace más de 28 días el estado es 'stale'", () => {
    const metrics = [
      m("2026-08-17", 82),
      m("2026-08-24", 81.5),
      m("2026-09-07", 81),
    ]

    const { insights, text } = view(metrics)

    expect(insights.paceStatus).toBe("stale")
    expect(text.rate).toBeNull()
    expect(text.statusLabel).toBe("Sin registros recientes")
  })

  // SDD: REQ-002 AC-002.5
  it("con solo peso, grasa y composición quedan en null", () => {
    const { text } = view(SLOWER)

    expect(text.bodyFat).toBeNull()
    expect(text.bodyFatChange30d).toBeNull()
    expect(text.fatMass).toBeNull()
    expect(text.leanMass).toBeNull()
    expect(text.ffmi).toBeNull()
    // El IMC solo necesita el peso y la altura.
    expect(text.bmi).not.toBeNull()
  })

  // SDD: REQ-002 AC-002.6
  it("el estado de ritmo existe aunque haya solo tres registros recientes", () => {
    const metrics = [
      m("2026-10-12", 79.4),
      m("2026-10-05", 79.7),
      m("2026-09-28", 80),
    ]

    const { insights } = view(metrics)

    expect(["on_track", "too_slow", "too_fast", "off_range"]).toContain(
      insights.paceStatus
    )
  })

  // SDD: REQ-002 AC-002.7
  it("con el perfil en lb da el peso y el ritmo en lb", () => {
    const profile = makeAnswers({
      gender: "male",
      dateOfBirth: "1996-10-12",
      heightCm: "180",
      weightUnit: "lb",
      weight: "175.05",
      activityLevel: "high",
      goal: "lose",
    })

    const { text } = view(SLOWER, profile, "lb")

    expect(text.weight).toBe("175 lb")
    expect(text.rate).toBe("-0,4 lb/sem")
  })

  // SDD: REQ-002 AC-002.1
  it("sin perfil no hay estado de meta pero el ritmo sigue calculándose", () => {
    const { insights, text } = view(SLOWER, null)

    expect(insights.paceStatus).toBeNull()
    expect(text.rate).toBe("-0,2 kg/sem")
  })
})

// --- Spec 011: ritmo poco realista ---

const JUMP_UP = [m("2026-10-01", 80), m("2026-10-06", 80), m("2026-10-11", 98)]
const JUMP_DOWN = [m("2026-10-01", 98), m("2026-10-06", 80), m("2026-10-11", 80)]
const LIMIT = [m("2026-09-27", 96), m("2026-10-04", 98), m("2026-10-11", 100)]
const JUST_ABOVE = [m("2026-09-27", 96), m("2026-10-04", 98), m("2026-10-11", 100.2)]
const TIE = [
  m("2026-09-27", 80),
  m("2026-10-02", 80),
  m("2026-10-07", 98),
  m("2026-10-11", 98),
]
const STALE_JUMP = [m("2026-08-20", 80), m("2026-08-25", 80), m("2026-08-30", 98)]

const PROFILE_LB = makeAnswers({
  gender: "male",
  dateOfBirth: "1996-10-12",
  heightCm: "180",
  weightUnit: "lb",
  weight: "216",
  activityLevel: "high",
  goal: "lose",
})

function view011(
  metrics: BodyMetric[],
  profile: OnboardingAnswers | null = PROFILE,
  unit: WeightUnit = "kg"
) {
  const insights = buildInsights(metrics, profile, TODAY)
  const text = formatInsights(insights, unit)
  return { insights, text }
}

const warningFor = (rate: string, iso: string) =>
  `Tu ritmo de las últimas 4 semanas (${rate}) no es realista: puede que la medición del ${formatDate(iso)} esté mal. Revísala en el Historial y corrígela o bórrala para recibir una sugerencia de calorías.`

describe("insightsView - ritmo poco realista (spec 011)", () => {
  // SDD: 011 REQ-001 AC-001.1
  it("el salto hacia arriba da el estado 'unrealistic'", () => {
    expect(view011(JUMP_UP).insights.paceStatus).toBe("unrealistic")
  })

  // SDD: 011 REQ-001 AC-001.2
  it("el salto hacia abajo da el estado 'unrealistic'", () => {
    expect(view011(JUMP_DOWN).insights.paceStatus).toBe("unrealistic")
  })

  // SDD: 011 REQ-001 AC-001.3
  it("el límite del 2 % sigue siendo 'too_slow' (subir con meta perder)", () => {
    const { insights, text } = view011(LIMIT)

    expect(insights.paceStatus).toBe("too_slow")
    expect(text.statusLabel).toBe("Más lento que tu meta")
    // Contraste: el caso nuevo (salto) sí da el estado poco realista.
    expect(view011(JUMP_UP).insights.paceStatus).toBe("unrealistic")

  })

  // SDD: 011 REQ-001 AC-001.4
  it("justo por encima del 2 % da el estado 'unrealistic'", () => {
    expect(view011(JUST_ABOVE).insights.paceStatus).toBe("unrealistic")
  })

  // SDD: 011 REQ-001 AC-001.5
  it("con el último peso de hace más de 28 días es 'stale' y no hay medición sospechosa", () => {
    const { insights, text } = view011(STALE_JUMP)

    expect(insights.paceStatus).toBe("stale")
    expect(insights.suspiciousDate ?? null).toBeNull()
    expect(text.statusLabel).toBe("Sin registros recientes")
    expect(text.paceWarning ?? null).toBeNull()
    // Contraste: el caso nuevo (salto) sí da el estado poco realista.
    expect(view011(JUMP_UP).insights.paceStatus).toBe("unrealistic")
  })

  // SDD: 011 REQ-001 AC-001.6
  it("el ritmo normal de -0,5 kg/sem sigue en 'on_track'", () => {
    const { insights, text } = view011(ON_TRACK)

    expect(insights.paceStatus).toBe("on_track")
    expect(text.statusLabel).toBe("En ritmo con tu meta")
    expect(insights.suspiciousDate ?? null).toBeNull()
    // Contraste: el caso nuevo (salto) sí da el estado poco realista.
    expect(view011(JUMP_UP).insights.paceStatus).toBe("unrealistic")
  })

  // SDD: 011 REQ-002 AC-002.1
  it("la tarjeta muestra el ritmo, 'Revisa tus mediciones' y el tono de advertencia", () => {
    const { text } = view011(JUMP_UP)

    expect(text.rate).toBe("+12,6 kg/sem")
    expect(text.statusLabel).toBe("Revisa tus mediciones")
    expect(text.tone).toBe("warn")
  })

  // SDD: 011 REQ-002 AC-002.2
  it("con el perfil en lb el ritmo sale en lb", () => {
    const { text } = view011(JUMP_DOWN, PROFILE_LB, "lb")

    expect(text.rate).toBe("-27,8 lb/sem")
    expect(text.statusLabel).toBe("Revisa tus mediciones")
  })

  // SDD: 011 REQ-003 AC-003.1
  it("el aviso lleva el ritmo y la fecha de la medición sospechosa", () => {
    const { insights, text } = view011(JUMP_UP)

    expect(insights.suspiciousDate).toBe("2026-10-11")
    expect(text.paceWarning).toBe(warningFor("+12,6 kg/sem", "2026-10-11"))
  })

  // SDD: 011 REQ-003 AC-003.2
  it("con el perfil en lb el aviso lleva el ritmo en lb y la fecha del 2026-10-01", () => {
    const { text } = view011(JUMP_DOWN, PROFILE_LB, "lb")

    expect(text.paceWarning).toBe(warningFor("-27,8 lb/sem", "2026-10-01"))
  })

  // SDD: 011 REQ-003 AC-003.4
  it("con el límite del 2 % no hay aviso", () => {
    const { insights, text } = view011(LIMIT)

    expect(text.paceWarning ?? null).toBeNull()
    expect(insights.suspiciousDate ?? null).toBeNull()
    // Contraste: con el salto sí hay aviso con fecha.
    expect(view011(JUMP_UP).text.paceWarning).toBe(
      warningFor("+12,6 kg/sem", "2026-10-11")
    )
  })

  // SDD: 011 REQ-003 AC-003.5
  it("en un empate el aviso lleva la fecha del 2026-10-11", () => {
    const { text } = view011(TIE)

    // La regresión da 10,808 kg/sem, que se muestra como +10,8 kg/sem.
    expect(text.rate).toBe("+10,8 kg/sem")
    expect(text.paceWarning).toBe(warningFor("+10,8 kg/sem", "2026-10-11"))
  })

  // SDD: 011 REQ-003 AC-003.6
  it("una medición fuera de los 28 días no entra en la elección de la fecha", () => {
    const { insights, text } = view011([m("2026-09-01", 120), ...JUMP_UP])

    expect(insights.suspiciousDate).toBe("2026-10-11")
    expect(text.paceWarning).toBe(warningFor("+12,6 kg/sem", "2026-10-11"))
  })
})
