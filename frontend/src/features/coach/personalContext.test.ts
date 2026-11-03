// Tests UNITARIOS puros de buildCoachPersonalContext (spec 034): el contexto
// que `/coach` envía con cada pregunta. Se comparan con `calculateMacros` real
// y con los textos de Métricas. Sin React ni red; "hoy" se pasa como argumento
// (lunes 12 de octubre de 2026).
import { describe, expect, it } from "vitest"
import { buildCoachPersonalContext } from "./personalContext"
import type { BodyMetric } from "@/features/body-metrics/types"
import { calculateMacros } from "@/features/macros/calculations"
import { parseLocalDate } from "@/lib/dates"
import { makeAnswers } from "@/test/profileFixtures"

const TODAY = "2026-10-12"

function m(recorded_at: string, weight: number | null, fat: number | null = null): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: fat,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

// Perfil base de la spec 010 / 034.
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

function gramsOf(key: "protein" | "carbs" | "fat") {
  const summary = calculateMacros(PROFILE, parseLocalDate(TODAY))
  return summary.macros.find((macro) => macro.key === key)!.grams
}

describe("buildCoachPersonalContext", () => {
  // SDD: 034 REQ-007 AC-007.1
  // SDD: 034 REQ-002 AC-002.1
  it("lleva el mantenimiento, el objetivo y los gramos que muestra /home", () => {
    const context = buildCoachPersonalContext(SLOWER, PROFILE, TODAY)

    expect(context.today).toBe(TODAY)
    expect(context.macros).toEqual({
      maintenance_kcal: 2750,
      target_kcal: 2200,
      protein_g: gramsOf("protein"),
      carbs_g: gramsOf("carbs"),
      fat_g: gramsOf("fat"),
    })
  })

  // SDD: 034 REQ-007 AC-007.1
  // SDD: 034 REQ-003 AC-003.1
  it("lleva los indicadores con los mismos textos que Métricas", () => {
    const { indicators } = buildCoachPersonalContext(SLOWER, PROFILE, TODAY)

    expect(indicators).not.toBeNull()
    expect(indicators?.weight).toBe("79,4 kg")
    expect(indicators?.weight_change_30d).toBe("-0,6 kg")
    expect(indicators?.rate).toBe("-0,2 kg/sem")
    expect(indicators?.pace_status).toBe("too_slow")
    expect(indicators?.last_record_date).toBe("2026-10-11")
    expect(indicators?.total_records).toBe(4)
  })

  // SDD: 034 REQ-003 AC-003.2
  it("con solo peso, la grasa, las masas y el FFMI van como null", () => {
    const { indicators } = buildCoachPersonalContext(SLOWER, PROFILE, TODAY)

    expect(indicators?.body_fat).toBeNull()
    expect(indicators?.fat_mass).toBeNull()
    expect(indicators?.lean_mass).toBeNull()
    expect(indicators?.ffmi).toBeNull()
  })

  // SDD: 034 REQ-003 AC-003.4
  it("con el perfil en lb, el peso y el ritmo van en lb y las calorías siguen en kcal", () => {
    const profile = makeAnswers({
      gender: "male",
      dateOfBirth: "1996-10-12",
      heightCm: "180",
      weightUnit: "lb",
      weight: "175.05",
      activityLevel: "high",
      goal: "lose",
    })

    const context = buildCoachPersonalContext(SLOWER, profile, TODAY)

    expect(context.indicators?.weight).toBe("175 lb")
    expect(context.indicators?.rate).toBe("-0,4 lb/sem")
    expect(context.macros.target_kcal).toBe(2200)
    expect(context.macros.maintenance_kcal).toBe(2750)
  })

  // SDD: 034 REQ-002 AC-002.2
  it("las calorías van siempre en kcal, sin depender de ningún selector kJ", () => {
    const context = buildCoachPersonalContext(SLOWER, PROFILE, TODAY)

    expect(context.macros.target_kcal).toBe(2200)
    expect(Object.keys(context.macros).sort()).toEqual([
      "carbs_g",
      "fat_g",
      "maintenance_kcal",
      "protein_g",
      "target_kcal",
    ])
  })

  // SDD: 034 REQ-007 AC-007.2
  it("sin mediciones, los indicadores son null y las calorías y macros se envían", () => {
    const context = buildCoachPersonalContext([], PROFILE, TODAY)

    expect(context.indicators).toBeNull()
    expect(context.macros.target_kcal).toBe(2200)
    expect(context.macros.maintenance_kcal).toBe(2750)
  })

  // SDD: 034 REQ-003 AC-003.6
  it("con un ritmo poco realista envía el estado 'unrealistic'", () => {
    const jump = [m("2026-10-01", 80), m("2026-10-06", 80), m("2026-10-11", 98)]

    const { indicators } = buildCoachPersonalContext(jump, PROFILE, TODAY)

    expect(indicators?.pace_status).toBe("unrealistic")
  })

  // SDD: 034 REQ-003 AC-003.3
  it("con pocos registros envía 'insufficient' y ningún ritmo", () => {
    const few = [m("2026-10-02", 80), m("2026-10-06", 79.8), m("2026-10-11", 79.6)]

    const { indicators } = buildCoachPersonalContext(few, PROFILE, TODAY)

    expect(indicators?.pace_status).toBe("insufficient")
    expect(indicators?.rate).toBeNull()
  })

  // SDD: 034 REQ-006 AC-006.2
  it("no envía nada que el servidor no espere: solo today, macros e indicators", () => {
    const context = buildCoachPersonalContext(SLOWER, PROFILE, TODAY)

    expect(Object.keys(context).sort()).toEqual(["indicators", "macros", "today"])
  })
})
