import type {
  HeightUnit,
  OnboardingAnswers,
  WeightUnit,
} from "@/features/onboarding/types"
import { isHeightValid, isWeightValid } from "@/features/onboarding/validation"

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

// Devuelven el "parche" de respuestas al cambiar de unidad, convirtiendo el
// valor ya escrito para que el usuario no tenga que recalcularlo. Si el
// valor actual no es válido, solo se cambia la unidad. Las usan el
// onboarding y el perfil.

export function convertHeight(
  a: OnboardingAnswers,
  unit: HeightUnit
): Partial<OnboardingAnswers> {
  if (unit === a.heightUnit || !isHeightValid(a)) return { heightUnit: unit }

  if (unit === "ft") {
    const totalIn = Number(a.heightCm) / CM_PER_IN
    let ft = Math.floor(totalIn / 12)
    let inches = Math.round(totalIn - ft * 12)
    if (inches === 12) {
      ft += 1
      inches = 0
    }
    return { heightUnit: unit, heightFt: String(ft), heightIn: String(inches) }
  }

  const totalIn = Number(a.heightFt) * 12 + Number(a.heightIn || 0)
  return { heightUnit: unit, heightCm: String(Math.round(totalIn * CM_PER_IN)) }
}

export function heightCmFromAnswers(_answers: OnboardingAnswers): number | null {
  throw new Error("not implemented")
}

export function convertWeight(
  a: OnboardingAnswers,
  unit: WeightUnit
): Partial<OnboardingAnswers> {
  if (unit === a.weightUnit || !isWeightValid(a)) return { weightUnit: unit }

  const w = Number(a.weight)
  const converted = unit === "lb" ? w / KG_PER_LB : w * KG_PER_LB
  return { weightUnit: unit, weight: String(Math.round(converted * 10) / 10) }
}
