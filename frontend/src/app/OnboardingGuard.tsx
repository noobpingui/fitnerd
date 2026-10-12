import { Navigate, Outlet } from "react-router"
import { isOnboardingCompleted } from "@/features/onboarding/storage"

// Segundo "portero" después de ProtectedRoute: ProtectedRoute decide si hay
// sesión; este decide si el usuario ya completó el onboarding. Envuelve
// TODAS las pantallas de la app (no solo /home) para que nadie pueda
// saltárselo escribiendo otra ruta en la barra de direcciones.
export function OnboardingGuard() {
  if (!isOnboardingCompleted()) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
