import type {
  ActivityLevel,
  Goal,
  OnboardingAnswers,
} from "@/features/onboarding/types"
import { ageFromIsoDate } from "@/lib/age"
import { CM_PER_IN, KG_PER_LB } from "@/features/onboarding/units"

// Spec 007: el cálculo vive en el frontend como función pura.

export const KJ_PER_KCAL = 4.184

// Factores de actividad estándar para Mifflin-St Jeor.
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  low: 1.2,
  moderate: 1.375,
  high: 1.55,
  very_high: 1.725,
  athlete: 1.9,
}

const GOAL_FACTOR: Record<Goal, number> = {
  lose: 0.8,
  lose_slow: 0.9,
  maintain: 1,
  gain_slow: 1.1,
  gain: 1.2,
}

export type MacroKey = "carbs" | "protein" | "fat"

// Suelo calórico del objetivo diario (spec 007, REQ-004): se aplica siempre
// y no modifica el mantenimiento.
const MIN_TARGET_KCAL = { male: 1500, female: 1200 }

// Reparto del objetivo calórico (spec 007): la proteína depende del peso de
// referencia, las grasas son un % fijo del total y los carbohidratos se
// quedan con lo que sobra.
const PROTEIN_G_PER_KG = 2
// Tope de proteína: el peso de referencia no supera el de IMC 27 (REQ-006).
const PROTEIN_CAP_BMI = 27
const FAT_SHARE = 0.25
// Si los carbohidratos no llegan al mínimo, las grasas ceden hasta este
// porcentaje y después las proteínas (REQ-007).
const MIN_FAT_SHARE = 0.2
const MIN_CARBS_G = 100

const KCAL_PER_GRAM: Record<MacroKey, number> = {
  carbs: 4,
  protein: 4,
  fat: 9,
}

export type MacroResult = {
  key: MacroKey
  grams: number
  kcal: number
  share: number
  exactKcal: number
}

export type MacrosSummary = {
  maintenanceKcal: number
  targetKcal: number
  exactTargetKcal: number
  macros: MacroResult[]
}

export function calculateMacros(
  a: OnboardingAnswers,
  today: Date = new Date()
): MacrosSummary {
  const kg =
    a.weightUnit === "kg" ? Number(a.weight) : Number(a.weight) * KG_PER_LB
  const cm =
    a.heightUnit === "cm"
      ? Number(a.heightCm)
      : (Number(a.heightFt) * 12 + Number(a.heightIn || 0)) * CM_PER_IN
  const age = ageFromIsoDate(a.dateOfBirth, today)

  // Mifflin-St Jeor: tasa metabólica basal (TMB) en kcal/día.
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (a.gender === "male" ? 5 : -161)
  const maintenanceKcal = bmr * ACTIVITY_FACTOR[a.activityLevel ?? "low"]
  const goalKcal = maintenanceKcal * GOAL_FACTOR[a.goal ?? "maintain"]
  const targetKcal = Math.max(
    goalKcal,
    MIN_TARGET_KCAL[a.gender === "male" ? "male" : "female"]
  )

  // Peso de referencia para la proteína: nunca supera el de IMC 27.
  const refKg = Math.min(kg, PROTEIN_CAP_BMI * (cm / 100) ** 2)
  const proteinStd = refKg * PROTEIN_G_PER_KG * KCAL_PER_GRAM.protein
  const fatStd = targetKcal * FAT_SHARE
  const carbsStd = targetKcal - proteinStd - fatStd
  const minCarbsKcal = MIN_CARBS_G * KCAL_PER_GRAM.carbs

  let carbsKcal = carbsStd
  let proteinKcal = proteinStd
  let fatKcal = fatStd
  if (carbsStd < minCarbsKcal) {
    carbsKcal = minCarbsKcal
    const deficit = minCarbsKcal - carbsStd
    fatKcal = Math.max(fatStd - deficit, targetKcal * MIN_FAT_SHARE)
    // Las proteínas cubren lo que falte, así que las kcal suman el objetivo.
    proteinKcal = targetKcal - carbsKcal - fatKcal
  }

  const kcalByMacro: Record<MacroKey, number> = {
    carbs: carbsKcal,
    protein: proteinKcal,
    fat: fatKcal,
  }

  const macros = (Object.keys(kcalByMacro) as MacroKey[]).map((key) => ({
    key,
    kcal: Math.round(kcalByMacro[key]),
    grams: Math.round(kcalByMacro[key] / KCAL_PER_GRAM[key]),
    share: kcalByMacro[key] / targetKcal,
    exactKcal: kcalByMacro[key],
  }))

  return {
    maintenanceKcal: Math.round(maintenanceKcal),
    targetKcal: Math.round(targetKcal),
    exactTargetKcal: targetKcal,
    macros,
  }
}
