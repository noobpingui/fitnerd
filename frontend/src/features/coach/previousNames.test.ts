// Tests UNITARIOS puros de los nombres anteriores de la cuenta (spec 034,
// REQ-013): qué nombres recuerda `/coach` y cuáles envía como `previous_names`.
import { describe, expect, it } from "vitest"
import { previousNamesFor, rememberName } from "./previousNames"

describe("rememberName", () => {
  // SDD: 034 REQ-013 AC-013.1
  it("añade el nombre al final de la lista", () => {
    expect(rememberName([], "Carlitos")).toEqual(["Carlitos"])
    expect(rememberName(["Carlitos"], "Carlos")).toEqual(["Carlitos", "Carlos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("recorta los espacios de los extremos", () => {
    expect(rememberName([], "  Carlos  ")).toEqual(["Carlos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("mueve al final un nombre repetido sin duplicarlo", () => {
    expect(rememberName(["Carlitos", "Carlos"], "Carlitos")).toEqual(["Carlos", "Carlitos"])
    expect(rememberName(["Carlos"], " Carlos ")).toEqual(["Carlos"])
  })

  // SDD: 034 REQ-013 AC-013.2
  it("no cambia la lista con nombres nulos, vacíos o de solo espacios", () => {
    const seen = ["Carlitos"]
    expect(rememberName(seen, null)).toEqual(["Carlitos"])
    expect(rememberName(seen, undefined)).toEqual(["Carlitos"])
    expect(rememberName(seen, "")).toEqual(["Carlitos"])
    expect(rememberName(seen, "   ")).toEqual(["Carlitos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("cuenta la longitud en puntos de código y rechaza 101", () => {
    const hundred = "😀".repeat(100)
    const tooLong = "a".repeat(100) + "😀"
    expect(rememberName([], hundred)).toEqual([hundred])
    expect(rememberName(["Carlitos"], tooLong)).toEqual(["Carlitos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("guarda como mucho 6 nombres (el actual y 5 anteriores) y conserva los últimos", () => {
    let seen: string[] = []
    for (const name of ["N1", "N2", "N3", "N4", "N5", "N6", "N7"]) {
      seen = rememberName(seen, name)
    }
    expect(seen).toEqual(["N2", "N3", "N4", "N5", "N6", "N7"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("no modifica la lista recibida", () => {
    const seen = ["Carlitos"]
    rememberName(seen, "Carlos")
    expect(seen).toEqual(["Carlitos"])
  })
})

describe("previousNamesFor", () => {
  // SDD: 034 REQ-013 AC-013.1
  it("devuelve los nombres vistos distintos del actual", () => {
    expect(previousNamesFor(["Carlitos", "Carlos"], "Carlos")).toEqual(["Carlitos"])
  })

  // SDD: 034 REQ-013 AC-013.2
  it("devuelve una lista vacía si solo se ha visto el nombre actual", () => {
    expect(previousNamesFor(["Carlos"], "Carlos")).toEqual([])
    expect(previousNamesFor([], "Carlos")).toEqual([])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("recorta el nombre actual antes de compararlo", () => {
    expect(previousNamesFor(["Carlitos", "Carlos"], "  Carlos ")).toEqual(["Carlitos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("con el nombre actual nulo devuelve todos los vistos", () => {
    expect(previousNamesFor(["Carlitos", "Carlos"], null)).toEqual(["Carlitos", "Carlos"])
    expect(previousNamesFor(["Carlitos"], undefined)).toEqual(["Carlitos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("devuelve como mucho los 5 últimos, en orden", () => {
    const seen = ["N1", "N2", "N3", "N4", "N5", "N6"]
    expect(previousNamesFor(seen, null)).toEqual(["N2", "N3", "N4", "N5", "N6"])
    expect(previousNamesFor(seen, "N6")).toEqual(["N1", "N2", "N3", "N4", "N5"])
  })
})
