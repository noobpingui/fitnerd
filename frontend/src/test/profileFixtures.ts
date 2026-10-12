// Fábricas compartidas por los tests de la feature 006 (perfil en el
// servidor): respuestas de GET /api/profile y respuestas del onboarding.
import { EMPTY_ANSWERS } from "@/features/onboarding/constants"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import type { ProfileResponse, ServerProfile } from "@/features/profile/types"

export function makeServerProfile(
  overrides: Partial<ServerProfile> = {}
): ServerProfile {
  return {
    gender: "male",
    height_unit: "cm",
    height_cm: 175,
    height_ft: null,
    height_in: null,
    weight_unit: "kg",
    weight: 72.5,
    activity_level: "moderate",
    goal: "maintain",
    ...overrides,
  }
}

// Usuario con el onboarding completado.
export function makeProfileResponse(
  overrides: Partial<ProfileResponse> = {},
  profile: Partial<ServerProfile> = {}
): ProfileResponse {
  return {
    onboarding_completed: true,
    onboarding_completed_at: "2026-10-11T18:30:00+00:00",
    date_of_birth: "1998-04-03",
    profile: makeServerProfile(profile),
    ...overrides,
  }
}

// Usuario con el onboarding pendiente (sin perfil).
export function makePendingResponse(
  dateOfBirth: string | null = null
): ProfileResponse {
  return {
    onboarding_completed: false,
    onboarding_completed_at: null,
    date_of_birth: dateOfBirth,
    profile: null,
  }
}

// Respuestas del onboarding. El cast evita depender de si `age` ya se
// sustituyó por `dateOfBirth` en el tipo (la implementación lo hace).
export function makeAnswers(
  overrides: Record<string, string | null> = {}
): OnboardingAnswers {
  return {
    ...EMPTY_ANSWERS,
    gender: "male",
    heightUnit: "cm",
    heightCm: "175",
    weightUnit: "kg",
    weight: "72.5",
    activityLevel: "moderate",
    goal: "maintain",
    dateOfBirth: "1998-04-03",
    ...overrides,
  } as unknown as OnboardingAnswers
}
