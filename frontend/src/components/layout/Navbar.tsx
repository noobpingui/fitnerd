import { NavLink } from "react-router"
import { Logo } from "@/components/layout/Logo"
import { UserMenu } from "@/components/layout/UserMenu"
import { cn } from "@/lib/utils"

const links = [
  { to: "/categories", label: "Categorías" },
  { to: "/favorites", label: "Favoritos" },
  { to: "/body-metrics", label: "Métricas" },
  { to: "/coach", label: "Coach" },
]

export function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b bg-card px-6 py-5">
      {/* text-lg (1.125rem) x2 = 2.25rem, que coincide con la escala
          estandar de Tailwind (text-4xl), asi que ya no hace falta el
          valor arbitrario que usabamos para el x3. */}
      <div className="flex items-center gap-8">
        {/* Mismo efecto "vivo" que el avatar del UserMenu, pero sin el
            anillo de color - solo el crecer/achicarse animado. El anillo
            de foco (focus-visible) se mantiene: no es decorativo, es
            accesibilidad - le muestra a quien navega con teclado (Tab)
            donde esta parado, y solo aparece con teclado, nunca con mouse. */}
        <NavLink
          to="/home"
          className="inline-block rounded-md outline-none transition-transform duration-200 hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo className="text-4xl" />
        </NavLink>

        {/* Escondido en mobile (hidden md:flex): en una pantalla angosta
            estos 4 links de texto no entran junto al logo y el avatar sin
            amontonarse - en mobile la navegacion vive en BottomTabBar. */}
        <div className="hidden gap-6 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              // Links de vuelta a su tamano original (text-sm, x1).
              className={({ isActive }) =>
                cn(
                  "text-sm text-muted-foreground hover:text-foreground",
                  isActive && "font-medium text-foreground"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>

      <UserMenu />
    </nav>
  )
}
