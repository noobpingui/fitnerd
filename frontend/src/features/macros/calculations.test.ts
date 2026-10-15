import { describe, expect, it } from "vitest"
import { calculateMacros } from "@/features/macros/calculations"
import type { MacroKey, MacrosSummary } from "@/features/macros/calculations"
import { makeAnswers } from "@/test/profileFixtures"

// Hombre, 72,5 kg, 175 cm, actividad moderada (x1,375), mantener.
// Mifflin-St Jeor: 10*72,5 + 6,25*175 - 5*edad + 5
//   27 años -> 1688,75 * 1,375 = 2322
//   28 años -> 1683,75 * 1,375 = 2315
const answers = makeAnswers({ dateOfBirth: "1998-10-12" })

describe("calculateMacros - edad desde la fecha de nacimiento", () => {
  // SDD: REQ-012 AC-012.4
  it("el 11 de octubre de 2026 calcula con 27 años", () => {
    const summary = calculateMacros(answers, new Date(2026, 9, 11))

    expect(summary.maintenanceKcal).toBe(2322)
    expect(summary.targetKcal).toBe(2322)
  })

  // SDD: REQ-012 AC-012.4
  it("el 12 de octubre de 2026 (cumpleaños) calcula con 28 años", () => {
    const summary = calculateMacros(answers, new Date(2026, 9, 12))

    expect(summary.maintenanceKcal).toBe(2315)
    expect(summary.targetKcal).toBe(2315)
  })
})

// ---------------------------------------------------------------------------
// Spec 007: cálculo de calorías y macros con límites.
// ---------------------------------------------------------------------------
const TODAY = new Date(2026, 9, 12)

type Spec = {
  gender: "male" | "female"
  age: number
  cm: number
  kg: number
  activity: string
  goal: string
}

// Construye las respuestas del onboarding para una edad en años cumplidos a
// la fecha fija TODAY (nacer el 1 de enero garantiza la edad exacta).
function profileFor(p: Spec) {
  return makeAnswers({
    gender: p.gender,
    heightUnit: "cm",
    heightCm: String(p.cm),
    weightUnit: "kg",
    weight: String(p.kg),
    activityLevel: p.activity,
    goal: p.goal,
    dateOfBirth: `${2026 - p.age}-01-01`,
  })
}

function calc(p: Spec): MacrosSummary {
  return calculateMacros(profileFor(p), TODAY)
}

function byKey(summary: MacrosSummary, key: MacroKey) {
  const macro = summary.macros.find((m) => m.key === key)
  if (!macro) throw new Error(`falta el macro ${key}`)
  return macro
}

const H30: Spec = { gender: "male", age: 30, cm: 180, kg: 80, activity: "low", goal: "lose" }
const M40: Spec = { gender: "female", age: 40, cm: 160, kg: 60, activity: "low", goal: "maintain" }

describe("calculateMacros - conversión de unidades y edad (spec 007)", () => {
  // SDD: REQ-001 AC-001.1
  it("convierte ft/in y lb sin redondear antes de calcular", () => {
    const converted = makeAnswers({
      gender: "male",
      heightUnit: "ft",
      heightFt: "5",
      heightIn: "11",
      weightUnit: "lb",
      weight: "176.4",
      activityLevel: "low",
      goal: "lose",
      dateOfBirth: "1996-01-01",
    })

    const summary = calculateMacros(converted, TODAY)

    expect(summary.maintenanceKcal).toBe(2139)
    expect(summary.targetKcal).toBe(1711)
  })

  // SDD: REQ-001 AC-001.2
  it("el día antes del cumpleaños usa 29 años", () => {
    const birthday = makeAnswers({
      ...profileFor(H30),
      dateOfBirth: "1996-10-12",
    })

    const summary = calculateMacros(birthday, new Date(2026, 9, 11))

    expect(summary.maintenanceKcal).toBe(2142)
    expect(summary.targetKcal).toBe(1714)
  })

  // SDD: REQ-001 AC-001.3
  it("el día del cumpleaños usa 30 años", () => {
    const birthday = makeAnswers({
      ...profileFor(H30),
      dateOfBirth: "1996-10-12",
    })

    const summary = calculateMacros(birthday, new Date(2026, 9, 12))

    expect(summary.maintenanceKcal).toBe(2136)
    expect(summary.targetKcal).toBe(1709)
  })
})

describe("calculateMacros - mantenimiento y objetivo (spec 007)", () => {
  // SDD: REQ-002 AC-002.1
  it.each([
    ["low", 2136],
    ["high", 2759],
    ["athlete", 3382],
  ])("hombre con actividad %s tiene mantenimiento %i", (activity, expected) => {
    const summary = calc({ ...H30, activity, goal: "maintain" })

    expect(summary.maintenanceKcal).toBe(expected)
  })

  // SDD: REQ-002 AC-002.2
  it.each([
    ["low", 1487],
    ["moderate", 1704],
    ["very_high", 2137],
  ])("mujer con actividad %s tiene mantenimiento %i", (activity, expected) => {
    const summary = calc({ ...M40, activity })

    expect(summary.maintenanceKcal).toBe(expected)
  })

  // SDD: REQ-003 AC-003.1
  it.each([
    ["lose", 1709],
    ["lose_slow", 1922],
    ["maintain", 2136],
    ["gain_slow", 2350],
    ["gain", 2563],
  ])("con la meta %s el objetivo es %i", (goal, expected) => {
    const summary = calc({ ...H30, goal })

    expect(summary.maintenanceKcal).toBe(2136)
    expect(summary.targetKcal).toBe(expected)
  })
})

describe("calculateMacros - suelo calórico (spec 007)", () => {
  // SDD: REQ-004 AC-004.1
  it("mujer: eleva el objetivo a 1200 kcal y reparte sobre ese valor", () => {
    const summary = calc({ gender: "female", age: 50, cm: 160, kg: 60, activity: "low", goal: "lose" })

    expect(summary.maintenanceKcal).toBe(1427)
    expect(summary.targetKcal).toBe(1200)
    expect(byKey(summary, "protein")).toMatchObject({ grams: 120, kcal: 480 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 33, kcal: 300 })
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 105, kcal: 420 })
  })

  // SDD: REQ-004 AC-004.2
  it("hombre: eleva el objetivo a 1500 kcal y reparte sobre ese valor", () => {
    const summary = calc({ gender: "male", age: 60, cm: 166, kg: 60, activity: "low", goal: "lose" })

    expect(summary.maintenanceKcal).toBe(1611)
    expect(summary.targetKcal).toBe(1500)
    expect(byKey(summary, "protein")).toMatchObject({ grams: 120, kcal: 480 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 42, kcal: 375 })
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 161, kcal: 645 })
  })

  // SDD: REQ-004 AC-004.3
  it("el suelo supera al mantenimiento y el mantenimiento se muestra sin suelo", () => {
    const summary = calc({ gender: "female", age: 100, cm: 150, kg: 45, activity: "low", goal: "maintain" })

    expect(summary.maintenanceKcal).toBe(872)
    expect(summary.targetKcal).toBe(1200)
    expect(byKey(summary, "protein")).toMatchObject({ grams: 90, kcal: 360 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 33, kcal: 300 })
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 135, kcal: 540 })
  })

  // SDD: REQ-004 AC-004.5
  it.each(["lose", "lose_slow", "maintain", "gain_slow", "gain"])(
    "con la meta %s el suelo se aplica y el mantenimiento sigue en 872",
    (goal) => {
      const summary = calc({ gender: "female", age: 100, cm: 150, kg: 45, activity: "low", goal })

      expect(summary.targetKcal).toBe(1200)
      expect(summary.maintenanceKcal).toBe(872)
    }
  )

  // SDD: REQ-004 AC-004.4
  it("por encima del suelo el objetivo no se modifica", () => {
    const summary = calc({ ...M40, activity: "moderate", goal: "lose" })

    expect(summary.targetKcal).toBe(1363)
  })
})

describe("calculateMacros - reparto estándar y tope de proteína (spec 007)", () => {
  // SDD: REQ-005 AC-005.1
  it("reparte 2 g/kg de proteína, 25 % de grasas y el resto de carbohidratos", () => {
    const summary = calc(H30)

    expect(summary.targetKcal).toBe(1709)
    expect(byKey(summary, "protein")).toMatchObject({ grams: 160, kcal: 640 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 47, kcal: 427 })
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 160, kcal: 642 })
  })

  const heavy: Spec = { gender: "male", age: 30, cm: 180, kg: 120, activity: "high", goal: "maintain" }

  // SDD: REQ-006 AC-006.1
  it("con 120 kg la proteína se calcula con el peso de IMC 27", () => {
    const summary = calc(heavy)

    expect(summary.targetKcal).toBe(3379)
    expect(byKey(summary, "protein")).toMatchObject({ grams: 175, kcal: 700 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 94, kcal: 845 })
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 459, kcal: 1834 })
  })

  // SDD: REQ-006 AC-006.2
  it("el tope de proteína es el mismo si el peso se da en libras", () => {
    const pounds = makeAnswers({
      ...profileFor(heavy),
      weightUnit: "lb",
      weight: "264.6",
    })

    const summary = calculateMacros(pounds, TODAY)

    expect(byKey(summary, "protein").grams).toBe(175)
  })

  // SDD: REQ-006 AC-006.3
  it("con 90 kg se usa el peso de IMC 27 y con 85 kg el peso real", () => {
    const base: Spec = { ...H30, goal: "maintain" }

    expect(byKey(calc({ ...base, kg: 90 }), "protein").grams).toBe(175)
    expect(byKey(calc({ ...base, kg: 85 }), "protein").grams).toBe(170)
  })
})

describe("calculateMacros - mínimo de carbohidratos (spec 007)", () => {
  // SDD: REQ-007 AC-007.1
  it("cubre los 100 g de carbohidratos reduciendo solo las grasas", () => {
    const summary = calc({ gender: "female", age: 60, cm: 170, kg: 75, activity: "low", goal: "lose" })

    expect(summary.targetKcal).toBe(1297)
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 100, kcal: 400 })
    expect(byKey(summary, "protein")).toMatchObject({ grams: 150, kcal: 600 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 33, kcal: 297 })
  })

  // SDD: REQ-007 AC-007.2
  it("si las grasas llegan al 20 % las proteínas ceden el resto", () => {
    const summary = calc({ gender: "female", age: 80, cm: 175, kg: 80, activity: "low", goal: "lose" })

    expect(summary.targetKcal).toBe(1279)
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 100, kcal: 400 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 28, kcal: 256 })
    expect(byKey(summary, "protein")).toMatchObject({ grams: 156, kcal: 624 })
  })

  // SDD: REQ-007 AC-007.3
  it("con 100 g o más de carbohidratos aplica el reparto estándar", () => {
    const summary = calc({ gender: "female", age: 50, cm: 175, kg: 80, activity: "low", goal: "lose" })

    expect(byKey(summary, "protein")).toMatchObject({ grams: 160, kcal: 640 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 40, kcal: 356 })
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 107, kcal: 428 })
  })

  // SDD: REQ-007 AC-007.4
  it("combina el suelo calórico con el mínimo de carbohidratos", () => {
    const summary = calc({ gender: "female", age: 80, cm: 165, kg: 75, activity: "low", goal: "lose" })

    expect(summary.targetKcal).toBe(1200)
    expect(byKey(summary, "carbs")).toMatchObject({ grams: 100, kcal: 400 })
    expect(byKey(summary, "fat")).toMatchObject({ grams: 27, kcal: 240 })
    expect(byKey(summary, "protein")).toMatchObject({ grams: 140, kcal: 560 })
  })
})

describe("calculateMacros - coherencia del reparto (spec 007)", () => {
  // SDD: REQ-008 AC-008.1
  it("cumple los invariantes en las 400 combinaciones límite", () => {
    const genders = ["male", "female"] as const
    const activities = ["low", "moderate", "high", "very_high", "athlete"]
    const goals = ["lose", "lose_slow", "maintain", "gain_slow", "gain"]

    for (const gender of genders)
      for (const age of [14, 100])
        for (const cm of [100, 250])
          for (const kg of [30, 300])
            for (const activity of activities)
              for (const goal of goals) {
                const p: Spec = { gender, age, cm, kg, activity, goal }
                const where = JSON.stringify(p)
                const summary = calc(p)

                expect(summary.targetKcal, where).toBeGreaterThanOrEqual(
                  gender === "male" ? 1500 : 1200
                )
                let sum = 0
                for (const macro of summary.macros) {
                  expect(macro.grams, where).toBeGreaterThanOrEqual(0)
                  expect(macro.kcal, where).toBeGreaterThanOrEqual(0)
                  expect(macro.exactKcal, where).toBeGreaterThanOrEqual(0)
                  sum += macro.exactKcal
                }
                expect(
                  Math.abs(sum - summary.exactTargetKcal) < 0.001,
                  where
                ).toBe(true)
              }
  })

  // SDD: REQ-008 AC-008.2
  it("la suma de porcentajes sin redondear es 1 en los perfiles de los AC", () => {
    const profiles: Spec[] = [
      H30,
      M40,
      { ...H30, kg: 120, activity: "high", goal: "maintain" },
      { gender: "female", age: 50, cm: 160, kg: 60, activity: "low", goal: "lose" },
      { gender: "male", age: 60, cm: 166, kg: 60, activity: "low", goal: "lose" },
      { gender: "female", age: 100, cm: 150, kg: 45, activity: "low", goal: "maintain" },
      { gender: "female", age: 60, cm: 170, kg: 75, activity: "low", goal: "lose" },
      { gender: "female", age: 80, cm: 175, kg: 80, activity: "low", goal: "lose" },
      { gender: "female", age: 50, cm: 175, kg: 80, activity: "low", goal: "lose" },
      { gender: "female", age: 80, cm: 165, kg: 75, activity: "low", goal: "lose" },
    ]

    for (const p of profiles) {
      const total = calc(p).macros.reduce((acc, m) => acc + m.share, 0)
      expect(Math.abs(total - 1), JSON.stringify(p)).toBeLessThan(1e-6)
    }
  })
})
