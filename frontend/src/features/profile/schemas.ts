import { z } from "zod"
import { FAT_LIMITS, MUSCLE_LIMITS } from "@/features/body-metrics/schemas"
import { LIMITS } from "@/features/onboarding/constants"
import {
  activityLevelSchema,
  addPhysicalDataIssues,
  genderSchema,
  goalSchema,
  heightUnitSchema,
  physicalDataShape,
  weightUnitSchema,
  type PhysicalDataErrorKey,
} from "@/features/onboarding/schemas"
import type { PhysicalDataFormValues } from "@/features/profile/types"

export type ProfileFormErrorKey = PhysicalDataErrorKey | "fat" | "muscle"

// Opcional: vacío es válido; si hay algo escrito, debe estar en rango.
function optionalInRange(value: string, { min, max }: { min: number; max: number }) {
  if (value.trim() === "") return true
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max
}

export function makeProfileFormSchema(
  today?: Date
): z.ZodType<PhysicalDataFormValues, PhysicalDataFormValues> {
  return z
    .object({ ...physicalDataShape, fat: z.string(), muscle: z.string() })
    .superRefine((values, ctx) => {
      addPhysicalDataIssues(values, ctx, today ?? new Date())
      if (!optionalInRange(values.fat, FAT_LIMITS)) {
        ctx.addIssue({
          code: "custom",
          path: ["fat"],
          message: `Entre ${FAT_LIMITS.min} y ${FAT_LIMITS.max} %`,
        })
      }
      if (!optionalInRange(values.muscle, MUSCLE_LIMITS)) {
        ctx.addIssue({
          code: "custom",
          path: ["muscle"],
          message: `Entre ${MUSCLE_LIMITS.min} y ${MUSCLE_LIMITS.max} %`,
        })
      }
    })
}

const gender = genderSchema
const heightUnit = heightUnitSchema
const weightUnit = weightUnitSchema
const activityLevel = activityLevelSchema
const goal = goalSchema

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
