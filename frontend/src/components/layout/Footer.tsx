import { Link } from "react-router"
import { Logo } from "@/components/layout/Logo"
import logo from "@/assets/logo.png"

// El año se calcula (no esta "hardcodeado" 2026 a mano) para que el footer
// nunca quede desactualizado - el 1ro de enero que viene, ya muestra el
// año nuevo solo, sin que nadie tenga que acordarse de venir a cambiarlo.
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-6 text-center">
      {/* justify-center (no justify-between como en Navbar/Login): aca no
          hay dos extremos que separar, el bloque wordmark+imagen entero
          va centrado. h-9 (36px), mas chico que en Navbar (63px) porque
          el texto de base tambien es mucho mas chico aca (text-xl vs
          text-4xl) - misma idea, escalado a este contexto. */}
      <div className="flex items-center justify-center gap-2">
        <Logo className="text-xl" />
        <img src={logo} alt="" className="h-9 w-9 object-contain" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        © {year} fitnerd
      </p>
      <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground hover:underline">
          Privacidad
        </Link>
        <Link to="/terms" className="hover:text-foreground hover:underline">
          Términos
        </Link>
      </div>
    </footer>
  )
}
