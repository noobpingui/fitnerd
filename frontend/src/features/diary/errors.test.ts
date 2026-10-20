// Mensajes de error al guardar o quitar en el diario (spec 022).
import { describe, expect, it } from "vitest"
import { ApiError } from "@/lib/apiClient"
import { SAVE_FAILED_MESSAGE, saveErrorMessage } from "./errors"

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
