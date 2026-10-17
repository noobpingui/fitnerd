// Test UNITARIO puro de las utilidades de fechas compartidas. Antes vivían en
// features/body-metrics/dateUtils.test.ts; se movieron aquí junto al archivo
// que prueban (spec 013).
import { describe, it, expect, vi, afterEach } from "vitest"
import { parseLocalDate, shiftIsoDate, todayIsoDate } from "@/lib/dates"

describe("shiftIsoDate", () => {
  // SDD: 016 REQ-002 AC-002.2
  it("resta 365 días a 2026-10-12 y da 2025-10-12", () => {
    expect(shiftIsoDate("2026-10-12", -365)).toBe("2025-10-12")
  })

  // SDD: 016 REQ-002 AC-002.3
  it("con 0 días devuelve la misma fecha y suma días hacia delante", () => {
    expect(shiftIsoDate("2026-10-12", 0)).toBe("2026-10-12")
    expect(shiftIsoDate("2026-10-12", 20)).toBe("2026-11-01")
  })

  // SDD: 016 REQ-002 AC-002.7
  it("cruza el cambio de año en ambos sentidos", () => {
    expect(shiftIsoDate("2026-01-03", -5)).toBe("2025-12-29")
    expect(shiftIsoDate("2025-12-29", 5)).toBe("2026-01-03")
  })

  // SDD: 016 REQ-002 AC-002.7
  it("respeta el 29 de febrero de un año bisiesto", () => {
    expect(shiftIsoDate("2024-03-01", -1)).toBe("2024-02-29")
    expect(shiftIsoDate("2024-02-28", 2)).toBe("2024-03-01")
    expect(shiftIsoDate("2025-03-01", -1)).toBe("2025-02-28")
  })
})

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
