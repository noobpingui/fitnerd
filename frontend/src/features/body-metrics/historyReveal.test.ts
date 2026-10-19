// Test unitario del cálculo de filas visibles del Historial para revelar una
// fecha (spec 020, REQ-003): crece en bloques de 10 y nunca se pliega.
import { describe, expect, it } from "vitest"
import { HISTORY_PAGE_SIZE, visibleCountToReveal } from "./historyReveal"

// n fechas ISO, una por día hacia atrás desde el 2026-10-11 (más reciente primero).
function datesBackFrom(n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(2026, 9, 11 - i)).toISOString().slice(0, 10)
  )
}

describe("HISTORY_PAGE_SIZE", () => {
  it("el bloque del Historial es de 10 filas", () => {
    expect(HISTORY_PAGE_SIZE).toBe(10)
  })
})

describe("visibleCountToReveal", () => {
  // SDD: 020 REQ-003 AC-003.3
  it("si la fecha ya es visible, no cambia el número de filas", () => {
    const dates = datesBackFrom(26)

    expect(visibleCountToReveal(dates, dates[0], 10)).toBe(10)
    expect(visibleCountToReveal(dates, dates[9], 10)).toBe(10)
  })

  // SDD: 020 REQ-003 AC-003.1
  it("con la fecha en la fila 26 y 10 visibles, despliega hasta 30", () => {
    const dates = datesBackFrom(26)

    expect(visibleCountToReveal(dates, dates[25], 10)).toBe(30)
  })

  // SDD: 020 REQ-003 AC-003.2
  it("con la fecha en la fila 17 y 10 visibles, despliega hasta 20", () => {
    const dates = datesBackFrom(35)

    expect(visibleCountToReveal(dates, dates[16], 10)).toBe(20)
  })

  // SDD: 020 REQ-003 AC-003.2
  it("la primera fila oculta (la 11) despliega solo un bloque más", () => {
    const dates = datesBackFrom(35)

    expect(visibleCountToReveal(dates, dates[10], 10)).toBe(20)
  })

  // SDD: 020 REQ-003 AC-003.2
  it("la fila 20 cabe justo en dos bloques y la 21 pide un tercero", () => {
    const dates = datesBackFrom(35)

    expect(visibleCountToReveal(dates, dates[19], 10)).toBe(20)
    expect(visibleCountToReveal(dates, dates[20], 10)).toBe(30)
  })

  // SDD: 020 REQ-003 AC-003.1
  it("si la fecha no está en la lista, deja las filas visibles como están", () => {
    const dates = datesBackFrom(26)

    expect(visibleCountToReveal(dates, "2020-01-01", 10)).toBe(10)
  })

  // SDD: 020 REQ-003 AC-003.4
  it("nunca pliega el Historial ya desplegado", () => {
    const dates = datesBackFrom(26)

    expect(visibleCountToReveal(dates, dates[0], 30)).toBe(30)
    expect(visibleCountToReveal(dates, dates[0], 25)).toBe(25)
    expect(visibleCountToReveal(dates, dates[24], 25)).toBe(25)
  })

  // SDD: 020 REQ-003 AC-003.4
  it("con la lista vacía devuelve las filas visibles", () => {
    expect(visibleCountToReveal([], "2026-10-11", 10)).toBe(10)
  })

  // SDD: 020 REQ-003 AC-003.2
  it("respeta un tamaño de bloque distinto", () => {
    const dates = datesBackFrom(20)

    expect(visibleCountToReveal(dates, dates[7], 5, 5)).toBe(10)
    expect(visibleCountToReveal(dates, dates[12], 5, 5)).toBe(15)
  })
})
