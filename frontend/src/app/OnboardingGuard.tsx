import { Navigate, Outlet } from "react-router"
import {
  ProfileLoadError,
  ProfileLoading,
} from "@/features/profile/components/ProfileLoadState"
import { useProfile } from "@/features/profile/hooks"

// Segundo "portero" después de ProtectedRoute: ProtectedRoute decide si hay
// sesión; este decide si el usuario ya completó el onboarding según el
// servidor. Envuelve TODAS las pantallas de la app (no solo /home) para que
// nadie pueda saltárselo escribiendo otra ruta en la barra de direcciones.
// Si el perfil no carga, NO redirige: mandarlo al onboarding le haría
// repetirlo y sobrescribir su perfil por un fallo pasajero.
export function OnboardingGuard() {
  const { data, isPending, isError, refetch } = useProfile()

  if (isPending) return <ProfileLoading />
  if (isError) return <ProfileLoadError onRetry={() => refetch()} />
  if (!data.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
