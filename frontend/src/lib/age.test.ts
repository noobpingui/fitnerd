import { describe, expect, it } from "vitest"
import { ageFromIsoDate } from "@/lib/age"

// Hoy fijo: 11 de octubre de 2026 (fecha local, como en el dispositivo).
const TODAY = new Date(2026, 9, 11)

describe("ageFromIsoDate", () => {
  // SDD: REQ-012 AC-012.4
  it("cuenta el año nuevo el mismo día del cumpleaños", () => {
    expect(ageFromIsoDate("1998-10-11", TODAY)).toBe(28)
  })

  // SDD: REQ-012 AC-012.4
  it("todavía no cuenta el año nuevo si el cumpleaños es mañana", () => {
    expect(ageFromIsoDate("1998-10-12", TODAY)).toBe(27)
  })

  // SDD: REQ-012 AC-012.4
  it("cuenta el año nuevo cuando el cumpleaños fue ayer", () => {
    expect(ageFromIsoDate("1998-10-10", TODAY)).toBe(28)
  })

  // SDD: REQ-012 AC-012.4
  it("el 28 de febrero no cumple años quien nació un 29 de febrero", () => {
    expect(ageFromIsoDate("2000-02-29", new Date(2026, 1, 28))).toBe(25)
  })

  // SDD: REQ-012 AC-012.4
  it("el 1 de marzo ya cumple años quien nació un 29 de febrero", () => {
    expect(ageFromIsoDate("2000-02-29", new Date(2026, 2, 1))).toBe(26)
  })

  // SDD: REQ-009 AC-009.4
  it("usa el día local de la fecha, sin desplazarlo por la zona horaria", () => {
    expect(ageFromIsoDate("2012-10-11", TODAY)).toBe(14)
    expect(ageFromIsoDate("2012-10-12", TODAY)).toBe(13)
  })
})
