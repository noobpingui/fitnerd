import { Outlet, useLocation } from "react-router"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { BottomTabBar } from "@/components/layout/BottomTabBar"

// Separado de ProtectedRoute a proposito: ProtectedRoute decide SI podes
// pasar (logica de auth), AppLayout decide COMO se ve una vez que pasaste
// (el chrome visual: navbar + el resto de la pantalla). Cada uno con una
// sola responsabilidad.
export function AppLayout() {
  // AppLayout envuelve TODAS las pantallas protegidas (/home, /categories,
  // /favorites, /body-metrics, /coach) - el footer solo debe verse en
  // /home, asi que hay que chequear la ruta actual antes de mostrarlo.
  const location = useLocation()
  const showFooter = location.pathname === "/home"

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* pb-16 en mobile: le da al contenido el mismo alto que ocupa
          BottomTabBar (fixed, asi que no empuja el layout por si sola) -
          sin esto, el final de cada pagina quedaria tapado por la barra.
          En desktop (md:pb-0) no hace falta, ahi la barra ni se renderiza. */}
      <div className="pb-16 md:pb-0">
        <Outlet />
        {showFooter && <Footer />}
      </div>
      <BottomTabBar />
    </div>
  )
}
