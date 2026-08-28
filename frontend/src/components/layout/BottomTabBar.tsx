import { NavLink } from "react-router"
import { Dumbbell, Heart, Home, LineChart, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

// Mismos 5 destinos que la Navbar de escritorio (mas Home, que ahi vive
// en el logo) - mismos iconos que ya usa HomePage para sus shortcuts,
// para que la iconografia sea consistente en toda la app.
const tabs = [
  { to: "/home", label: "Inicio", icon: Home },
  { to: "/categories", label: "Categorías", icon: Dumbbell },
  { to: "/favorites", label: "Favoritos", icon: Heart },
  { to: "/body-metrics", label: "Métricas", icon: LineChart },
  { to: "/coach", label: "Coach", icon: Sparkles },
]

// Barra de navegacion fija abajo, solo visible en mobile (md:hidden) -
// el equivalente movil de los links de texto de la Navbar de escritorio,
// que en una pantalla angosta no entran en una sola fila. Alcanzable con
// el pulgar sin estirar la mano - el mismo patron "app nativa" que
// motivo esta pantalla (visto en chozi.com).
export function BottomTabBar() {
  return (
    <nav
      // pb-[env(safe-area-inset-bottom)]: en iPhones con "home indicator"
      // (sin boton fisico), el sistema operativo reserva una franja
      // abajo para el gesto de volver al inicio - sin este padding, esa
      // franja se superpone a la barra y tapa los ultimos pixeles.
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground transition-colors",
              isActive && "text-primary"
            )
          }
        >
          <tab.icon className="h-5 w-5" />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
