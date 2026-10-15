// Test UNITARIO puro de las utilidades de fechas compartidas. Antes vivían en
// features/body-metrics/dateUtils.test.ts; se movieron aquí junto al archivo
// que prueban (spec 013).
import { describe, it, expect, vi, afterEach } from "vitest"
import { parseLocalDate, todayIsoDate } from "@/lib/dates"

describe("parseLocalDate", () => {
  // SDD: 013 NFR-002 AC-N002.1
  it("construye la fecha en el día correcto, sin corrimiento por UTC", () => {
    const date = parseLocalDate("2026-03-15")

    // getDate()/getMonth() leen en hora LOCAL (a diferencia de
    // getUTCDate()) - si parseLocalDate alguna vez volviera a usar
    // new Date(isoDate) directo, este test fallaría en cualquier huso
    // horario negativo, que es exactamente el bug que se está evitando.
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2) // 0-indexado: marzo = 2
    expect(date.getDate()).toBe(15)
  })
})

describe("todayIsoDate", () => {
  afterEach(() => {
    // Devuelve el reloj del sistema a la hora real después de cada test -
    // sin esto, "hoy" quedaría congelado para el resto de la corrida.
    vi.useRealTimers()
  })

  // SDD: 013 NFR-002 AC-N002.1
  it("devuelve la fecha de HOY en formato YYYY-MM-DD, con ceros a la izquierda", () => {
    // Fecha fija (no "la de hoy de verdad") para que el test sea
    // determinístico - sin esto, el test podría fallar una vez cada tanto
    // justo si corriera a medianoche.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 5)) // 5 de marzo de 2026, hora local

    expect(todayIsoDate()).toBe("2026-03-05")
  })
})
