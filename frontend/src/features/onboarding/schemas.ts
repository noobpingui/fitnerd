import { z } from "zod"
import { LIMITS } from "@/features/onboarding/constants"
import type {
  HeightUnit,
  OnboardingAnswers,
  WeightUnit,
} from "@/features/onboarding/types"
import { ageFromIsoDate } from "@/lib/age"
import { parseLocalDate } from "@/lib/dates"

// Enums compartidos (los reutiliza profile/schemas.ts).
export const genderSchema = z.enum(["male", "female"])
export const heightUnitSchema = z.enum(["cm", "ft"])
export const weightUnitSchema = z.enum(["kg", "lb"])
export const activityLevelSchema = z.enum([
  "low",
  "moderate",
  "high",
  "very_high",
  "athlete",
])
export const goalSchema = z.enum([
  "lose",
  "lose_slow",
  "maintain",
  "gain_slow",
  "gain",
])

// Mensajes visibles.
export const DOB_REQUIRED_MESSAGE = "Indica tu fecha de nacimiento"
export const DOB_FUTURE_MESSAGE = "La fecha de nacimiento no puede ser futura"
export const DOB_AGE_RANGE_MESSAGE = "Debes tener entre 14 y 100 años"
export const CHOOSE_OPTION_MESSAGE = "Elige una opción"

// "height" es una clave virtual que agrupa cm, ft e in.
export type PhysicalDataErrorKey =
  | "gender"
  | "dateOfBirth"
  | "height"
  | "weight"
  | "activityLevel"
  | "goal"

export function heightRangeMessage(unit: HeightUnit): string {
  return unit === "cm"
    ? `Entre ${LIMITS.heightCm.min} y ${LIMITS.heightCm.max} cm`
    : `Entre ${LIMITS.heightFt.min} y ${LIMITS.heightFt.max} ft`
}

export function weightRangeMessage(unit: WeightUnit): string {
  const { min, max } = unit === "kg" ? LIMITS.kg : LIMITS.lb
  return `Entre ${min} y ${max} ${unit}`
}

// Un texto vacío no es válido: todas las preguntas son obligatorias.
export function inRange(
  value: string,
  { min, max }: { min: number; max: number },
  integer = false
): boolean {
  if (value.trim() === "") return false
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return false
  return !integer || Number.isInteger(n)
}

export function isHeightValid(
  a: Pick<OnboardingAnswers, "heightUnit" | "heightCm" | "heightFt" | "heightIn">
): boolean {
  if (a.heightUnit === "cm") return inRange(a.heightCm, LIMITS.heightCm)
  // Las pulgadas pueden quedar vacías (5 ft = 5 ft 0 in); pies y pulgadas
  // son enteros.
  const inches = a.heightIn.trim() === "" ? "0" : a.heightIn
  return (
    inRange(a.heightFt, LIMITS.heightFt, true) &&
    inRange(inches, LIMITS.heightIn, true)
  )
}

export function isWeightValid(
  a: Pick<OnboardingAnswers, "weightUnit" | "weight">
): boolean {
  return inRange(a.weight, a.weightUnit === "kg" ? LIMITS.kg : LIMITS.lb)
}

// null = válida; si no, el mensaje (vacía o incompleta = DOB_REQUIRED_MESSAGE).
export function dateOfBirthMessage(
  value: string,
  today: Date = new Date()
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return DOB_REQUIRED_MESSAGE
  const [, month, day] = value.split("-").map(Number)
  const dob = parseLocalDate(value)
  if (dob.getMonth() !== month - 1 || dob.getDate() !== day) {
    return DOB_REQUIRED_MESSAGE
  }
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  if (dob > startOfToday) return DOB_FUTURE_MESSAGE
  const age = ageFromIsoDate(value, today)
  if (age < LIMITS.age.min || age > LIMITS.age.max) return DOB_AGE_RANGE_MESSAGE
  return null
}

export const physicalDataShape = {
  gender: genderSchema.nullable(),
  dateOfBirth: z.string(),
  heightUnit: heightUnitSchema,
  heightCm: z.string(),
  heightFt: z.string(),
  heightIn: z.string(),
  weightUnit: weightUnitSchema,
  weight: z.string(),
  activityLevel: activityLevelSchema.nullable(),
  goal: goalSchema.nullable(),
}

export function addPhysicalDataIssues(
  values: OnboardingAnswers,
  ctx: z.RefinementCtx,
  today: Date
): void {
  for (const key of ["gender", "activityLevel", "goal"] as const) {
    if (values[key] === null) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: CHOOSE_OPTION_MESSAGE,
      })
    }
  }
  const dobMessage = dateOfBirthMessage(values.dateOfBirth, today)
  if (dobMessage !== null) {
    ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: dobMessage })
  }
  if (!isHeightValid(values)) {
    ctx.addIssue({
      code: "custom",
      path: ["height"],
      message: heightRangeMessage(values.heightUnit),
    })
  }
  if (!isWeightValid(values)) {
    ctx.addIssue({
      code: "custom",
      path: ["weight"],
      message: weightRangeMessage(values.weightUnit),
    })
  }
}

export function makePhysicalDataSchema(
  today?: Date
): z.ZodType<OnboardingAnswers, OnboardingAnswers> {
  return z
    .object(physicalDataShape)
    .superRefine((values, ctx) =>
      addPhysicalDataIssues(values, ctx, today ?? new Date())
    )
}

// Primer mensaje de cada clave de un safeParse síncrono; {} si es válido.
export function fieldMessages<K extends string>(
  schema: z.ZodType,
  values: unknown
): Partial<Record<K, string>> {
  const result = schema.safeParse(values)
  const messages: Partial<Record<K, string>> = {}
  if (result.success) return messages
  for (const issue of result.error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in messages)) {
      messages[key as K] = issue.message
    }
  }
  return messages
}
