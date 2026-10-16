import { z } from "zod"
import { LIMITS } from "@/features/onboarding/constants"
import type { PhysicalDataErrorKey } from "@/features/onboarding/schemas"
import type { PhysicalDataFormValues } from "@/features/profile/types"

export type ProfileFormErrorKey = PhysicalDataErrorKey | "fat" | "muscle"

export function makeProfileFormSchema(
  _today?: Date
): z.ZodType<PhysicalDataFormValues, PhysicalDataFormValues> {
  throw new Error("not implemented")
}

const gender = z.enum(["male", "female"])
const heightUnit = z.enum(["cm", "ft"])
const weightUnit = z.enum(["kg", "lb"])
const activityLevel = z.enum(["low", "moderate", "high", "very_high", "athlete"])
const goal = z.enum(["lose", "lose_slow", "maintain", "gain_slow", "gain"])

const serverProfileSchema = z.object({
  gender,
  height_unit: heightUnit,
  height_cm: z.number().nullable(),
  height_ft: z.number().nullable(),
  height_in: z.number().nullable(),
  weight_unit: weightUnit,
  weight: z.number(),
  activity_level: activityLevel,
  goal,
})

export const profileResponseSchema = z.object({
  onboarding_completed: z.boolean(),
  onboarding_completed_at: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  profile: serverProfileSchema.nullable(),
})

// .strict(): rechaza claves extra para garantizar que nunca sale `age`.
export const saveProfilePayloadSchema = z
  .object({
    date_of_birth: z.iso.date(),
    gender,
    height_unit: heightUnit,
    height_cm: z
      .number()
      .min(LIMITS.heightCm.min)
      .max(LIMITS.heightCm.max)
      .nullable(),
    height_ft: z
      .number()
      .int()
      .min(LIMITS.heightFt.min)
      .max(LIMITS.heightFt.max)
      .nullable(),
    height_in: z
      .number()
      .int()
      .min(LIMITS.heightIn.min)
      .max(LIMITS.heightIn.max)
      .nullable(),
    weight_unit: weightUnit,
    weight: z.number(),
    activity_level: activityLevel,
    goal,
  })
  .strict()
  .refine(
    (p) => {
      const { min, max } = p.weight_unit === "kg" ? LIMITS.kg : LIMITS.lb
      return p.weight >= min && p.weight <= max
    },
    { path: ["weight"], message: "Peso fuera de rango" }
  )
