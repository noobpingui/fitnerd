import { z } from "zod"
import { LIMITS } from "@/features/onboarding/constants"
import { inRange } from "@/features/onboarding/schemas"
import type { WeightUnit } from "@/features/onboarding/types"
import { KG_PER_LB } from "@/features/onboarding/units"
import type {
  BodyMetric,
  UpdateBodyMetricPayload,
} from "@/features/body-metrics/types"

export const FAT_LIMITS = { min: 3, max: 60 }
export const MUSCLE_LIMITS = { min: 10, max: 70 }

// Rango de peso que acepta el servidor para una medición (kg).
const SERVER_WEIGHT_KG = { min: 29.9, max: 300 }

export type MetricCorrectionValues = {
  weight: string
  fat: string
  muscle: string
}

// originalWeightDisplay y originalWeightKg describen el peso con el que se
// abrió el formulario: si el texto no cambia, se acepta aunque quede fuera
// del rango del perfil (p. ej. 29,9 kg se muestra como 65,9 lb).
export function makeMetricCorrectionSchema(
  weightUnit: WeightUnit,
  originalWeightDisplay: string,
  originalWeightKg: number | null
) {
  const weightLimits = weightUnit === "kg" ? LIMITS.kg : LIMITS.lb

  return z
    .object({ weight: z.string(), fat: z.string(), muscle: z.string() })
    .superRefine((values, ctx) => {
      const weight = values.weight.trim()
      const fat = values.fat.trim()
      const muscle = values.muscle.trim()

      if (weight === "" && fat === "" && muscle === "") {
        ctx.addIssue({ code: "custom", message: "Registra al menos un valor" })
      }

      if (weight !== "") {
        const unchangedAndValid =
          weight === originalWeightDisplay.trim() &&
          originalWeightKg !== null &&
          originalWeightKg >= SERVER_WEIGHT_KG.min &&
          originalWeightKg <= SERVER_WEIGHT_KG.max
        if (!unchangedAndValid && !inRange(weight, weightLimits)) {
          ctx.addIssue({
            code: "custom",
            path: ["weight"],
            message: `Entre ${weightLimits.min} y ${weightLimits.max} ${weightUnit}`,
          })
        }
      }

      if (fat !== "" && !inRange(fat, FAT_LIMITS)) {
        ctx.addIssue({
          code: "custom",
          path: ["fat"],
          message: `Entre ${FAT_LIMITS.min} y ${FAT_LIMITS.max} %`,
        })
      }

      if (muscle !== "" && !inRange(muscle, MUSCLE_LIMITS)) {
        ctx.addIssue({
          code: "custom",
          path: ["muscle"],
          message: `Entre ${MUSCLE_LIMITS.min} y ${MUSCLE_LIMITS.max} %`,
        })
      }
    })
}

function orNull(text: string) {
  return text.trim() === "" ? null : Number(text)
}

// Texto del peso con el que se abre el formulario (en la unidad del perfil).
export function weightDisplayOf(
  weightKg: number | null,
  weightUnit: WeightUnit
) {
  if (weightKg === null) return ""
  return String(
    weightUnit === "lb"
      ? Math.round((weightKg / KG_PER_LB) * 10) / 10
      : weightKg
  )
}

// Si el usuario no tocó el peso se reenvía el original en kg (así un perfil
// en lb no reescribe el peso con el redondeo de la conversión).
export function correctionPayload(
  values: MetricCorrectionValues,
  weightUnit: WeightUnit,
  original: BodyMetric
): UpdateBodyMetricPayload {
  const weightText = values.weight.trim()

  let weight: number | null
  if (weightText === weightDisplayOf(original.weight, weightUnit)) {
    weight = original.weight
  } else if (weightText === "") {
    weight = null
  } else if (weightUnit === "lb") {
    weight = Math.round(Number(weightText) * KG_PER_LB * 10) / 10
  } else {
    weight = Number(weightText)
  }

  return {
    weight,
    body_fat_percentage: orNull(values.fat),
    muscle_mass_percentage: orNull(values.muscle),
  }
}

const nullableText = z.string().nullable()
const counter = z.number().int().min(0)

export const analysisRequestSchema = z.object({
  today: z.string(),
  indicators: z.object({
    weight: nullableText,
    weight_change_30d: nullableText,
    body_fat: nullableText,
    body_fat_change_30d: nullableText,
    rate: nullableText,
    pace_status: z.enum([
      "on_track",
      "too_slow",
      "too_fast",
      "off_range",
      "insufficient",
      "stale",
      "unrealistic",
    ]),
    fat_mass: nullableText,
    lean_mass: nullableText,
    bmi: nullableText,
    ffmi: nullableText,
    streak_weeks: counter,
    records_last_30_days: counter,
    total_records: counter,
    last_record_date: nullableText,
  }),
  rate_kg_per_week: z.number().finite().nullable(),
  latest_weight_kg: z.number().finite().nullable(),
  calories: z.object({
    maintenance_kcal: z.number().int().positive(),
    target_kcal: z.number().int().positive(),
  }),
})

export const analysisResponseSchema = z.object({
  analysis: z.string(),
  calorie_suggestion: z
    .object({
      kind: z.enum(["adjust", "floor_limited", "at_floor", "on_track"]),
      target_kcal: z.number(),
      suggested_kcal: z.number(),
      adjustment_kcal: z.number(),
      floor_kcal: z.number(),
    })
    .nullable(),
})
