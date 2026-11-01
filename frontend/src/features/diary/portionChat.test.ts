// Lógica pura del chat de porciones (spec 031).
import { describe, expect, it } from "vitest"
import { makeEggsWithPer100g, makePortionEstimate } from "@/test/portionEstimateFixtures"
import {
  formatEstimatedGrams,
  formatPer100gLine,
  latestEstimateAnswer,
  portionAnswerFromEstimate,
  portionFoodFormDefaults,
} from "./portionChat"
import type { PortionChatTurn, PortionEstimate, PortionEstimateAnswer } from "./types"

const EGGS_ANSWER: PortionEstimateAnswer = {
  kind: "estimate",
  grams: 250,
  unit: "5 huevos grandes",
  note: null,
  name: "Huevo",
  per100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
}
const BANANA_ANSWER: PortionEstimateAnswer = {
  kind: "estimate",
  grams: 120,
  unit: null,
  note: null,
  name: "Plátano",
  per100g: { calories_kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 },
}

describe("formatEstimatedGrams", () => {
  // SDD: 031 REQ-005 AC-005.1
  it("250 es «Unos 250 g»", () => {
    expect(formatEstimatedGrams(250)).toBe("Unos 250 g")
  })

  // SDD: 031 REQ-005 AC-005.3
  it("5000 es «Unos 5000 g», sin separador de miles ni decimales", () => {
    expect(formatEstimatedGrams(5000)).toBe("Unos 5000 g")
  })
})

describe("portionAnswerFromEstimate", () => {
  // SDD: 031 REQ-005 AC-005.1
  it("una estimación completa da una respuesta estimate con gramos, porción y nota", () => {
    expect(portionAnswerFromEstimate(makePortionEstimate())).toEqual({
      kind: "estimate",
      grams: 250,
      unit: "5 huevos grandes",
      note: "Unos 50 g por huevo sin cáscara.",
    })
  })

  // SDD: 031 REQ-005 AC-005.2
  it("una estimación sin porción ni nota conserva los nulos", () => {
    expect(
      portionAnswerFromEstimate({ status: "estimated", grams: 120, unit: null, note: null })
    ).toEqual({ kind: "estimate", grams: 120, unit: null, note: null })
  })

  // SDD: 031 REQ-006 AC-006.1
  it("not_food da una respuesta message con el texto recibido", () => {
    expect(
      portionAnswerFromEstimate({
        status: "not_food",
        message: "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento.",
      })
    ).toEqual({
      kind: "message",
      text: "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento.",
    })
  })

  // SDD: 031 REQ-006 AC-006.2
  it("unknown da una respuesta message con el texto recibido", () => {
    expect(
      portionAnswerFromEstimate({
        status: "unknown",
        message: "No he podido estimar el peso. Prueba a describir el alimento de otra forma.",
      })
    ).toEqual({
      kind: "message",
      text: "No he podido estimar el peso. Prueba a describir el alimento de otra forma.",
    })
  })

  // SDD: 032 REQ-011 AC-011.1
  it("una estimación con nombre y valores por 100 g los lleva a la respuesta", () => {
    expect(portionAnswerFromEstimate(makeEggsWithPer100g())).toEqual({
      kind: "estimate",
      grams: 250,
      unit: "5 huevos grandes",
      note: "Unos 50 g por huevo sin cáscara.",
      name: "Huevo",
      per100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
    })
  })

  // SDD: 032 REQ-011 AC-011.1
  it("name y per_100g nulos o ausentes no aparecen en la respuesta", () => {
    const nulls = portionAnswerFromEstimate(
      makePortionEstimate({ name: null, per_100g: null } as Partial<PortionEstimate>)
    )
    const absent = portionAnswerFromEstimate(makePortionEstimate())

    for (const answer of [nulls, absent]) {
      expect(answer).toMatchObject({ kind: "estimate", grams: 250 })
      expect((answer as PortionEstimateAnswer).name ?? null).toBeNull()
      expect((answer as PortionEstimateAnswer).per100g ?? null).toBeNull()
    }
    expect(portionAnswerFromEstimate(makeEggsWithPer100g())).toMatchObject({
      name: "Huevo",
      per100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
    })
  })
})

describe("formatPer100gLine", () => {
  // SDD: 032 REQ-005 AC-005.1
  it("143 kcal, 12,6 g, 0,7 g y 9,5 g dan la línea completa con coma decimal", () => {
    expect(formatPer100gLine(EGGS_ANSWER.per100g!)).toBe(
      "Por 100 g: 143 kcal · 12,6 g proteína · 0,7 g carbohidratos · 9,5 g grasa"
    )
  })

  // SDD: 032 REQ-005 AC-005.3
  it("52,4 kcal se muestra como 52 y 0 g como «0,0 g»", () => {
    expect(
      formatPer100gLine({ calories_kcal: 52.4, protein_g: 0, carbs_g: 13.8, fat_g: 0.2 })
    ).toBe("Por 100 g: 52 kcal · 0,0 g proteína · 13,8 g carbohidratos · 0,2 g grasa")
  })
})

describe("latestEstimateAnswer", () => {
  const turn = (id: number, answer: PortionChatTurn["answer"]): PortionChatTurn => ({
    id,
    question: `pregunta ${String(id)}`,
    answer,
  })

  // SDD: 032 REQ-006 AC-006.1
  it("sin turnos devuelve null", () => {
    expect(latestEstimateAnswer([])).toBeNull()
  })

  // SDD: 032 REQ-006 AC-006.2
  it("con la última pregunta estimada devuelve su respuesta", () => {
    expect(latestEstimateAnswer([turn(1, EGGS_ANSWER)])).toEqual(EGGS_ANSWER)
  })

  // SDD: 032 REQ-006 AC-006.3
  it("con la última pregunta en curso devuelve null aunque la anterior fuera una estimación", () => {
    expect(latestEstimateAnswer([turn(1, EGGS_ANSWER), turn(2, null)])).toBeNull()
  })

  // SDD: 032 REQ-006 AC-006.4
  it.each([
    ["un mensaje", { kind: "message", text: "No es comida." } as const],
    ["un aviso", { kind: "notice", text: "Límite alcanzado." } as const],
    ["un error", { kind: "error", text: "Fallo." } as const],
  ])("con la última respuesta %s devuelve null aunque la anterior fuera una estimación", (_n, last) => {
    expect(latestEstimateAnswer([turn(1, EGGS_ANSWER), turn(2, last)])).toBeNull()
  })

  // SDD: 032 REQ-006 AC-006.5
  it("una estimación sin nombre ni valores por 100 g también cuenta", () => {
    const bare: PortionEstimateAnswer = { kind: "estimate", grams: 120, unit: null, note: null }

    expect(latestEstimateAnswer([turn(1, bare)])).toEqual(bare)
  })

  // SDD: 032 REQ-007 AC-007.5
  it("con dos estimaciones devuelve la de la última pregunta", () => {
    expect(latestEstimateAnswer([turn(1, EGGS_ANSWER), turn(2, BANANA_ANSWER)])).toEqual(
      BANANA_ANSWER
    )
  })
})

describe("portionFoodFormDefaults", () => {
  // SDD: 032 REQ-007 AC-007.1
  it("precarga nombre, gramos y los cuatro valores por 100 g con coma decimal", () => {
    expect(portionFoodFormDefaults(EGGS_ANSWER)).toEqual({
      name: "Huevo",
      grams: "250",
      calories: "143",
      protein: "12,6",
      carbs: "0,7",
      fat: "9,5",
    })
  })

  // SDD: 032 REQ-007 AC-007.3
  it("sin nombre ni valores por 100 g deja esos campos vacíos y conserva los gramos", () => {
    expect(
      portionFoodFormDefaults({ kind: "estimate", grams: 120, unit: null, note: null })
    ).toEqual({ name: "", grams: "120", calories: "", protein: "", carbs: "", fat: "" })
  })

  // SDD: 032 REQ-007 AC-007.4
  it("no recorta los gramos por encima de 2000: 3000 se precarga tal cual", () => {
    expect(
      portionFoodFormDefaults({ kind: "estimate", grams: 3000, unit: null, note: null }).grams
    ).toBe("3000")
  })
})
