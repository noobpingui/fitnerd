// Cómo se presenta cada fallo de la búsqueda de alimentos (spec 021).
import { describe, expect, it } from "vitest"
import { ApiError } from "@/lib/apiClient"
import { SEARCH_FAILED_MESSAGE, searchErrorView } from "./searchError"

const RATE_LIMIT_MESSAGE =
  "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
const UNAVAILABLE_MESSAGE =
  "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."

describe("searchErrorView", () => {
  // SDD: 021 REQ-013 AC-013.6
  it("muestra el mensaje del servidor sin «Reintentar» ante un 429", () => {
    expect(searchErrorView(new ApiError(429, RATE_LIMIT_MESSAGE))).toEqual({
      message: RATE_LIMIT_MESSAGE,
      canRetry: false,
    })
  })

  // SDD: 021 REQ-013 AC-013.7
  it("muestra el mensaje del servidor con «Reintentar» ante un 503", () => {
    expect(searchErrorView(new ApiError(503, UNAVAILABLE_MESSAGE))).toEqual({
      message: UNAVAILABLE_MESSAGE,
      canRetry: true,
    })
  })

  // SDD: 021 REQ-013 AC-013.4
  it("muestra el mensaje genérico con «Reintentar» ante un 500", () => {
    expect(searchErrorView(new ApiError(500, "boom"))).toEqual({
      message: "No se pudo completar la búsqueda.",
      canRetry: true,
    })
    expect(SEARCH_FAILED_MESSAGE).toBe("No se pudo completar la búsqueda.")
  })

  // SDD: 021 REQ-013 AC-013.4
  it("muestra el mensaje genérico con «Reintentar» ante un error de red", () => {
    expect(searchErrorView(new TypeError("Failed to fetch"))).toEqual({
      message: SEARCH_FAILED_MESSAGE,
      canRetry: true,
    })
  })
})
