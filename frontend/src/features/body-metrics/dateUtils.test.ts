// Test UNITARIO puro: nada de React, nada de red - solo funciones y sus
// valores de entrada/salida. El foco es el motivo por el que este archivo
// existe (ver el comentario en dateUtils.ts): evitar el corrimiento de dia
// que da new Date("YYYY-MM-DD") en husos horarios negativos como Costa Rica.
// Los tests de parseLocalDate y todayIsoDate viven en src/lib/dates.test.ts.
import { describe, it, expect } from "vitest"
import { formatDate, periodStart } from "./dateUtils"

describe("formatDate", () => {
  it("muestra el mismo dia del mes que se le paso, no el dia anterior", () => {
    // El bug que este test previene: si formatDate usara new Date(iso)
    // directo, en UTC-6 "2026-01-01" se formatearia como 31 de diciembre.
    const formatted = formatDate("2026-01-01")
    expect(formatted).toContain("1")
    expect(formatted).not.toContain("31")
  })
})

describe("periodStart", () => {
  // SDD: REQ-005 AC-005.1
  it("devuelve la misma fecha 1, 3 y 12 meses antes", () => {
    expect(periodStart("2026-10-12", 1)).toBe("2026-09-12")
    expect(periodStart("2026-10-12", 3)).toBe("2026-07-12")
    expect(periodStart("2026-10-12", 12)).toBe("2025-10-12")
  })

  // SDD: REQ-005 AC-005.1
  it("usa el último día del mes cuando el día no existe", () => {
    expect(periodStart("2026-03-31", 1)).toBe("2026-02-28")
    expect(periodStart("2024-03-31", 1)).toBe("2024-02-29")
    expect(periodStart("2026-05-31", 3)).toBe("2026-02-28")
  })
})
