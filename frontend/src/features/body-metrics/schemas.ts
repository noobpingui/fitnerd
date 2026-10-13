import { z } from "zod"
import { LIMITS } from "@/features/onboarding/constants"
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

function inRange(text: string, { min, max }: { min: number; max: number }) {
  const n = Number(text)
  return Number.isFinite(n) && n >= min && n <= max
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
