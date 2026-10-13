// Test UNITARIO puro de los helpers de unidades del onboarding (spec 009).
import { describe, expect, it } from "vitest"
import { heightCmFromAnswers } from "./units"
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
