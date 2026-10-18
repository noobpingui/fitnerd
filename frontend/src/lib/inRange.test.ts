// Test UNITARIO puro de la regla de rango numérico compartida (spec 017).
import { describe, expect, it } from "vitest"
import { inRange } from "@/lib/inRange"

const LIMITS = { min: 3, max: 8 }

describe("inRange - regla de rango compartida", () => {
  // SDD: 017 NFR-001 AC-N001.1
  it("devuelve verdadero para 3, 8 y 5.5 con rango de 3 a 8", () => {
    for (const value of ["3", "8", "5.5"]) {
      expect(inRange(value, LIMITS), value).toBe(true)
    }
  })

  // SDD: 017 NFR-001 AC-N001.1
  it("devuelve falso para vacío, solo espacios, 2.9, 8.1 y texto no numérico", () => {
    for (const value of ["", "   ", "2.9", "8.1", "abc"]) {
      expect(inRange(value, LIMITS), value).toBe(false)
    }
  })

  // SDD: 017 NFR-001 AC-N001.2
  it("con solo enteros acepta 5 y rechaza 5.5", () => {
    expect(inRange("5", LIMITS, true)).toBe(true)
    expect(inRange("5.5", LIMITS, true)).toBe(false)
  })
})
