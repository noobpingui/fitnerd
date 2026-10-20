// Formato de las cifras del diario (spec 022): es-ES, coma decimal, kcal sin
// decimales y «—» cuando no hay dato.
import { describe, expect, it } from "vitest"
import { makeCustomItem, makeMealItem } from "@/test/diaryFixtures"
import {
  formatDiaryDate,
  formatKcal,
  formatLoggedGrams,
  formatNutrientGrams,
  formatPortionPreview,
  sourceLabel,
} from "./format"

describe("formatDiaryDate", () => {
  // SDD: 022 REQ-010 AC-010.1
  it("da la fecha larga en español: «martes, 20 de octubre»", () => {
    expect(formatDiaryDate("2026-10-20")).toBe("martes, 20 de octubre")
  })

  // SDD: 022 REQ-010 AC-010.1
  it("interpreta la fecha como local, sin desplazarla un día", () => {
    expect(formatDiaryDate("2026-01-01")).toBe("jueves, 1 de enero")
  })
})

describe("formatKcal", () => {
  // SDD: 022 REQ-010 AC-010.1
  it("redondea 247,5 kcal a «248 kcal»", () => {
    expect(formatKcal(247.5)).toBe("248 kcal")
  })

  // SDD: 022 REQ-010 AC-010.1
  it("el cero se muestra como «0 kcal»", () => {
    expect(formatKcal(0)).toBe("0 kcal")
  })

  // SDD: 022 REQ-011 AC-011.7
  it("sin dato muestra «— kcal»", () => {
    expect(formatKcal(null)).toBe("— kcal")
  })
})

describe("formatNutrientGrams", () => {
  // SDD: 022 REQ-011 AC-011.2
  it("usa un decimal con coma decimal", () => {
    expect(formatNutrientGrams(46.5)).toBe("46,5")
    expect(formatNutrientGrams(31)).toBe("31,0")
  })

  // SDD: 022 REQ-011 AC-011.2
  it("el cero real se muestra como 0,0", () => {
    expect(formatNutrientGrams(0)).toBe("0,0")
  })

  // SDD: 022 REQ-011 AC-011.3
  it("redondea 5,36 a 5,4", () => {
    expect(formatNutrientGrams(5.36)).toBe("5,4")
  })
})

describe("formatLoggedGrams", () => {
  // SDD: 022 REQ-010 AC-010.1
  it("los gramos enteros no llevan decimales: «150 g»", () => {
    expect(formatLoggedGrams(150)).toBe("150 g")
  })

  // SDD: 022 REQ-010 AC-010.1
  it("los gramos con decimal llevan uno con coma: «150,5 g»", () => {
    expect(formatLoggedGrams(150.5)).toBe("150,5 g")
  })
})

describe("formatPortionPreview", () => {
  // SDD: 022 REQ-011 AC-011.3
  it("une calorías y macros con el formato de la spec", () => {
    const preview = formatPortionPreview({
      calories_kcal: 247.5,
      protein_g: 46.5,
      carbs_g: 0,
      fat_g: 5.36,
    })

    expect(preview).toBe("248 kcal · 46,5 g proteína · 0,0 g carbohidratos · 5,4 g grasa")
  })

  // SDD: 022 REQ-012 AC-012.3
  it("el gallo pinto de 250 g: «400 kcal · 13,8 g proteína · 67,5 g carbohidratos · 8,0 g grasa»", () => {
    const preview = formatPortionPreview({
      calories_kcal: 400,
      protein_g: 13.75,
      carbs_g: 67.5,
      fat_g: 8,
    })

    expect(preview).toBe("400 kcal · 13,8 g proteína · 67,5 g carbohidratos · 8,0 g grasa")
  })

  // SDD: 022 REQ-011 AC-011.7
  it("muestra «—» en el nutriente sin dato y formatea los demás", () => {
    const preview = formatPortionPreview({
      calories_kcal: 247.5,
      protein_g: 46.5,
      carbs_g: null,
      fat_g: 5.36,
    })

    expect(preview).toContain("—")
    expect(preview).toContain("248 kcal")
    expect(preview).toContain("5,4 g grasa")
    expect(preview).not.toContain("null")
    expect(preview).not.toContain("NaN")
  })
})

describe("sourceLabel", () => {
  // SDD: 022 REQ-010 AC-010.6
  it("un alimento de SR Legacy muestra «SR Legacy»", () => {
    expect(sourceLabel(makeMealItem({ data_type: "sr_legacy" }))).toBe("SR Legacy")
  })

  // SDD: 022 REQ-010 AC-010.6
  it("un alimento de Foundation muestra «Foundation»", () => {
    expect(sourceLabel(makeMealItem({ data_type: "foundation" }))).toBe("Foundation")
  })

  // SDD: 022 REQ-010 AC-010.6
  it("un alimento personalizado muestra «Personalizado»", () => {
    expect(sourceLabel(makeCustomItem())).toBe("Personalizado")
  })
})
