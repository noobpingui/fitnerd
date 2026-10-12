import { describe, expect, it } from "vitest"
import {
  dateOfBirthError,
  isDateOfBirthValid,
} from "@/features/onboarding/validation"
import { makeAnswers } from "@/test/profileFixtures"

// Hoy fijo: 11 de octubre de 2026.
const TODAY = new Date(2026, 9, 11)
const FUTURE = "La fecha de nacimiento no puede ser futura"
const RANGE = "Debes tener entre 14 y 100 años"

const dob = (value: string) => makeAnswers({ dateOfBirth: value })

describe("dateOfBirthError", () => {
  // SDD: REQ-009 AC-009.2
  it("una fecha vacía no es válida pero no muestra ningún mensaje", () => {
    expect(isDateOfBirthValid(dob(""), TODAY)).toBe(false)
    const error = dateOfBirthError(dob(""), TODAY)
    expect(error).not.toBe(FUTURE)
    expect(error).not.toBe(RANGE)
  })

  // SDD: REQ-009 AC-009.3
  it("una fecha futura da el mensaje de fecha futura", () => {
    expect(dateOfBirthError(dob("2026-10-12"), TODAY)).toBe(FUTURE)
    expect(isDateOfBirthValid(dob("2026-10-12"), TODAY)).toBe(false)
  })

  // SDD: REQ-009 AC-009.4
  it("menos de 14 años da el mensaje de rango de edad", () => {
    expect(dateOfBirthError(dob("2020-01-01"), TODAY)).toBe(RANGE)
    expect(dateOfBirthError(dob("2012-10-12"), TODAY)).toBe(RANGE)
  })

  // SDD: REQ-009 AC-009.4
  it("más de 100 años da el mensaje de rango de edad", () => {
    expect(dateOfBirthError(dob("1900-01-01"), TODAY)).toBe(RANGE)
    expect(dateOfBirthError(dob("1925-10-11"), TODAY)).toBe(RANGE)
  })

  // SDD: REQ-009 AC-009.1
  it("los límites exactos de 14 y 100 años son válidos", () => {
    expect(dateOfBirthError(dob("2012-10-11"), TODAY)).toBeNull()
    expect(isDateOfBirthValid(dob("2012-10-11"), TODAY)).toBe(true)
    expect(dateOfBirthError(dob("1925-10-12"), TODAY)).toBeNull()
    expect(isDateOfBirthValid(dob("1925-10-12"), TODAY)).toBe(true)
  })

  // SDD: REQ-011 AC-011.4
  it("una fecha normal es válida y no tiene error", () => {
    expect(dateOfBirthError(dob("1998-04-03"), TODAY)).toBeNull()
    expect(isDateOfBirthValid(dob("1998-04-03"), TODAY)).toBe(true)
  })
})
