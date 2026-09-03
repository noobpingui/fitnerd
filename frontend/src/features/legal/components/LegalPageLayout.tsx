import type { ReactNode } from "react"
import { Link } from "react-router"
import { Logo } from "@/components/layout/Logo"

// Layout compartido por PrivacyPolicyPage y TermsOfServicePage - las dos
// son publicas (no requieren login, a diferencia de casi toda la app), asi
// que NO usan AppLayout (que vive detras de ProtectedRoute). Header simple
// propio, con el logo linkeando de vuelta a /login.
export function LegalPageLayout({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-5">
        <Link to="/login" className="inline-block">
          <Logo className="text-3xl" />
        </Link>
      </header>

      <div className="mx-auto max-w-2xl p-4 sm:p-8">
        <h1 className="mb-1 text-2xl font-bold">{title}</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Última actualización: {updatedAt}
        </p>

        {/* space-y-6 en vez de una clase "prose": el contenido de estas
            paginas lo armamos nosotros a mano (headings + p + ul), no
            viene de markdown/CMS, asi que no hace falta la libreria
            @tailwindcss/typography solo para esto. */}
        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </div>
    </div>
  )
}
