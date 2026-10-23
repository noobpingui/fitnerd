import { Navigate, Outlet } from "react-router"
import { getToken } from "@/lib/authToken"

// <Outlet /> es donde React Router renderiza la ruta hija que coincide:
// este componente no dibuja pantallas propias, solo decide si deja pasar a la
// pantalla pedida o redirige a /login.
//
// Nota: esto solo comprueba que EXISTA un token guardado, no que siga siendo
// válido (podría estar expirado). Si el usuario entra con un token vencido,
// verá la pantalla protegida un instante y después el primer request
// real fallará con 401; eso se resolverá cuando se construya el manejo
// global de 401 (redirigir a login automáticamente ante cualquier 401).
export function ProtectedRoute() {
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
