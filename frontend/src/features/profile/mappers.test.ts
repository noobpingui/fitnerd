import { describe, expect, it } from "vitest"
import { EMPTY_ANSWERS } from "@/features/onboarding/constants"
import {
  answersFromProfile,
  payloadFromAnswers,
} from "@/features/profile/mappers"
import {
  makeAnswers,
  makePendingResponse,
  makeProfileResponse,
} from "@/test/profileFixtures"

describe("payloadFromAnswers", () => {
  // SDD: REQ-008 AC-008.1
  it("envía ft/in y lb con los campos de cm en null y la fecha de nacimiento", () => {
    const payload = payloadFromAnswers(
      makeAnswers({
        gender: "female",
        dateOfBirth: "1996-03-01",
        heightUnit: "ft",
        heightCm: "",
        heightFt: "5",
        heightIn: "9",
        weightUnit: "lb",
        weight: "160",
        activityLevel: "high",
        goal: "lose_slow",
      })
    )

    expect(payload).toEqual({
      date_of_birth: "1996-03-01",
      gender: "female",
      height_unit: "ft",
      height_cm: null,
      height_ft: 5,
      height_in: 9,
      weight_unit: "lb",
      weight: 160,
      activity_level: "high",
      goal: "lose_slow",
    })
  })

  // SDD: REQ-008 AC-008.1
  it("envía cm con ft/in en null", () => {
    const payload = payloadFromAnswers(
      makeAnswers({ heightUnit: "cm", heightCm: "175.5" })
    )

    expect(payload.height_unit).toBe("cm")
    expect(payload.height_cm).toBe(175.5)
    expect(payload.height_ft).toBeNull()
    expect(payload.height_in).toBeNull()
    expect(payload.weight_unit).toBe("kg")
    expect(payload.weight).toBe(72.5)
  })

  // SDD: REQ-008 AC-008.1
  it("las pulgadas vacías se envían como 0", () => {
    const payload = payloadFromAnswers(
      makeAnswers({ heightUnit: "ft", heightFt: "6", heightIn: "" })
    )

    expect(payload.height_ft).toBe(6)
    expect(payload.height_in).toBe(0)
  })

  // SDD: REQ-008 AC-008.1
  it("nunca envía el campo age", () => {
    const payload = payloadFromAnswers(makeAnswers())

    expect(payload).not.toHaveProperty("age")
    expect(payload.date_of_birth).toBe("1998-04-03")
  })
})

describe("answersFromProfile", () => {
  // SDD: REQ-010 AC-010.1
  it("convierte un perfil en ft y lb a las respuestas del formulario", () => {
    const answers = answersFromProfile(
      makeProfileResponse(
        { date_of_birth: "1998-04-03" },
        {
          gender: "female",
          height_unit: "ft",
          height_cm: null,
          height_ft: 5,
          height_in: 9,
          weight_unit: "lb",
          weight: 160,
          activity_level: "high",
          goal: "lose_slow",
        }
      )
    )

    expect(answers).toMatchObject({
      gender: "female",
      dateOfBirth: "1998-04-03",
      heightUnit: "ft",
      heightFt: "5",
      heightIn: "9",
      weightUnit: "lb",
      weight: "160",
      activityLevel: "high",
      goal: "lose_slow",
    })
  })

  // SDD: REQ-010 AC-010.1
  it("convierte un perfil en cm y kg a las respuestas del formulario", () => {
    const answers = answersFromProfile(
      makeProfileResponse({}, { height_cm: 175.5, weight: 72.5 })
    )

    expect(answers).toMatchObject({
      heightUnit: "cm",
      heightCm: "175.5",
      weightUnit: "kg",
      weight: "72.5",
    })
  })

  // SDD: REQ-009 AC-009.1
  it("sin perfil devuelve las respuestas vacías con la fecha de la cuenta", () => {
    const answers = answersFromProfile(makePendingResponse("1995-05-20"))

    expect(answers).toEqual({ ...EMPTY_ANSWERS, dateOfBirth: "1995-05-20" })
  })

  // SDD: REQ-009 AC-009.2
  it("sin perfil y sin fecha de la cuenta, la fecha queda vacía", () => {
    const answers = answersFromProfile(makePendingResponse(null))

    expect(answers).toMatchObject({ dateOfBirth: "" })
  })
})
