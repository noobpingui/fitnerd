// Mensajes de error al guardar o quitar en el diario (spec 022).
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { ApiError } from "@/lib/apiClient"
import {
  ANALYSIS_FAILED_MESSAGE,
  DELETE_CUSTOM_FOOD_FAILED_MESSAGE,
  FAVORITE_FAILED_MESSAGE,
  LIBRARY_LOAD_FAILED_MESSAGE,
  PORTION_ESTIMATE_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  analysisErrorView,
  favoriteErrorMessage,
  portionEstimateErrorAnswer,
  saveErrorMessage,
  updateCustomFoodErrorView,
} from "./errors"

describe("saveErrorMessage", () => {
  // SDD: 022 REQ-011 AC-011.6
  it("ante un 400 devuelve el mensaje del servidor", () => {
    expect(saveErrorMessage(new ApiError(400, "No encontramos ese alimento."))).toBe(
      "No encontramos ese alimento."
    )
  })

  // SDD: 022 REQ-011 AC-011.6
  it.each([401, 404, 429, 500, 503])("ante un %d devuelve el mensaje genérico", (status) => {
    expect(saveErrorMessage(new ApiError(status, "detalle interno"))).toBe(
      "No se pudo guardar. Vuelve a intentarlo."
    )
  })

  // SDD: 022 REQ-011 AC-011.6
  it("ante un error de red o desconocido devuelve el mensaje genérico", () => {
    expect(saveErrorMessage(new TypeError("Failed to fetch"))).toBe(SAVE_FAILED_MESSAGE)
    expect(saveErrorMessage("algo")).toBe(SAVE_FAILED_MESSAGE)
    expect(saveErrorMessage(undefined)).toBe(SAVE_FAILED_MESSAGE)
  })
})

describe("analysisErrorView", () => {
  const BUSY = "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."
  const LIMIT = "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."

  // SDD: 025 REQ-012 AC-012.1
  it("503: mensaje del servidor, «Reintentar» y «Registrar a mano»", () => {
    expect(analysisErrorView(new ApiError(503, BUSY))).toEqual({
      message: BUSY,
      canRetry: true,
      canChangePhoto: false,
      canRegisterManually: true,
    })
  })

  // SDD: 025 REQ-012 AC-012.3
  it("429: mensaje del servidor y «Registrar a mano», sin «Reintentar»", () => {
    expect(analysisErrorView(new ApiError(429, LIMIT))).toEqual({
      message: LIMIT,
      canRetry: false,
      canChangePhoto: false,
      canRegisterManually: true,
    })
  })

  // SDD: 025 REQ-012 AC-012.6
  it.each([400, 413])("%d: mensaje del servidor y «Cambiar foto»", (status) => {
    expect(analysisErrorView(new ApiError(status, "La imagen debe ser JPEG, PNG o WebP."))).toEqual({
      message: "La imagen debe ser JPEG, PNG o WebP.",
      canRetry: false,
      canChangePhoto: true,
      canRegisterManually: false,
    })
  })

  // SDD: 025 REQ-012 AC-012.4
  it("un fallo de red da el mensaje genérico con «Reintentar» y «Registrar a mano»", () => {
    expect(analysisErrorView(new TypeError("Failed to fetch"))).toEqual({
      message: ANALYSIS_FAILED_MESSAGE,
      canRetry: true,
      canChangePhoto: false,
      canRegisterManually: true,
    })
    expect(ANALYSIS_FAILED_MESSAGE).toBe("No se pudo analizar la foto. Vuelve a intentarlo.")
  })

  // SDD: 025 REQ-012 AC-012.4
  it.each([
    ["un 500", new ApiError(500, "boom")],
    ["un 401", new ApiError(401, "no autorizado")],
    ["un error inesperado", new Error("rompió")],
    ["un valor que no es un error", "algo"],
  ])("%s da el mensaje genérico con «Reintentar» y «Registrar a mano»", (_name, error) => {
    expect(analysisErrorView(error)).toEqual({
      message: ANALYSIS_FAILED_MESSAGE,
      canRetry: true,
      canChangePhoto: false,
      canRegisterManually: true,
    })
  })
})

describe("mensajes de la biblioteca de alimentos", () => {
  // SDD: 028 REQ-015 AC-015.4
  it("los textos fijos coinciden con los de la spec", () => {
    expect(FAVORITE_FAILED_MESSAGE).toBe("No se pudo actualizar tus favoritos.")
    expect(DELETE_CUSTOM_FOOD_FAILED_MESSAGE).toBe("No se pudo borrar el alimento.")
    expect(LIBRARY_LOAD_FAILED_MESSAGE).toBe("No se pudieron cargar tus alimentos.")
    // Y la funcion los usa (028): un 500 devuelve el texto fijo.
    expect(favoriteErrorMessage(new ApiError(500, "x"))).toBe(FAVORITE_FAILED_MESSAGE)
  })

  // SDD: 028 REQ-015 AC-015.5
  it("favoriteErrorMessage ante un 400 devuelve el mensaje del servidor (el límite de 100)", () => {
    const limit = "Ya tienes 100 favoritos. Quita alguno para añadir otro."

    expect(favoriteErrorMessage(new ApiError(400, limit))).toBe(limit)
  })

  // SDD: 028 REQ-015 AC-015.4
  it.each([401, 404, 429, 500, 503])(
    "favoriteErrorMessage ante un %d devuelve «No se pudo actualizar tus favoritos.»",
    (status) => {
      expect(favoriteErrorMessage(new ApiError(status, "detalle interno"))).toBe(
        "No se pudo actualizar tus favoritos."
      )
    }
  )

  // SDD: 028 REQ-015 AC-015.4
  it.each([
    ["un error de red", new TypeError("Failed to fetch")],
    ["un valor que no es un error", "algo"],
    ["nada", undefined],
  ])("favoriteErrorMessage ante %s devuelve el mensaje genérico", (_name, error) => {
    expect(favoriteErrorMessage(error)).toBe("No se pudo actualizar tus favoritos.")
  })
})

describe("updateCustomFoodErrorView", () => {
  // SDD: 029 REQ-010 AC-010.3
  it("un 409 es «nombre repetido»", () => {
    expect(
      updateCustomFoodErrorView(new ApiError(409, "Ya tienes un alimento con ese nombre."))
    ).toEqual({ kind: "name_taken" })
  })

  // SDD: 029 REQ-010 AC-010.4
  it("un 404 es «no encontrado» con el texto fijo de la spec, no el del servidor", () => {
    expect(updateCustomFoodErrorView(new ApiError(404, "detalle interno"))).toEqual({
      kind: "not_found",
      message: "No encontramos ese alimento.",
    })
  })

  // SDD: 029 REQ-010 AC-010.5
  it("un 400 devuelve el mensaje del servidor", () => {
    expect(
      updateCustomFoodErrorView(new ApiError(400, "Las calorías por 100 g deben estar entre 0 y 900."))
    ).toEqual({
      kind: "message",
      message: "Las calorías por 100 g deben estar entre 0 y 900.",
    })
  })

  // SDD: 029 REQ-010 AC-010.5
  it.each([401, 429, 500, 503])("un %d da «No se pudo guardar el alimento.»", (status) => {
    expect(updateCustomFoodErrorView(new ApiError(status, "detalle interno"))).toEqual({
      kind: "message",
      message: "No se pudo guardar el alimento.",
    })
  })

  // SDD: 029 REQ-010 AC-010.5
  it.each([
    ["un error de red", new TypeError("Failed to fetch")],
    ["un valor que no es un error", "algo"],
    ["nada", undefined],
  ])("%s da «No se pudo guardar el alimento.»", (_name, error) => {
    expect(updateCustomFoodErrorView(error)).toEqual({
      kind: "message",
      message: "No se pudo guardar el alimento.",
    })
  })
})

describe("portionEstimateErrorAnswer", () => {
  const RATE_LIMIT = "Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a intentarlo más tarde."

  // SDD: 031 REQ-007 AC-007.1
  it("un 429 da un aviso neutro con el mensaje del servidor", () => {
    expect(portionEstimateErrorAnswer(new ApiError(429, RATE_LIMIT))).toEqual({
      kind: "notice",
      text: RATE_LIMIT,
    })
  })

  // SDD: 031 REQ-007 AC-007.2
  it("un 503 da un error con el mensaje del servidor", () => {
    const message = "No se pudo estimar el peso en este momento. Vuelve a intentarlo en unos minutos."

    expect(portionEstimateErrorAnswer(new ApiError(503, message))).toEqual({
      kind: "error",
      text: message,
    })
  })

  // SDD: 031 REQ-007 AC-007.3
  it("un 400 da un error con el mensaje del servidor", () => {
    const message = "La pregunta no puede superar los 200 caracteres."

    expect(portionEstimateErrorAnswer(new ApiError(400, message))).toEqual({
      kind: "error",
      text: message,
    })
  })

  // SDD: 031 REQ-007 AC-007.4
  it.each([
    ["un 500", new ApiError(500, "boom interno")],
    ["un fallo de red", new TypeError("Failed to fetch")],
    ["un valor que no es un error", "algo"],
  ])("%s da el mensaje genérico sin el texto original", (_name, error) => {
    const answer = portionEstimateErrorAnswer(error)

    expect(answer).toEqual({ kind: "error", text: PORTION_ESTIMATE_FAILED_MESSAGE })
    expect(answer.text).not.toMatch(/boom|Failed to fetch/)
  })

  // SDD: 031 REQ-007 AC-007.5
  it("un ZodError da el mensaje genérico", () => {
    const zodError = new z.ZodError([
      { code: "custom", path: ["grams"], message: "Invalid input" },
    ])

    expect(portionEstimateErrorAnswer(zodError)).toEqual({
      kind: "error",
      text: "No se pudo estimar el peso. Vuelve a intentarlo.",
    })
  })
})
