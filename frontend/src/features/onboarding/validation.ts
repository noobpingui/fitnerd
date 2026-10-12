import { LIMITS } from "@/features/onboarding/constants"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import { ageFromIsoDate } from "@/lib/age"
import { parseLocalDate } from "@/lib/dates"

// Devuelve true solo si el texto es un número dentro de [min, max]. Un
// input vacío ("") no es válido: todas las preguntas son obligatorias.
function inRange(value: string, { min, max }: { min: number; max: number }) {
  if (value.trim() === "") return false
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max
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

// null = válida. Un texto vacío ("") significa "incompleta": no es válida,
// pero no hay mensaje que mostrar (la UI solo pinta errores con texto).
export function dateOfBirthError(
  a: OnboardingAnswers,
  today: Date = new Date()
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dateOfBirth)) return ""
  const [, month, day] = a.dateOfBirth.split("-").map(Number)
  const dob = parseLocalDate(a.dateOfBirth)
  if (dob.getMonth() !== month - 1 || dob.getDate() !== day) return ""
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  if (dob > startOfToday) return "La fecha de nacimiento no puede ser futura"
  const age = ageFromIsoDate(a.dateOfBirth, today)
  if (age < LIMITS.age.min || age > LIMITS.age.max) {
    return "Debes tener entre 14 y 100 años"
  }
  return null
}

export function isDateOfBirthValid(
  a: OnboardingAnswers,
  today: Date = new Date()
): boolean {
  return dateOfBirthError(a, today) === null
}
