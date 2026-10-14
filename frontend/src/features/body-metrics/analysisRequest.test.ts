// Tests UNITARIOS puros de buildAnalysisRequest (spec 010): el cuerpo que el
// cliente envía a POST /api/body-metrics/analysis. Sin React ni red; "hoy" se
// pasa como argumento (lunes 12 de octubre de 2026).
import { describe, expect, it } from "vitest"
import { buildAnalysisRequest } from "./analysisRequest"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { OnboardingAnswers } from "@/features/onboarding/types"
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

// Perfil base de la spec 010 (peso del perfil = peso de la última medición).
const PROFILE = makeAnswers({
  gender: "male",
  dateOfBirth: "1996-10-12",
  heightCm: "180",
  weight: "79.4",
  activityLevel: "high",
  goal: "lose",
})

const SLOWER = [
  m("2026-09-20", 80),
  m("2026-09-27", 79.8),
  m("2026-10-04", 79.6),
  m("2026-10-11", 79.4),
]
const ON_TRACK = [
  m("2026-09-20", 80),
  m("2026-09-27", 79.5),
  m("2026-10-04", 79),
  m("2026-10-11", 78.5, 20),
]

type Request = {
  today: string
  indicators: {
    weight: string | null
    weight_change_30d: string | null
    body_fat: string | null
    body_fat_change_30d: string | null
    rate: string | null
    pace_status: string
    fat_mass: string | null
    lean_mass: string | null
    bmi: string | null
    ffmi: string | null
    streak_weeks: number
    records_last_30_days: number
    total_records: number
    last_record_date: string | null
  }
  rate_kg_per_week: number | null
  latest_weight_kg: number | null
  calories: { maintenance_kcal: number; target_kcal: number }
}

function build(metrics: BodyMetric[], profile: OnboardingAnswers = PROFILE) {
  return buildAnalysisRequest(metrics, profile, TODAY) as unknown as Request
}

describe("buildAnalysisRequest", () => {
  // SDD: REQ-002 AC-002.1
  it("arma los textos de la pantalla, el ritmo en bruto y el estado", () => {
    const request = build(SLOWER)

    expect(request.today).toBe(TODAY)
    expect(request.indicators.weight).toBe("79,4 kg")
    expect(request.indicators.weight_change_30d).toBe("-0,6 kg")
    expect(request.indicators.rate).toBe("-0,2 kg/sem")
    expect(request.indicators.pace_status).toBe("too_slow")
    expect(request.rate_kg_per_week).toBeCloseTo(-0.2, 6)
    expect(request.latest_weight_kg).toBe(79.4)
  })

  // SDD: REQ-002 AC-002.2
  it("incluye el estado 'on_track' y la composición corporal", () => {
    const { indicators } = build(ON_TRACK)

    expect(indicators.pace_status).toBe("on_track")
    expect(indicators.body_fat).toBe("20 %")
    expect(indicators.fat_mass).toBe("15,7 kg")
    expect(indicators.lean_mass).toBe("62,8 kg")
    expect(indicators.bmi).toBe("24,2")
    expect(indicators.ffmi).toBe("19,4")
  })

  // SDD: REQ-002 AC-002.3
  it("con pocos registros envía 'insufficient' y ningún ritmo", () => {
    const request = build([
      m("2026-10-02", 80),
      m("2026-10-06", 79.8),
      m("2026-10-11", 79.6),
    ])

    expect(request.indicators.pace_status).toBe("insufficient")
    expect(request.indicators.rate).toBeNull()
    expect(request.rate_kg_per_week).toBeNull()
    expect(request.latest_weight_kg).toBeNull()
  })

  // SDD: REQ-002 AC-002.4
  it("con el último peso de hace más de 28 días envía 'stale'", () => {
    const request = build([
      m("2026-08-17", 82),
      m("2026-08-24", 81.5),
      m("2026-09-07", 81),
    ])

    expect(request.indicators.pace_status).toBe("stale")
    expect(request.indicators.rate).toBeNull()
    expect(request.rate_kg_per_week).toBeNull()
    expect(request.latest_weight_kg).toBeNull()
  })

  // SDD: REQ-002 AC-002.5
  it("con solo peso envía null en grasa, masas y FFMI", () => {
    const { indicators } = build(SLOWER)

    expect(indicators.body_fat).toBeNull()
    expect(indicators.body_fat_change_30d).toBeNull()
    expect(indicators.fat_mass).toBeNull()
    expect(indicators.lean_mass).toBeNull()
    expect(indicators.ffmi).toBeNull()
  })

  // SDD: REQ-002 AC-002.6
  it("envía la racha, los registros de 30 días, el total y el último registro", () => {
    const { indicators } = build([
      m("2026-10-12", 79.4),
      m("2026-10-05", 79.7),
      m("2026-09-28", 80),
    ])

    expect(indicators.streak_weeks).toBe(3)
    expect(indicators.records_last_30_days).toBe(3)
    expect(indicators.total_records).toBe(3)
    expect(indicators.last_record_date).toBe("2026-10-12")
  })

  // SDD: REQ-002 AC-002.7
  it("con el perfil en lb envía el peso y el ritmo en lb", () => {
    const profile = makeAnswers({
      gender: "male",
      dateOfBirth: "1996-10-12",
      heightCm: "180",
      weightUnit: "lb",
      weight: "175.05",
      activityLevel: "high",
      goal: "lose",
    })

    const { indicators } = build(SLOWER, profile)

    expect(indicators.weight).toBe("175 lb")
    expect(indicators.rate).toBe("-0,4 lb/sem")
  })

  // SDD: REQ-003 AC-003.1
  it("envía el mantenimiento y el objetivo diario que muestra Macros", () => {
    const { calories } = build(SLOWER)

    expect(calories.maintenance_kcal).toBe(2750)
    expect(calories.target_kcal).toBe(2200)
  })

  // SDD: REQ-003 AC-003.2
  it("envía el objetivo elevado al suelo calórico de una mujer", () => {
    const profile = makeAnswers({
      gender: "female",
      dateOfBirth: "1976-10-12",
      heightCm: "160",
      weight: "60.2",
      activityLevel: "low",
      goal: "lose",
    })

    const { calories } = build(
      [m("2026-10-11", 60.2), m("2026-10-04", 60.3), m("2026-09-27", 60.4)],
      profile
    )

    expect(calories.target_kcal).toBe(1200)
  })

  // SDD: REQ-007 AC-007.8
  it("las calorías siguen en kcal con el perfil en lb", () => {
    const profile = makeAnswers({
      gender: "male",
      dateOfBirth: "1996-10-12",
      heightCm: "180",
      weightUnit: "lb",
      weight: "175.05",
      activityLevel: "high",
      goal: "lose",
    })

    const { calories } = build(SLOWER, profile)

    expect(calories.target_kcal).toBe(2200)
    expect(calories.maintenance_kcal).toBe(2750)
  })

  // SDD: REQ-002 AC-002.1
  it("el cuerpo pasa analysisRequestSchema", async () => {
    // Import dinámico: el esquema lo crea el implementer (plan §3.4) y así el
    // archivo compila antes de que exista.
    const schemas = (await import(
      "@/features/body-metrics/schemas"
    )) as unknown as {
      analysisRequestSchema: { parse: (value: unknown) => unknown }
    }

    expect(() => schemas.analysisRequestSchema.parse(build(SLOWER))).not.toThrow()
    expect(() =>
      schemas.analysisRequestSchema.parse(
        build([
          m("2026-10-02", 80),
          m("2026-10-06", 79.8),
          m("2026-10-11", 79.6),
        ])
      )
    ).not.toThrow()
  })
})

// --- Spec 011 ---

describe("buildAnalysisRequest - ritmo poco realista", () => {
  const JUMP_UP = [m("2026-10-01", 80), m("2026-10-06", 80), m("2026-10-11", 98)]

  // SDD: 011 REQ-004 AC-004.2
  it("con el salto hacia arriba envía 'unrealistic' con el ritmo y el peso", () => {
    const request = build(JUMP_UP)

    expect(request.indicators.pace_status).toBe("unrealistic")
    expect(request.indicators.rate).toBe("+12,6 kg/sem")
    expect(request.rate_kg_per_week).toBeCloseTo(12.6, 6)
    expect(request.latest_weight_kg).toBe(98)
  })

  // SDD: 011 REQ-007 AC-007.6
  it("el cuerpo con 'unrealistic' pasa analysisRequestSchema", async () => {
    const schemas = (await import(
      "@/features/body-metrics/schemas"
    )) as unknown as {
      analysisRequestSchema: { parse: (value: unknown) => unknown }
    }

    expect(build(JUMP_UP).indicators.pace_status).toBe("unrealistic")
    expect(() => schemas.analysisRequestSchema.parse(build(JUMP_UP))).not.toThrow()
  })
})

