import type {
  ActivityLevel,
  Goal,
  OnboardingAnswers,
} from "@/features/onboarding/types"
import { CM_PER_IN, KG_PER_LB } from "@/features/onboarding/units"

// TEMPORAL (fase de diseño): el cálculo vive en el frontend para poder ver
// la pantalla con datos reales del onboarding. En la fase funcional se
// decidirá si se queda aquí o lo devuelve el backend.

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

// Reparto del objetivo calórico: la proteína depende del peso corporal (no
// de las calorías), las grasas son un % fijo del total y los carbohidratos
// se quedan con lo que sobra.
// Pendiente para la fase SDD: tope de proteína para personas con mucho
// sobrepeso y un mínimo de carbohidratos en objetivos muy bajos.
const PROTEIN_G_PER_KG = 2
const FAT_SHARE = 0.25

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
}

export type MacrosSummary = {
  maintenanceKcal: number
  targetKcal: number
  macros: MacroResult[]
}

export function calculateMacros(a: OnboardingAnswers): MacrosSummary {
  const kg =
    a.weightUnit === "kg" ? Number(a.weight) : Number(a.weight) * KG_PER_LB
  const cm =
    a.heightUnit === "cm"
      ? Number(a.heightCm)
      : (Number(a.heightFt) * 12 + Number(a.heightIn || 0)) * CM_PER_IN
  const age = Number(a.age)

  // Mifflin-St Jeor: tasa metabólica basal (TMB) en kcal/día.
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (a.gender === "male" ? 5 : -161)
  const maintenanceKcal = bmr * ACTIVITY_FACTOR[a.activityLevel ?? "low"]
  const targetKcal = maintenanceKcal * GOAL_FACTOR[a.goal ?? "maintain"]

  const proteinKcal = kg * PROTEIN_G_PER_KG * KCAL_PER_GRAM.protein
  const fatKcal = targetKcal * FAT_SHARE
  // Math.max evita un valor negativo que rompería el gráfico; el mínimo
  // real de carbohidratos se definirá en la fase SDD.
  const carbsKcal = Math.max(targetKcal - proteinKcal - fatKcal, 0)

  const kcalByMacro: Record<MacroKey, number> = {
    carbs: carbsKcal,
    protein: proteinKcal,
    fat: fatKcal,
  }
  const totalKcal = carbsKcal + proteinKcal + fatKcal

  const macros = (Object.keys(kcalByMacro) as MacroKey[]).map((key) => ({
    key,
    kcal: Math.round(kcalByMacro[key]),
    grams: Math.round(kcalByMacro[key] / KCAL_PER_GRAM[key]),
    share: kcalByMacro[key] / totalKcal,
  }))

  return {
    maintenanceKcal: Math.round(maintenanceKcal),
    targetKcal: Math.round(targetKcal),
    macros,
  }
}
