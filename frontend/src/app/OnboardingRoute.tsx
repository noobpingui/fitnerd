import { Navigate } from "react-router"
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage"
import {
  ProfileLoadError,
  ProfileLoading,
} from "@/features/profile/components/ProfileLoadState"
import { useProfile } from "@/features/profile/hooks"

// Quien ya completó el onboarding no tiene nada que hacer en /onboarding:
// se le manda directo a /home. Si está pendiente, la fecha de nacimiento de
// su cuenta (si la tiene) llega prerrellenada.
export function OnboardingRoute() {
  const { data, isPending, isError, refetch } = useProfile()

  if (isPending) return <ProfileLoading />
  if (isError) return <ProfileLoadError onRetry={() => refetch()} />
  if (data.onboarding_completed) return <Navigate to="/home" replace />

  return <OnboardingPage initialDateOfBirth={data.date_of_birth} />
}
