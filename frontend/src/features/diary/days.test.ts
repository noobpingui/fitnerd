// Fechas navegables del diario (spec 026): lógica pura, sin red ni reloj.
import { describe, expect, it } from "vitest"
import { diaryDateBounds, isIsoDate, resolveDiaryDate } from "./days"

const TODAY = "2026-10-26"

describe("isIsoDate", () => {
  // SDD: 026 REQ-003 AC-003.3
  it.each(["2026-10-26", "2024-02-29", "2025-12-31", "2026-01-01"])(
    "«%s» es una fecha AAAA-MM-DD real",
    (text) => {
      expect(isIsoDate(text)).toBe(true)
    }
  )

  // SDD: 026 REQ-003 AC-003.3
  it.each([
    "2026-02-30",
    "2026-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-10-32",
    "ayer",
    "",
    "2026-1-5",
    "26-10-2026",
    "2026/10/26",
    "2026-10-26T00:00",
    " 2026-10-26",
  ])("«%s» no es una fecha válida", (text) => {
    expect(isIsoDate(text)).toBe(false)
  })
})

describe("diaryDateBounds", () => {
  // SDD: 026 REQ-002 AC-002.5
  // SDD: 026 REQ-002 AC-002.6
  it("con hoy el 2026-10-26 va de 2025-10-26 a 2026-10-26", () => {
    expect(diaryDateBounds("2026-10-26")).toEqual({ min: "2025-10-26", max: "2026-10-26" })
  })

  // SDD: 026 REQ-002 AC-002.5
  it("cuenta 365 días hacia atrás también a través de un año bisiesto", () => {
    expect(diaryDateBounds("2024-03-01")).toEqual({ min: "2023-03-02", max: "2024-03-01" })
  })
})

describe("resolveDiaryDate", () => {
  // SDD: 026 REQ-003 AC-003.1
  it("una fecha válida del intervalo se muestra tal cual y no se normaliza", () => {
    expect(resolveDiaryDate("2026-10-20", TODAY)).toEqual({ date: "2026-10-20", normalize: false })
  })

  // SDD: 026 REQ-003 AC-003.1
  it("los dos extremos del intervalo son válidos", () => {
    expect(resolveDiaryDate("2025-10-26", TODAY)).toEqual({ date: "2025-10-26", normalize: false })
    expect(resolveDiaryDate("2026-10-25", TODAY)).toEqual({ date: "2026-10-25", normalize: false })
  })

  // SDD: 026 REQ-003 AC-003.3
  it.each(["2026-02-30", "ayer", "2026-10-27", "2025-10-25", ""])(
    "el parámetro «%s» (inválido o fuera del intervalo) vuelve a hoy y pide normalizar",
    (param) => {
      expect(resolveDiaryDate(param, TODAY)).toEqual({ date: TODAY, normalize: true })
    }
  )

  // SDD: 026 REQ-003 AC-003.2
  it("el parámetro igual a hoy se muestra y pide quitar el parámetro", () => {
    expect(resolveDiaryDate(TODAY, TODAY)).toEqual({ date: TODAY, normalize: true })
  })

  // SDD: 026 REQ-003 AC-003.2
  it("sin parámetro muestra hoy y no normaliza", () => {
    expect(resolveDiaryDate(null, TODAY)).toEqual({ date: TODAY, normalize: false })
  })
})
