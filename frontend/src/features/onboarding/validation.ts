import { LIMITS } from "@/features/onboarding/constants"
import type { OnboardingAnswers } from "@/features/onboarding/types"

// Devuelve true solo si el texto es un número dentro de [min, max]. Un
// input vacío ("") no es válido: todas las preguntas son obligatorias.
function inRange(value: string, { min, max }: { min: number; max: number }) {
  if (value.trim() === "") return false
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max
}

export function isAgeValid(a: OnboardingAnswers) {
  return inRange(a.age, LIMITS.age) && Number.isInteger(Number(a.age))
}

export function isHeightValid(a: OnboardingAnswers) {
  if (a.heightUnit === "cm") return inRange(a.heightCm, LIMITS.heightCm)
  // Las pulgadas pueden quedar vacías (5 ft = 5 ft 0 in).
  const inches = a.heightIn.trim() === "" ? "0" : a.heightIn
  return inRange(a.heightFt, LIMITS.heightFt) && inRange(inches, LIMITS.heightIn)
}

export function isWeightValid(a: OnboardingAnswers) {
  return inRange(a.weight, a.weightUnit === "kg" ? LIMITS.kg : LIMITS.lb)
}
