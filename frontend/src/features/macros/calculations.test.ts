import { describe, expect, it } from "vitest"
import { calculateMacros } from "@/features/macros/calculations"
import { makeAnswers } from "@/test/profileFixtures"

// Hombre, 72,5 kg, 175 cm, actividad moderada (x1,375), mantener.
// Mifflin-St Jeor: 10*72,5 + 6,25*175 - 5*edad + 5
//   27 años -> 1688,75 * 1,375 = 2322
//   28 años -> 1683,75 * 1,375 = 2315
const answers = makeAnswers({ dateOfBirth: "1998-10-12" })

describe("calculateMacros - edad desde la fecha de nacimiento", () => {
  // SDD: REQ-012 AC-012.4
  it("el 11 de octubre de 2026 calcula con 27 años", () => {
    const summary = calculateMacros(answers, new Date(2026, 9, 11))

    expect(summary.maintenanceKcal).toBe(2322)
    expect(summary.targetKcal).toBe(2322)
  })

  // SDD: REQ-012 AC-012.4
  it("el 12 de octubre de 2026 (cumpleaños) calcula con 28 años", () => {
    const summary = calculateMacros(answers, new Date(2026, 9, 12))

    expect(summary.maintenanceKcal).toBe(2315)
    expect(summary.targetKcal).toBe(2315)
  })
})
