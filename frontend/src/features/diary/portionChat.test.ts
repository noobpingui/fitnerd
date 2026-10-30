// Lógica pura del chat de porciones (spec 031).
import { describe, expect, it } from "vitest"
import { makePortionEstimate } from "@/test/portionEstimateFixtures"
import { formatEstimatedGrams, portionAnswerFromEstimate } from "./portionChat"

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
})
