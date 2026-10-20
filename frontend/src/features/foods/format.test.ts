// Formato de valores nutricionales (spec 021): kcal sin decimales y gramos con
// un decimal y coma decimal; «—» cuando no hay dato.
import { describe, expect, it } from "vitest"
import { formatCalories, formatGrams } from "./format"

describe("formatCalories", () => {
  // SDD: 021 REQ-012 AC-012.2
  it("muestra las kcal sin decimales", () => {
    expect(formatCalories(165)).toBe("165 kcal")
  })

  // SDD: 021 REQ-012 AC-012.2
  it("redondea las kcal con decimales al entero más cercano", () => {
    expect(formatCalories(164.6)).toBe("165 kcal")
  })

  // SDD: 021 REQ-012 AC-012.3
  it("muestra «—» cuando no hay dato", () => {
    expect(formatCalories(null)).toBe("— kcal")
  })
})

describe("formatGrams", () => {
  // SDD: 021 REQ-012 AC-012.2
  it("muestra un decimal con coma decimal y la etiqueta", () => {
    expect(formatGrams(31, "proteína")).toBe("31,0 g proteína")
  })

  // SDD: 021 REQ-012 AC-012.2
  it("muestra el cero real como 0,0", () => {
    expect(formatGrams(0, "carbohidratos")).toBe("0,0 g carbohidratos")
  })

  // SDD: 021 REQ-012 AC-012.2
  it("redondea 3,57 a 3,6", () => {
    expect(formatGrams(3.57, "grasa")).toBe("3,6 g grasa")
  })

  // SDD: 021 REQ-012 AC-012.3
  it("sustituye el valor y la unidad por «—» cuando no hay dato", () => {
    expect(formatGrams(null, "carbohidratos")).toBe("— carbohidratos")
  })
})
