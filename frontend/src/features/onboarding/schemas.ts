import { z } from "zod"
import type {
  HeightUnit,
  OnboardingAnswers,
  WeightUnit,
} from "@/features/onboarding/types"

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

// "height" es una clave virtual que agrupa cm, ft e in.
export type PhysicalDataErrorKey =
  | "gender"
  | "dateOfBirth"
  | "height"
  | "weight"
  | "activityLevel"
  | "goal"

export function heightRangeMessage(_unit: HeightUnit): string {
  throw new Error("not implemented")
}

export function weightRangeMessage(_unit: WeightUnit): string {
  throw new Error("not implemented")
}

export function isHeightValid(
  _a: Pick<
    OnboardingAnswers,
    "heightUnit" | "heightCm" | "heightFt" | "heightIn"
  >
): boolean {
  throw new Error("not implemented")
}

export function isWeightValid(
  _a: Pick<OnboardingAnswers, "weightUnit" | "weight">
): boolean {
  throw new Error("not implemented")
}

export function dateOfBirthMessage(
  _value: string,
  _today?: Date
): string | null {
  throw new Error("not implemented")
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
  _values: OnboardingAnswers,
  _ctx: z.RefinementCtx,
  _today: Date
): void {
  throw new Error("not implemented")
}

export function makePhysicalDataSchema(
  _today?: Date
): z.ZodType<OnboardingAnswers, OnboardingAnswers> {
  throw new Error("not implemented")
}

export function fieldMessages<K extends string>(
  _schema: z.ZodType,
  _values: unknown
): Partial<Record<K, string>> {
  throw new Error("not implemented")
}
