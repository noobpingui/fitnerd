// Test UNITARIO puro del esquema compartido de los datos físicos (spec 015).
// Incluye, trasladados desde validation.test.ts (Q1, Art. B5.3), los casos de
// la fecha de nacimiento de la spec 006, con sus mismos valores y "hoy" fijo.
import { describe, expect, it } from "vitest"
import {
  fieldMessages,
  makePhysicalDataSchema,
  type PhysicalDataErrorKey,
} from "@/features/onboarding/schemas"
import { payloadFromAnswers } from "@/features/profile/mappers"
import { saveProfilePayloadSchema } from "@/features/profile/schemas"
import { makeAnswers } from "@/test/profileFixtures"

// Hoy fijo: 11 de octubre de 2026.
const TODAY = new Date(2026, 9, 11)
const REQUIRED = "Indica tu fecha de nacimiento"
const FUTURE = "La fecha de nacimiento no puede ser futura"
const RANGE = "Debes tener entre 14 y 100 años"

const schema = () => makePhysicalDataSchema(TODAY)
const messages = (overrides: Record<string, string | null>) =>
  fieldMessages<PhysicalDataErrorKey>(schema(), makeAnswers(overrides))
const isValid = (overrides: Record<string, string | null>) =>
  schema().safeParse(makeAnswers(overrides)).success

const dob = (value: string) => ({ dateOfBirth: value })

describe("esquema compartido - fecha de nacimiento (casos trasladados de la 006)", () => {
  // SDD: 006 REQ-009 AC-009.2
  it("una fecha vacía no es válida pero no muestra ningún mensaje", () => {
    expect(isValid(dob(""))).toBe(false)
    const error = messages(dob("")).dateOfBirth
    expect(error).not.toBe(FUTURE)
    expect(error).not.toBe(RANGE)
  })

  // SDD: 006 REQ-009 AC-009.3
  it("una fecha futura da el mensaje de fecha futura", () => {
    expect(messages(dob("2026-10-12")).dateOfBirth).toBe(FUTURE)
    expect(isValid(dob("2026-10-12"))).toBe(false)
  })

  // SDD: 006 REQ-009 AC-009.4
  it("menos de 14 años da el mensaje de rango de edad", () => {
    expect(messages(dob("2020-01-01")).dateOfBirth).toBe(RANGE)
    expect(messages(dob("2012-10-12")).dateOfBirth).toBe(RANGE)
  })

  // SDD: 006 REQ-009 AC-009.4
  it("más de 100 años da el mensaje de rango de edad", () => {
    expect(messages(dob("1900-01-01")).dateOfBirth).toBe(RANGE)
    expect(messages(dob("1925-10-11")).dateOfBirth).toBe(RANGE)
  })

  // SDD: 006 REQ-009 AC-009.1
  it("los límites exactos de 14 y 100 años son válidos", () => {
    expect(messages(dob("2012-10-11")).dateOfBirth).toBeUndefined()
    expect(isValid(dob("2012-10-11"))).toBe(true)
    expect(messages(dob("1925-10-12")).dateOfBirth).toBeUndefined()
    expect(isValid(dob("1925-10-12"))).toBe(true)
  })

  // SDD: 006 REQ-011 AC-011.4
  it("una fecha normal es válida y no tiene error", () => {
    expect(messages(dob("1998-04-03")).dateOfBirth).toBeUndefined()
    expect(isValid(dob("1998-04-03"))).toBe(true)
  })
})

describe("esquema compartido - fecha de nacimiento (spec 015)", () => {
  // SDD: 015 REQ-001 AC-001.1
  it("acepta 14 años justos y 100 años justos sin mensaje", () => {
    for (const value of ["2012-10-11", "1925-10-12"]) {
      expect(messages(dob(value))).toEqual({})
      expect(isValid(dob(value))).toBe(true)
    }
  })

  // SDD: 015 REQ-001 AC-001.2
  it("rechaza una fecha futura con su mensaje", () => {
    expect(messages(dob("2026-10-12")).dateOfBirth).toBe(FUTURE)
    expect(isValid(dob("2026-10-12"))).toBe(false)
  })

  // SDD: 015 REQ-001 AC-001.3
  it("rechaza 13 y 101 años con el mensaje de rango de edad", () => {
    for (const value of ["2012-10-12", "1925-10-11"]) {
      expect(messages(dob(value)).dateOfBirth).toBe(RANGE)
      expect(isValid(dob(value))).toBe(false)
    }
  })

  // SDD: 015 REQ-002 AC-002.1
  it("una fecha vacía da 'Indica tu fecha de nacimiento'", () => {
    expect(messages(dob("")).dateOfBirth).toBe(REQUIRED)
    expect(isValid(dob(""))).toBe(false)
  })

  // SDD: 015 REQ-001 AC-001.4
  it("una fecha incompleta tampoco es válida", () => {
    expect(isValid(dob("2000-01"))).toBe(false)
    expect(messages(dob("2000-01")).dateOfBirth).toBeDefined()
  })
})

describe("esquema compartido - altura", () => {
  // SDD: 015 REQ-003 AC-003.1
  it("acepta 100 y 250 cm", () => {
    for (const heightCm of ["100", "250"]) {
      expect(messages({ heightUnit: "cm", heightCm }).height).toBeUndefined()
      expect(isValid({ heightUnit: "cm", heightCm })).toBe(true)
    }
  })

  // SDD: 015 REQ-003 AC-003.2
  it("rechaza 99 cm, 251 cm y el campo vacío con 'Entre 100 y 250 cm'", () => {
    for (const heightCm of ["99", "251", ""]) {
      expect(messages({ heightUnit: "cm", heightCm }).height).toBe(
        "Entre 100 y 250 cm"
      )
      expect(isValid({ heightUnit: "cm", heightCm })).toBe(false)
    }
  })

  // SDD: 015 REQ-003 AC-003.3
  it("acepta 5 ft con las pulgadas vacías (cuentan como 0)", () => {
    const ft = { heightUnit: "ft", heightFt: "5", heightIn: "" }
    expect(messages(ft).height).toBeUndefined()
    expect(isValid(ft)).toBe(true)
  })

  // SDD: 015 REQ-003 AC-003.3
  it("acepta los límites de pies y pulgadas (3 ft, 8 ft, 11 in)", () => {
    for (const [heightFt, heightIn] of [
      ["3", "0"],
      ["8", "0"],
      ["5", "11"],
    ]) {
      expect(isValid({ heightUnit: "ft", heightFt, heightIn })).toBe(true)
    }
  })

  // SDD: 015 REQ-003 AC-003.4
  it("rechaza 2 ft, 9 ft y 5 ft con 12 in con 'Entre 3 y 8 ft'", () => {
    for (const [heightFt, heightIn] of [
      ["2", ""],
      ["9", ""],
      ["5", "12"],
    ]) {
      const ft = { heightUnit: "ft", heightFt, heightIn }
      expect(messages(ft).height).toBe("Entre 3 y 8 ft")
      expect(isValid(ft)).toBe(false)
    }
  })

  // SDD: 015 REQ-003 AC-003.5
  it("rechaza decimales en pies o en pulgadas con 'Entre 3 y 8 ft'", () => {
    for (const [heightFt, heightIn] of [
      ["5.5", ""],
      ["5", "2.5"],
    ]) {
      const ft = { heightUnit: "ft", heightFt, heightIn }
      expect(messages(ft).height).toBe("Entre 3 y 8 ft")
      expect(isValid(ft)).toBe(false)
    }
  })

  // SDD: 015 REQ-003 AC-003.5
  it("todo valor que el esquema acepta produce un cuerpo que la guarda del envío acepta", () => {
    const accepted: Record<string, string>[] = [
      { heightUnit: "cm", heightCm: "175" },
      { heightUnit: "cm", heightCm: "175.5" },
      { heightUnit: "ft", heightFt: "5", heightIn: "" },
      { heightUnit: "ft", heightFt: "5", heightIn: "9" },
      { heightUnit: "ft", heightFt: "8", heightIn: "0" },
    ]
    for (const overrides of accepted) {
      expect(isValid(overrides)).toBe(true)
      const payload = payloadFromAnswers(makeAnswers(overrides))
      expect(saveProfilePayloadSchema.safeParse(payload).success).toBe(true)
    }
    // Y el valor que la guarda rechazaría ya no pasa el esquema del formulario.
    const decimal = { heightUnit: "ft", heightFt: "5.5", heightIn: "" }
    expect(
      saveProfilePayloadSchema.safeParse(payloadFromAnswers(makeAnswers(decimal)))
        .success
    ).toBe(false)
    expect(isValid(decimal)).toBe(false)
  })
})

describe("esquema compartido - peso", () => {
  // SDD: 015 REQ-004 AC-004.1
  it("acepta 30, 300 y 72.5 kg", () => {
    for (const weight of ["30", "300", "72.5"]) {
      expect(messages({ weightUnit: "kg", weight }).weight).toBeUndefined()
      expect(isValid({ weightUnit: "kg", weight })).toBe(true)
    }
  })

  // SDD: 015 REQ-004 AC-004.2
  it("rechaza 29.9, 300.1 y vacío en kg con 'Entre 30 y 300 kg'", () => {
    for (const weight of ["29.9", "300.1", ""]) {
      expect(messages({ weightUnit: "kg", weight }).weight).toBe(
        "Entre 30 y 300 kg"
      )
      expect(isValid({ weightUnit: "kg", weight })).toBe(false)
    }
  })

  // SDD: 015 REQ-004 AC-004.3
  it("acepta 66 y 660 lb", () => {
    for (const weight of ["66", "660"]) {
      expect(messages({ weightUnit: "lb", weight }).weight).toBeUndefined()
      expect(isValid({ weightUnit: "lb", weight })).toBe(true)
    }
  })

  // SDD: 015 REQ-004 AC-004.3
  it("rechaza 65.9 y 660.1 lb con 'Entre 66 y 660 lb'", () => {
    for (const weight of ["65.9", "660.1"]) {
      expect(messages({ weightUnit: "lb", weight }).weight).toBe(
        "Entre 66 y 660 lb"
      )
      expect(isValid({ weightUnit: "lb", weight })).toBe(false)
    }
  })
})

describe("fieldMessages", () => {
  // SDD: 015 REQ-010 AC-010.2
  it("devuelve un objeto vacío si los valores son válidos", () => {
    expect(messages({})).toEqual({})
  })

  // SDD: 015 REQ-010 AC-010.2
  it("devuelve un mensaje por clave cuando varias reglas fallan a la vez", () => {
    const result = messages({ dateOfBirth: "", heightCm: "99", weight: "500" })
    expect(result.dateOfBirth).toBe(REQUIRED)
    expect(result.height).toBe("Entre 100 y 250 cm")
    expect(result.weight).toBe("Entre 30 y 300 kg")
  })
})

describe("esquema compartido - enums obligatorios (regresión F1 de la review)", () => {
  // SDD: 015 REQ-007 AC-007.4
  it("gender null no es válido y da un mensaje en la clave gender", () => {
    expect(isValid({ gender: null })).toBe(false)
    expect(messages({ gender: null }).gender).toBeTruthy()
  })

  // SDD: 015 REQ-007 AC-007.4
  it("activityLevel null no es válido y da un mensaje en la clave activityLevel", () => {
    expect(isValid({ activityLevel: null })).toBe(false)
    expect(messages({ activityLevel: null }).activityLevel).toBeTruthy()
  })

  // SDD: 015 REQ-007 AC-007.4
  it("goal null no es válido y da un mensaje en la clave goal", () => {
    expect(isValid({ goal: null })).toBe(false)
    expect(messages({ goal: null }).goal).toBeTruthy()
  })
})
