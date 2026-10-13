// Test UNITARIO puro: nada de React, nada de red - solo funciones y sus
// valores de entrada/salida. El foco es el motivo por el que este archivo
// existe (ver el comentario en dateUtils.ts): evitar el corrimiento de dia
// que da new Date("YYYY-MM-DD") en husos horarios negativos como Costa Rica.
import { describe, it, expect, vi, afterEach } from "vitest"
import {
  parseLocalDate,
  formatDate,
  todayIsoDate,
  isWithinLastMonths,
  periodStart,
} from "./dateUtils"

describe("parseLocalDate", () => {
  it("construye la fecha en el dia correcto, sin corrimiento por UTC", () => {
    const date = parseLocalDate("2026-03-15")

    // getDate()/getMonth() leen en hora LOCAL (a diferencia de
    // getUTCDate()) - si parseLocalDate alguna vez volviera a usar
    // new Date(isoDate) directo, este test fallaria en cualquier huso
    // horario negativo, que es exactamente el bug que se esta evitando.
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2) // 0-indexado: marzo = 2
    expect(date.getDate()).toBe(15)
  })
})

describe("formatDate", () => {
  it("muestra el mismo dia del mes que se le paso, no el dia anterior", () => {
    // El bug que este test previene: si formatDate usara new Date(iso)
    // directo, en UTC-6 "2026-01-01" se formatearia como 31 de diciembre.
    const formatted = formatDate("2026-01-01")
    expect(formatted).toContain("1")
    expect(formatted).not.toContain("31")
  })
})

describe("todayIsoDate", () => {
  afterEach(() => {
    // Devuelve el reloj del sistema a la hora real despues de cada test -
    // sin esto, "hoy" quedaria congelado para el resto de la corrida.
    vi.useRealTimers()
  })

  it("devuelve la fecha de HOY en formato YYYY-MM-DD, con ceros a la izquierda", () => {
    // Fecha fija (no "la de hoy de verdad") para que el test sea
    // determinístico - sin esto, el test podria fallar una vez cada tanto
    // justo si corriera a medianoche.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 5)) // 5 de marzo de 2026, hora local

    expect(todayIsoDate()).toBe("2026-03-05")
  })
})

describe("isWithinLastMonths", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("es true para una fecha dentro de la ventana", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15)) // 15 de junio de 2026

    // 2 meses atras de "hoy" (15 de junio) cae en 15 de abril - el 1 de
    // mayo esta DESPUES de ese corte, entra en la ventana.
    expect(isWithinLastMonths("2026-05-01", 2)).toBe(true)
  })

  it("es false para una fecha fuera de la ventana", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15))

    expect(isWithinLastMonths("2025-01-01", 2)).toBe(false)
  })
})

describe("periodStart", () => {
  // SDD: REQ-005 AC-005.1
  it("returns the same date 1, 3 and 12 months earlier", () => {
    expect(periodStart("2026-10-12", 1)).toBe("2026-09-12")
    expect(periodStart("2026-10-12", 3)).toBe("2026-07-12")
    expect(periodStart("2026-10-12", 12)).toBe("2025-10-12")
  })

  // SDD: REQ-005 AC-005.1
  it("uses the last day of the month when the day does not exist", () => {
    expect(periodStart("2026-03-31", 1)).toBe("2026-02-28")
    expect(periodStart("2024-03-31", 1)).toBe("2024-02-29")
    expect(periodStart("2026-05-31", 3)).toBe("2026-02-28")
  })
})

describe("isWithinLastMonths - límite inferior", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-005 AC-005.1
  it("includes a measurement exactly one month ago even in the afternoon", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 15)) // 12 de octubre, 15:00

    expect(isWithinLastMonths("2026-09-12", 1)).toBe(true)
    expect(isWithinLastMonths("2026-09-11", 1)).toBe(false)
  })
})
