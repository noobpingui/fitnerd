// Test UNITARIO puro de los helpers de unidades del onboarding (spec 009).
import { describe, expect, it } from "vitest"
import { heightCmFromAnswers } from "./units"
import { convertHeight, convertWeight } from "./units"
import { makeAnswers } from "@/test/profileFixtures"

describe("heightCmFromAnswers", () => {
  // SDD: REQ-007 AC-007.3
  it("devuelve la altura en cm cuando la unidad es cm", () => {
    expect(heightCmFromAnswers(makeAnswers({ heightUnit: "cm", heightCm: "175" }))).toBe(175)
  })

  // SDD: REQ-006 AC-006.4
  it("convierte pies y pulgadas a cm (5 ft 9 in = 175,26 cm)", () => {
    const answers = makeAnswers({ heightUnit: "ft", heightFt: "5", heightIn: "9" })

    expect(heightCmFromAnswers(answers)).toBeCloseTo(175.26, 5)
  })

  // SDD: REQ-007 AC-007.3
  it("trata las pulgadas vacías como cero", () => {
    const answers = makeAnswers({ heightUnit: "ft", heightFt: "5", heightIn: "" })

    expect(heightCmFromAnswers(answers)).toBeCloseTo(152.4, 5)
  })

  // SDD: REQ-007 AC-007.3
  it("devuelve null para una altura vacía, no numérica o no positiva", () => {
    for (const heightCm of ["", "abc", "0", "-5"]) {
      expect(heightCmFromAnswers(makeAnswers({ heightUnit: "cm", heightCm }))).toBeNull()
    }
    expect(
      heightCmFromAnswers(makeAnswers({ heightUnit: "ft", heightFt: "", heightIn: "" }))
    ).toBeNull()
  })
})

describe("convertHeight y convertWeight (spec 015)", () => {
  // SDD: 015 REQ-006 AC-006.1
  it("175 cm pasa a 5 ft 9 in y vuelve a 175 cm", () => {
    const toFt = convertHeight(makeAnswers({ heightCm: "175" }), "ft")
    expect(toFt).toEqual({ heightUnit: "ft", heightFt: "5", heightIn: "9" })

    const back = convertHeight(
      makeAnswers({ heightUnit: "ft", heightFt: "5", heightIn: "9" }),
      "cm"
    )
    expect(back).toEqual({ heightUnit: "cm", heightCm: "175" })
  })

  // SDD: 015 REQ-006 AC-006.2
  it("182 cm pasa a 6 ft 0 in (12 in se convierten en 1 ft más)", () => {
    expect(convertHeight(makeAnswers({ heightCm: "182" }), "ft")).toEqual({
      heightUnit: "ft",
      heightFt: "6",
      heightIn: "0",
    })
  })

  // SDD: 015 REQ-006 AC-006.3
  it("72 kg pasa a 158.7 lb y 160 lb pasa a 72.6 kg", () => {
    expect(convertWeight(makeAnswers({ weight: "72" }), "lb")).toEqual({
      weightUnit: "lb",
      weight: "158.7",
    })
    expect(
      convertWeight(makeAnswers({ weightUnit: "lb", weight: "160" }), "kg")
    ).toEqual({ weightUnit: "kg", weight: "72.6" })
  })

  // SDD: 015 REQ-006 AC-006.4
  it("un valor no válido solo cambia la unidad y conserva el texto", () => {
    expect(convertHeight(makeAnswers({ heightCm: "1750" }), "ft")).toEqual({
      heightUnit: "ft",
    })
    expect(convertWeight(makeAnswers({ weight: "20" }), "lb")).toEqual({
      weightUnit: "lb",
    })
  })

  // SDD: 015 REQ-003 AC-003.5
  it("5.5 ft no es válido y no se convierte: solo cambia la unidad", () => {
    const answers = makeAnswers({
      heightUnit: "ft",
      heightFt: "5.5",
      heightIn: "",
    })
    expect(convertHeight(answers, "cm")).toEqual({ heightUnit: "cm" })
  })
})
