import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { clearToken } from "@/lib/authToken"

export function Navbar() {
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate("/login", { replace: true })
  }

  return (
    <nav className="flex items-center justify-between border-b bg-card px-6 py-3">
      <span className="text-lg font-bold">
        fitnerd <span className="text-primary">.</span>
      </span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Cerrar sesion
      </Button>
    </nav>
  )
}
