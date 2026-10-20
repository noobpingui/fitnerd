// Cálculo de la porción y del progreso frente al objetivo (spec 022). Funciones
// puras: los valores salen de los ejemplos de la spec.
import { describe, expect, it } from "vitest"
import { nutrientProgress, portionNutrients } from "./nutrition"

const CHICKEN = { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 }

describe("portionNutrients", () => {
  // SDD: 022 REQ-011 AC-011.2
  it("con 100 g devuelve los valores por 100 g", () => {
    expect(portionNutrients(CHICKEN, 100)).toEqual(CHICKEN)
  })

  // SDD: 022 REQ-011 AC-011.3
  it("con 150 g calcula 247,5 kcal y redondea la grasa 5,355 hacia arriba a 5,36", () => {
    expect(portionNutrients(CHICKEN, 150)).toEqual({
      calories_kcal: 247.5,
      protein_g: 46.5,
      carbs_g: 0,
      fat_g: 5.36,
    })
  })

  // SDD: 022 REQ-011 AC-011.3
  it("con 200 g calcula 330, 62, 0 y 7,14", () => {
    expect(portionNutrients(CHICKEN, 200)).toEqual({
      calories_kcal: 330,
      protein_g: 62,
      carbs_g: 0,
      fat_g: 7.14,
    })
  })

  // SDD: 022 REQ-011 AC-011.7
  it("conserva null en el nutriente sin dato y calcula los demás", () => {
    const result = portionNutrients({ ...CHICKEN, carbs_g: null }, 200)

    expect(result.carbs_g).toBeNull()
    expect(result.calories_kcal).toBe(330)
  })

  // SDD: 022 REQ-011 AC-011.7
  it("un valor igual a 0 sigue siendo 0, no null", () => {
    const result = portionNutrients(
      { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      250
    )

    expect(result).toEqual({ calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  })

  // SDD: 022 REQ-012 AC-012.3
  it("el gallo pinto de 250 g da 400 kcal, 13,75 g, 67,5 g y 8 g", () => {
    const result = portionNutrients(
      { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
      250
    )

    expect(result).toEqual({ calories_kcal: 400, protein_g: 13.75, carbs_g: 67.5, fat_g: 8 })
  })
})

describe("nutrientProgress", () => {
  // SDD: 022 REQ-014 AC-014.1
  it("650 de 2000 kcal: quedan 1350 y la barra al 32,5 %", () => {
    expect(nutrientProgress(650, 2000, 0)).toEqual({
      consumed: 650,
      remaining: 1350,
      over: false,
      percent: 32.5,
    })
  })

  // SDD: 022 REQ-014 AC-014.1
  it("45 de 150 g de proteína: quedan 105,0 y la barra al 30 %", () => {
    const view = nutrientProgress(45, 150, 1)

    expect(view.remaining).toBe(105)
    expect(view.over).toBe(false)
    expect(view.percent).toBe(30)
  })

  // SDD: 022 REQ-014 AC-014.1
  it("80,5 de 200 g: quedan 119,5", () => {
    expect(nutrientProgress(80.5, 200, 1).remaining).toBe(119.5)
  })

  // SDD: 022 REQ-014 AC-014.1
  it("resta del consumo ya redondeado para que las cifras cuadren", () => {
    const view = nutrientProgress(650.4, 2000, 0)

    expect(view.consumed).toBe(650)
    expect(view.remaining).toBe(1350)
  })

  // SDD: 022 REQ-014 AC-014.2
  it("2150 de 2000 kcal: por encima en 150 y la barra llena", () => {
    const view = nutrientProgress(2150, 2000, 0)

    expect(view.over).toBe(true)
    expect(Math.abs(view.remaining)).toBe(150)
    expect(view.percent).toBe(100)
  })

  // SDD: 022 REQ-014 AC-014.2
  it("al llegar exactamente al objetivo la barra está llena y no hay exceso", () => {
    const view = nutrientProgress(2000, 2000, 0)

    expect(view.over).toBe(false)
    expect(view.remaining).toBe(0)
    expect(view.percent).toBe(100)
  })

  // SDD: 022 REQ-014 AC-014.5
  it("sin consumo: quedan 2000 kcal y la barra vacía", () => {
    expect(nutrientProgress(0, 2000, 0)).toEqual({
      consumed: 0,
      remaining: 2000,
      over: false,
      percent: 0,
    })
  })

  // SDD: 022 REQ-014 AC-014.5
  it("con un objetivo de 0 el porcentaje es 0", () => {
    expect(nutrientProgress(10, 0, 0).percent).toBe(0)
  })
})
