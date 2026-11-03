// Tests UNITARIOS de la preferencia del interruptor del coach (spec 034): se
// guarda solo en el navegador (localStorage), activada por defecto.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  PERSONAL_CONTEXT_STORAGE_KEY,
  readPersonalContextPreference,
  writePersonalContextPreference,
} from "./personalContextPreference"

describe("preferencia del contexto personal del coach", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // SDD: 034 REQ-010 AC-010.1
  it("la clave de almacenamiento es fitnerd_coach_personal_context", () => {
    expect(PERSONAL_CONTEXT_STORAGE_KEY).toBe("fitnerd_coach_personal_context")
    // Y es la clave que de verdad usa la implementación.
    writePersonalContextPreference(false)
    expect(localStorage.getItem("fitnerd_coach_personal_context")).toBe("off")
    expect(readPersonalContextPreference()).toBe(false)
  })

  // SDD: 034 REQ-010 AC-010.1
  it("sin clave guardada está activada", () => {
    expect(readPersonalContextPreference()).toBe(true)
  })

  // SDD: 034 REQ-010 AC-010.5
  it("tras desactivarla, se lee desactivada (también al recargar)", () => {
    writePersonalContextPreference(false)

    expect(localStorage.getItem(PERSONAL_CONTEXT_STORAGE_KEY)).toBe("off")
    expect(readPersonalContextPreference()).toBe(false)
  })

  // SDD: 034 REQ-010 AC-010.5
  it("al volver a activarla se lee activada", () => {
    writePersonalContextPreference(false)

    writePersonalContextPreference(true)

    expect(readPersonalContextPreference()).toBe(true)
    expect(localStorage.getItem(PERSONAL_CONTEXT_STORAGE_KEY)).not.toBe("off")
  })

  // SDD: 034 REQ-010 AC-010.1
  it("cualquier valor distinto de 'off' cuenta como activada", () => {
    localStorage.setItem(PERSONAL_CONTEXT_STORAGE_KEY, "otra cosa")

    expect(readPersonalContextPreference()).toBe(true)
  })

  // SDD: 034 REQ-010 AC-010.1
  it("si el almacenamiento falla al leer, queda activada", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("almacenamiento bloqueado")
    })

    expect(readPersonalContextPreference()).toBe(true)
  })

  // SDD: 034 REQ-010 AC-010.5
  it("si el almacenamiento falla al guardar, no lanza", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("almacenamiento lleno")
    })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("almacenamiento lleno")
    })

    expect(() => writePersonalContextPreference(false)).not.toThrow()
    expect(() => writePersonalContextPreference(true)).not.toThrow()
  })
})
