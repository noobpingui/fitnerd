import { Logo } from "@/components/layout/Logo"

// El año se calcula (no esta "hardcodeado" 2026 a mano) para que el footer
// nunca quede desactualizado - el 1ro de enero que viene, ya muestra el
// año nuevo solo, sin que nadie tenga que acordarse de venir a cambiarlo.
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-6 text-center">
      <Logo className="text-xl" />
      <p className="mt-1 text-xs text-muted-foreground">
        © {year} fitnerd
      </p>
    </footer>
  )
}
