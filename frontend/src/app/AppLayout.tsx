import { Outlet } from "react-router"
import { Navbar } from "@/components/layout/Navbar"
import { BottomTabBar } from "@/components/layout/BottomTabBar"
import { FeedbackButton } from "@/features/feedback/components/FeedbackButton"

// Separado de ProtectedRoute a proposito: ProtectedRoute decide SI podes
// pasar (logica de auth), AppLayout decide COMO se ve una vez que pasaste
// (el chrome visual: navbar + el resto de la pantalla). Cada uno con una
// sola responsabilidad.
export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* pb-16 en mobile: le da al contenido el mismo alto que ocupa
          BottomTabBar (fixed, asi que no empuja el layout por si sola) -
          sin esto, el final de cada pagina quedaria tapado por la barra.
          En desktop (md:pb-0) no hace falta, ahi la barra ni se renderiza. */}
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
      <BottomTabBar />
      <FeedbackButton />
    </div>
  )
}
