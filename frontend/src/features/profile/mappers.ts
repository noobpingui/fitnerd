import { EMPTY_ANSWERS } from "@/features/onboarding/constants"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import type { ProfileResponse, SaveProfilePayload } from "@/features/profile/types"

const text = (value: number | null) => (value === null ? "" : String(value))

// Respuesta del servidor -> estado de los formularios (números como texto).
// Sin perfil, devuelve las respuestas vacías con la fecha de la cuenta.
export function answersFromProfile(resp: ProfileResponse): OnboardingAnswers {
  const dateOfBirth = resp.date_of_birth ?? ""
  const p = resp.profile
  if (!p) return { ...EMPTY_ANSWERS, dateOfBirth }
  return {
    gender: p.gender,
    dateOfBirth,
    heightUnit: p.height_unit,
    heightCm: text(p.height_cm),
    heightFt: text(p.height_ft),
    heightIn: text(p.height_in),
    weightUnit: p.weight_unit,
    weight: String(p.weight),
    activityLevel: p.activity_level,
    goal: p.goal,
  }
}

// Estado de los formularios -> cuerpo del PUT. Solo lleva los campos de la
// unidad elegida y nunca la edad (se calcula desde la fecha de nacimiento).
export function payloadFromAnswers(a: OnboardingAnswers): SaveProfilePayload {
  const isCm = a.heightUnit === "cm"
  return {
    date_of_birth: a.dateOfBirth,
    gender: a.gender!,
    height_unit: a.heightUnit,
    height_cm: isCm ? Number(a.heightCm) : null,
    height_ft: isCm ? null : Number(a.heightFt),
    height_in: isCm ? null : a.heightIn.trim() === "" ? 0 : Number(a.heightIn),
    weight_unit: a.weightUnit,
    weight: Number(a.weight),
    activity_level: a.activityLevel!,
    goal: a.goal!,
  }
}
