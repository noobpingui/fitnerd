// Tests de la validación y del payload del formulario de corrección de una
// medición (spec 008). Funciones puras: no hay red ni DOM.
import { describe, expect, it } from "vitest"
import {
  analysisRequestSchema,
  correctionPayload,
  makeMetricCorrectionSchema,
} from "@/features/body-metrics/schemas"
import type {
  BodyMetric,
  UpdateBodyMetricPayload,
} from "@/features/body-metrics/types"

type Values = { weight: string; fat: string; muscle: string }

const EMPTY: Values = { weight: "", fat: "", muscle: "" }

function metric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "m1",
    weight: 78.5,
    body_fat_percentage: 20,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at: "2026-10-11",
    ...overrides,
  }
}

// Forma mínima que usan los tests del esquema (zod la cumple).
type Parser = {
  safeParse: (values: Values) => {
    success: boolean
    error?: { issues: { message: string; path: PropertyKey[] }[] }
  }
}

// Esquema de un perfil en kg con una medición original de 80 kg.
const kgSchema = (): Parser => makeMetricCorrectionSchema("kg", "80", 80)
const lbSchema = (): Parser => makeMetricCorrectionSchema("lb", "176.4", 80)

function messages(schema: Parser, values: Values) {
  const result = schema.safeParse(values)
  return result.success || !result.error
    ? []
    : result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join("."),
      }))
}

describe("makeMetricCorrectionSchema", () => {
  // SDD: REQ-009 AC-009.5
  it("rechaza los tres campos vacíos con 'Registra al menos un valor'", () => {
    expect(messages(kgSchema(), EMPTY).map((m) => m.message)).toContain(
      "Registra al menos un valor"
    )
    expect(
      messages(kgSchema(), { weight: "  ", fat: " ", muscle: "" }).map(
        (m) => m.message
      )
    ).toContain("Registra al menos un valor")
  })

  // SDD: REQ-009 AC-009.5
  it("acepta un solo campo con valor", () => {
    expect(kgSchema().safeParse({ ...EMPTY, fat: "20" }).success).toBe(true)
    expect(kgSchema().safeParse({ ...EMPTY, weight: "79" }).success).toBe(true)
  })

  // SDD: REQ-009 AC-009.6
  it("limita el peso a 30–300 kg", () => {
    expect(kgSchema().safeParse({ ...EMPTY, weight: "30" }).success).toBe(true)
    expect(kgSchema().safeParse({ ...EMPTY, weight: "300" }).success).toBe(true)
    for (const weight of ["29.9", "301", "abc"]) {
      expect(messages(kgSchema(), { ...EMPTY, weight })).toContainEqual({
        message: "Entre 30 y 300 kg",
        path: "weight",
      })
    }
  })

  // SDD: REQ-009 AC-009.6
  it("limita el peso a 66–660 lb", () => {
    expect(lbSchema().safeParse({ ...EMPTY, weight: "66" }).success).toBe(true)
    expect(lbSchema().safeParse({ ...EMPTY, weight: "660" }).success).toBe(true)
    for (const weight of ["65.9", "661"]) {
      expect(messages(lbSchema(), { ...EMPTY, weight })).toContainEqual({
        message: "Entre 66 y 660 lb",
        path: "weight",
      })
    }
  })

  // SDD: REQ-009 AC-009.6
  it("limita la grasa a 3–60 %", () => {
    expect(kgSchema().safeParse({ ...EMPTY, fat: "3" }).success).toBe(true)
    expect(kgSchema().safeParse({ ...EMPTY, fat: "60" }).success).toBe(true)
    for (const fat of ["2.9", "61"]) {
      expect(messages(kgSchema(), { ...EMPTY, fat })).toContainEqual({
        message: "Entre 3 y 60 %",
        path: "fat",
      })
    }
  })

  // SDD: REQ-009 AC-009.6
  it("limita la masa muscular a 10–70 %", () => {
    expect(kgSchema().safeParse({ ...EMPTY, muscle: "10" }).success).toBe(true)
    expect(kgSchema().safeParse({ ...EMPTY, muscle: "70" }).success).toBe(true)
    for (const muscle of ["9.9", "71"]) {
      expect(messages(kgSchema(), { ...EMPTY, muscle })).toContainEqual({
        message: "Entre 10 y 70 %",
        path: "muscle",
      })
    }
  })

  // SDD: REQ-009 AC-009.6
  it("acepta un peso sin cambiar aunque quede fuera del rango del perfil (29,9 kg = 65,9 lb)", () => {
    const schema: Parser = makeMetricCorrectionSchema("lb", "65.9", 29.9)

    expect(schema.safeParse({ weight: "65.9", fat: "20", muscle: "" }).success).toBe(
      true
    )
    // Si el usuario cambia el peso, vuelve a aplicarse el rango.
    expect(messages(schema, { weight: "65.8", fat: "20", muscle: "" })).toContainEqual({
      message: "Entre 66 y 660 lb",
      path: "weight",
    })
  })

  // SDD: REQ-009 AC-009.6
  it("la excepción del peso sin cambiar no vale si el original está fuera del rango del servidor", () => {
    const schema: Parser = makeMetricCorrectionSchema("kg", "2", 2)

    expect(messages(schema, { weight: "2", fat: "", muscle: "" })).toContainEqual({
      message: "Entre 30 y 300 kg",
      path: "weight",
    })
  })
})

function payloadOf(
  values: Values,
  unit: "kg" | "lb",
  original: BodyMetric
): UpdateBodyMetricPayload {
  return correctionPayload(values, unit, original)
}

describe("correctionPayload", () => {
  // SDD: REQ-009 AC-009.3
  it("si el peso no cambió conserva el peso original en kg (perfil en lb)", () => {
    const payload = payloadOf(
      { weight: "173.1", fat: "25", muscle: "" },
      "lb",
      metric({ weight: 78.5 })
    )

    expect(payload).toEqual({
      weight: 78.5,
      body_fat_percentage: 25,
      muscle_mass_percentage: null,
    })
  })

  // SDD: REQ-009 AC-009.4
  it("convierte el peso escrito en lb a kg con un decimal", () => {
    const payload = payloadOf(
      { weight: "160", fat: "20", muscle: "" },
      "lb",
      metric({ weight: 78.5 })
    )

    expect(payload.weight).toBe(72.6)
  })

  // SDD: REQ-009 AC-009.2
  it("en kg envía el peso escrito tal cual", () => {
    const payload = payloadOf(
      { weight: "79", fat: "20", muscle: "" },
      "kg",
      metric({ weight: 80 })
    )

    expect(payload).toEqual({
      weight: 79,
      body_fat_percentage: 20,
      muscle_mass_percentage: null,
    })
  })

  // SDD: REQ-009 AC-009.2
  it("un campo vacío se envía como null", () => {
    const payload = payloadOf(
      { weight: "", fat: "", muscle: "45" },
      "kg",
      metric({ weight: 80 })
    )

    expect(payload).toEqual({
      weight: null,
      body_fat_percentage: null,
      muscle_mass_percentage: 45,
    })
  })

  // SDD: REQ-009 AC-009.3
  it("si el peso original es null y el texto está vacío, envía null", () => {
    const payload = payloadOf(
      { weight: "", fat: "20", muscle: "" },
      "kg",
      metric({ weight: null })
    )

    expect(payload.weight).toBeNull()
  })
})

// --- Spec 011 ---

describe("analysisRequestSchema - ritmo poco realista", () => {
  const request = (pace_status: string) => ({
    today: "2026-10-12",
    indicators: {
      weight: "98 kg",
      weight_change_30d: "+18 kg",
      body_fat: null,
      body_fat_change_30d: null,
      rate: "+12,6 kg/sem",
      pace_status,
      fat_mass: null,
      lean_mass: null,
      bmi: "30,2",
      ffmi: null,
      streak_weeks: 1,
      records_last_30_days: 3,
      total_records: 3,
      last_record_date: "2026-10-11",
    },
    rate_kg_per_week: 12.6,
    latest_weight_kg: 98,
    calories: { maintenance_kcal: 2750, target_kcal: 2200 },
  })

  // SDD: 011 REQ-004 AC-004.2
  it("acepta pace_status 'unrealistic'", () => {
    expect(() => analysisRequestSchema.parse(request("unrealistic"))).not.toThrow()
  })

  // SDD: 011 REQ-004 AC-004.2
  it("acepta el estado unrealistic y sigue rechazando un estado desconocido", () => {
    expect(() => analysisRequestSchema.parse(request("unrealistic"))).not.toThrow()
    expect(() => analysisRequestSchema.parse(request("mágico"))).toThrow()
  })
})
