import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"

// Bloque genérico del perfil (título, descripción y contenido). El perfil
// es una pila de estas secciones, así que añadir opciones nuevas en el
// futuro (notificaciones, preferencias, privacidad…) es sumar otra.
export function ProfileSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
