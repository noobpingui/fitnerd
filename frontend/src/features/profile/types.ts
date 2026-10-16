import type {
  ActivityLevel,
  Gender,
  Goal,
  HeightUnit,
  OnboardingAnswers,
  WeightUnit,
} from "@/features/onboarding/types"

// Composición corporal opcional (texto mientras se edita, "" = sin dato).
export type BodyComposition = { fat: string; muscle: string }
// Valores del formulario Datos físicos.
export type PhysicalDataFormValues = OnboardingAnswers & BodyComposition

export type ServerProfile = {
  gender: Gender
  height_unit: HeightUnit
  height_cm: number | null
  height_ft: number | null
  height_in: number | null
  weight_unit: WeightUnit
  weight: number
  activity_level: ActivityLevel
  goal: Goal
}

export type ProfileResponse = {
  onboarding_completed: boolean
  onboarding_completed_at: string | null
  date_of_birth: string | null
  profile: ServerProfile | null
}

export type SaveProfilePayload = { date_of_birth: string } & ServerProfile
