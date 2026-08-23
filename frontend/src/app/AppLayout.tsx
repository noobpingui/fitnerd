import { Outlet } from "react-router"
import { Navbar } from "@/components/layout/Navbar"

// Separado de ProtectedRoute a proposito: ProtectedRoute decide SI podes
// pasar (logica de auth), AppLayout decide COMO se ve una vez que pasaste
// (el chrome visual: navbar + el resto de la pantalla). Cada uno con una
// sola responsabilidad.
export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Outlet />
    </div>
  )
}
