import type {
  ActivityLevel,
  Gender,
  Goal,
  HeightUnit,
  WeightUnit,
} from "@/features/onboarding/types"

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
