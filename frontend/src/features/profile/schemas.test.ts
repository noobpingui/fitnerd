// Test UNITARIO puro del esquema del formulario Datos físicos (spec 015).
import { describe, expect, it } from "vitest"
import { fieldMessages } from "@/features/onboarding/schemas"
import {
  makeProfileFormSchema,
  profileResponseSchema,
  saveProfilePayloadSchema,
  type ProfileFormErrorKey,
} from "@/features/profile/schemas"
import type { PhysicalDataFormValues } from "@/features/profile/types"
import {
  makeAnswers,
  makePendingResponse,
  makeProfileResponse,
} from "@/test/profileFixtures"

// Hoy fijo: 11 de octubre de 2026.
const TODAY = new Date(2026, 9, 11)

function values(
  overrides: Record<string, string | null> = {}
): PhysicalDataFormValues {
  return {
    ...makeAnswers(),
    fat: "",
    muscle: "",
    firstName: "Ana",
    ...overrides,
  } as PhysicalDataFormValues
}

const messages = (overrides: Record<string, string | null> = {}) =>
  fieldMessages<ProfileFormErrorKey>(
    makeProfileFormSchema(TODAY),
    values(overrides)
  )
const isValid = (overrides: Record<string, string | null> = {}) =>
  makeProfileFormSchema(TODAY).safeParse(values(overrides)).success

describe("esquema del perfil - composición corporal opcional", () => {
  // SDD: 015 REQ-005 AC-005.1
  it("acepta grasa y músculo vacíos", () => {
    expect(messages()).toEqual({})
    expect(isValid()).toBe(true)
  })

  // SDD: 015 REQ-005 AC-005.1
  it("acepta los límites 3 y 60 de grasa y 10 y 70 de músculo", () => {
    for (const fat of ["3", "60"]) {
      expect(messages({ fat }).fat).toBeUndefined()
      expect(isValid({ fat })).toBe(true)
    }
    for (const muscle of ["10", "70"]) {
      expect(messages({ muscle }).muscle).toBeUndefined()
      expect(isValid({ muscle })).toBe(true)
    }
  })

  // SDD: 015 REQ-005 AC-005.2
  it("rechaza la grasa fuera de 3 a 60 con 'Entre 3 y 60 %'", () => {
    for (const fat of ["2.9", "61"]) {
      expect(messages({ fat }).fat).toBe("Entre 3 y 60 %")
      expect(isValid({ fat })).toBe(false)
    }
  })

  // SDD: 015 REQ-005 AC-005.3
  it("rechaza el músculo fuera de 10 a 70 con 'Entre 10 y 70 %'", () => {
    for (const muscle of ["9", "70.1"]) {
      expect(messages({ muscle }).muscle).toBe("Entre 10 y 70 %")
      expect(isValid({ muscle })).toBe(false)
    }
  })
})

describe("esquema del perfil - reglas compartidas heredadas", () => {
  // SDD: 015 REQ-002 AC-002.1
  it("una fecha vacía da 'Indica tu fecha de nacimiento'", () => {
    expect(messages({ dateOfBirth: "" }).dateOfBirth).toBe(
      "Indica tu fecha de nacimiento"
    )
    expect(isValid({ dateOfBirth: "" })).toBe(false)
  })

  // SDD: 015 REQ-001 AC-001.2
  it("una fecha futura y una fuera de rango dan los mismos mensajes que el onboarding", () => {
    expect(messages({ dateOfBirth: "2026-10-12" }).dateOfBirth).toBe(
      "La fecha de nacimiento no puede ser futura"
    )
    expect(messages({ dateOfBirth: "2012-10-12" }).dateOfBirth).toBe(
      "Debes tener entre 14 y 100 años"
    )
  })

  // SDD: 015 REQ-003 AC-003.5
  it("la altura en ft/in con decimales da 'Entre 3 y 8 ft'", () => {
    const result = messages({ heightUnit: "ft", heightFt: "5.5", heightIn: "" })
    expect(result.height).toBe("Entre 3 y 8 ft")
  })

  // SDD: 017 REQ-001 AC-001.5
  it("la altura de 5 ft con 12 in da 'Entre 0 y 11 in'", () => {
    const result = messages({ heightUnit: "ft", heightFt: "5", heightIn: "12" })
    expect(result.height).toBe("Entre 0 y 11 in")
    expect(isValid({ heightUnit: "ft", heightFt: "5", heightIn: "12" })).toBe(false)
  })

  // SDD: 015 REQ-004 AC-004.2
  it("el peso fuera de rango da 'Entre 30 y 300 kg'", () => {
    expect(messages({ weight: "500" }).weight).toBe("Entre 30 y 300 kg")
  })
})

describe("esquema del perfil - nombre (spec 033)", () => {
  // SDD: 033 REQ-007 AC-007.5
  it("un nombre vacío o de solo espacios da 'El nombre es obligatorio'", () => {
    for (const firstName of ["", "   "]) {
      expect(messages({ firstName }).firstName).toBe("El nombre es obligatorio")
      expect(isValid({ firstName })).toBe(false)
    }
  })

  // SDD: 033 REQ-007 AC-007.6
  it("un nombre de 101 caracteres da el mensaje de longitud", () => {
    const firstName = "a".repeat(101)
    expect(messages({ firstName }).firstName).toBe(
      "El nombre no puede superar los 100 caracteres"
    )
    expect(isValid({ firstName })).toBe(false)
  })

  // SDD: 033 REQ-008 AC-008.3
  it("un nombre de 100 caracteres rodeado de espacios es válido", () => {
    const firstName = "  " + "a".repeat(100) + "  "
    expect(messages({ firstName }).firstName).toBeUndefined()
    expect(isValid({ firstName })).toBe(true)
    // Y 101 caracteres no lo son, con el mensaje de la regla.
    const tooLong = "a".repeat(101)
    expect(messages({ firstName: tooLong }).firstName).toBe(
      "El nombre no puede superar los 100 caracteres"
    )
    expect(isValid({ firstName: tooLong })).toBe(false)
  })

  // SDD: 033 REQ-007 AC-007.5
  it("un nombre no válido no impide calcular el resto de mensajes", () => {
    const result = messages({ firstName: "", weight: "500" })
    expect(result.firstName).toBe("El nombre es obligatorio")
    expect(result.weight).toBe("Entre 30 y 300 kg")
  })
})

describe("respuesta y cuerpo del perfil - nombre (spec 033)", () => {
  // SDD: 033 REQ-004 AC-004.1
  it("la respuesta conserva first_name", () => {
    const parsed = profileResponseSchema.parse(makeProfileResponse())
    expect(parsed.first_name).toBe("Ana")
  })

  // SDD: 033 REQ-004 AC-004.2
  it("la respuesta con first_name null lo conserva como null", () => {
    expect(profileResponseSchema.parse(makePendingResponse()).first_name).toBeNull()
  })

  // SDD: 033 REQ-004 AC-004.2
  it("la respuesta sin la clave first_name la deja en null", () => {
    const { first_name: _omitted, ...withoutName } = makeProfileResponse()
    expect(profileResponseSchema.parse(withoutName).first_name).toBeNull()
  })

  const payload = {
    date_of_birth: "1998-04-03",
    gender: "male",
    height_unit: "cm",
    height_cm: 175,
    height_ft: null,
    height_in: null,
    weight_unit: "kg",
    weight: 72.5,
    activity_level: "moderate",
    goal: "maintain",
  }

  // SDD: 033 REQ-007 AC-007.3
  it("el cuerpo del PUT acepta first_name y también su ausencia", () => {
    expect(
      saveProfilePayloadSchema.parse({ ...payload, first_name: "Beatriz" }).first_name
    ).toBe("Beatriz")
    expect(saveProfilePayloadSchema.safeParse(payload).success).toBe(true)
  })
})
