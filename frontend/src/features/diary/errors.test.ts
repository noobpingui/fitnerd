// Mensajes de error al guardar o quitar en el diario (spec 022).
import { describe, expect, it } from "vitest"
import { ApiError } from "@/lib/apiClient"
import {
  ANALYSIS_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  analysisErrorView,
  saveErrorMessage,
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
