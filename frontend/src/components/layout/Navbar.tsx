import { NavLink, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/Logo"
import { cn } from "@/lib/utils"
import { clearToken } from "@/lib/authToken"

const links = [
  { to: "/categories", label: "Categorias" },
  { to: "/favorites", label: "Favoritos" },
  { to: "/body-metrics", label: "Metricas" },
]

export function Navbar() {
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate("/login", { replace: true })
  }

  return (
    <nav className="flex items-center justify-between border-b bg-card px-6 py-5">
      {/* text-lg (1.125rem) x3 = 3.375rem. Tailwind's arbitrary-value
          syntax (text-[valor]) permite un tamano exacto que no existe en
          la escala por defecto (text-4xl/5xl/etc.), en vez de aproximar
          con el paso mas cercano. */}
      <div className="flex items-center gap-8">
        <Logo className="text-[3.375rem]" />

        <div className="flex gap-6">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              // text-sm (0.875rem) x1.5 = 1.3125rem, mismo razonamiento.
              className={({ isActive }) =>
                cn(
                  "text-[1.3125rem] text-muted-foreground hover:text-foreground",
                  isActive && "font-medium text-foreground"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={handleLogout}>
        Cerrar sesion
      </Button>
    </nav>
  )
}
