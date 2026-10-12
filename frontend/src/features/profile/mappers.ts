import type { OnboardingAnswers } from "@/features/onboarding/types"
import type { ProfileResponse, SaveProfilePayload } from "@/features/profile/types"

export function answersFromProfile(_resp: ProfileResponse): OnboardingAnswers {
  throw new Error("not implemented")
}

export function payloadFromAnswers(_answers: OnboardingAnswers): SaveProfilePayload {
  throw new Error("not implemented")
}
