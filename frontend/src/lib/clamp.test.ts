// Test UNITARIO puro: clamp es una función sin efectos, sin React y sin red.
// Un `it` por AC de la spec 000, agrupados en un `describe` por REQ, siguiendo
// el orden de evaluación obligatorio del plan §3.3.
import { describe, it, expect } from "vitest"
import { clamp } from "./clamp"

describe("REQ-001 — valor dentro del rango", () => {
  // SDD: REQ-001 AC-001.1
  it("devuelve el valor sin modificarlo cuando está dentro del rango", () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  // SDD: REQ-001 AC-001.2
  it("devuelve el valor cuando coincide con el límite inferior (inclusivo)", () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  // SDD: REQ-001 AC-001.3
  it("devuelve el valor cuando coincide con el límite superior (inclusivo)", () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })

  // SDD: REQ-001 AC-001.4
  it("devuelve el valor dentro de un rango con decimales y negativos", () => {
    expect(clamp(-0.25, -1.5, 2.5)).toBe(-0.25)
  })
})

describe("REQ-002 — valor por debajo del rango", () => {
  // SDD: REQ-002 AC-002.1
  it("devuelve min cuando el valor está por debajo del rango", () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  // SDD: REQ-002 AC-002.2
  it("devuelve min cuando el valor es -Infinity", () => {
    expect(clamp(-Infinity, 0, 10)).toBe(0)
  })
})

describe("REQ-003 — valor por encima del rango", () => {
  // SDD: REQ-003 AC-003.1
  it("devuelve max cuando el valor está por encima del rango", () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  // SDD: REQ-003 AC-003.2
  it("devuelve max cuando el valor es Infinity", () => {
    expect(clamp(Infinity, 0, 10)).toBe(10)
  })
})

describe("REQ-004 — rango degenerado (min igual a max)", () => {
  // SDD: REQ-004 AC-004.1
  it("devuelve el valor común del rango degenerado cuando value está por debajo", () => {
    expect(clamp(1, 3, 3)).toBe(3)
  })

  // SDD: REQ-004 AC-004.2
  it("devuelve el valor común del rango degenerado cuando value está por encima", () => {
    expect(clamp(7, 3, 3)).toBe(3)
  })
})

describe("REQ-005 — rango inválido", () => {
  // SDD: REQ-005 AC-005.1
  it("lanza RangeError cuando min es mayor que max", () => {
    expect(() => clamp(5, 10, 0)).toThrow(RangeError)
  })

  // SDD: REQ-005 AC-005.2
  it("incluye min y max en el mensaje exacto del RangeError", () => {
    // No se usa toThrow(string): solo comprueba subcadena, no el mensaje exacto.
    let capturedError: unknown
    try {
      clamp(5, 10, 0)
    } catch (error) {
      capturedError = error
    }
    expect(capturedError).toBeInstanceOf(RangeError)
    expect((capturedError as Error).message).toBe(
      "clamp: min (10) no puede ser mayor que max (0)"
    )
  })

  // SDD: REQ-005 AC-005.3
  it("lanza RangeError aunque value coincida con uno de los límites", () => {
    expect(() => clamp(10, 10, 0)).toThrow(RangeError)
  })
})

describe("REQ-006 — entradas NaN", () => {
  // SDD: REQ-006 AC-006.1
  it("devuelve NaN cuando value es NaN y el rango es válido", () => {
    expect(clamp(NaN, 0, 10)).toBeNaN()
  })

  // SDD: REQ-006 AC-006.2
  it("lanza RangeError cuando min es NaN", () => {
    expect(() => clamp(5, NaN, 10)).toThrow(RangeError)
  })

  // SDD: REQ-006 AC-006.3
  it("lanza RangeError cuando max es NaN", () => {
    expect(() => clamp(5, 0, NaN)).toThrow(RangeError)
  })

  // SDD: REQ-006 AC-006.4
  it("usa el mensaje exacto cuando un límite es NaN", () => {
    let capturedError: unknown
    try {
      clamp(5, NaN, 10)
    } catch (error) {
      capturedError = error
    }
    expect(capturedError).toBeInstanceOf(RangeError)
    expect((capturedError as Error).message).toBe(
      "clamp: min y max deben ser números válidos"
    )
  })

  // SDD: REQ-006 AC-006.5
  it("devuelve NaN incluso con un rango degenerado (prevalece sobre REQ-004)", () => {
    expect(clamp(NaN, 3, 3)).toBeNaN()
  })
})

describe("REQ-007 — límites infinitos", () => {
  // SDD: REQ-007 AC-007.1
  it("acepta -Infinity como límite inferior válido", () => {
    expect(clamp(-1000, -Infinity, 10)).toBe(-1000)
  })

  // SDD: REQ-007 AC-007.2
  it("acepta Infinity como límite superior válido", () => {
    expect(clamp(1000, 0, Infinity)).toBe(1000)
  })
})
