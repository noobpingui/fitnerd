import { NavLink, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { clearToken } from "@/lib/authToken"

const links = [
  { to: "/categories", label: "Categorias" },
  { to: "/favorites", label: "Favoritos" },
]

export function Navbar() {
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate("/login", { replace: true })
  }

  return (
    <nav className="flex items-center justify-between border-b bg-card px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold">
          fitnerd <span className="text-primary">.</span>
        </span>

        <div className="flex gap-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
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

      <Button variant="outline" size="sm" onClick={handleLogout}>
        Cerrar sesion
      </Button>
    </nav>
  )
}
