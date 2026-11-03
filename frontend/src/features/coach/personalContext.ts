import type { BodyMetric } from "@/features/body-metrics/types"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import type { CoachPersonalContext } from "@/features/coach/types"

export function buildCoachPersonalContext(
  _metrics: BodyMetric[],
  _profile: OnboardingAnswers,
  _today: string
): CoachPersonalContext {
  throw new Error("not implemented")
}
