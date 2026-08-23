import { Navigate, Outlet } from "react-router"
import { getToken } from "@/lib/authToken"

// <Outlet /> es donde React Router renderiza la ruta hija que matcheo -
// este componente no dibuja pantallas propias, solo decide si te deja
// pasar a la que pediste o te manda a /login.
//
// Nota: esto solo chequea que EXISTA un token guardado, no que siga siendo
// valido (podria estar expirado). Si el usuario entra con un token vencido,
// va a ver la pantalla protegida un instante y despues el primer request
// real va a fallar con 401 - eso lo resolvemos cuando construyamos el manejo
// global de 401 (redirigir a login automaticamente ante cualquier 401).
export function ProtectedRoute() {
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
