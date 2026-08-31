import { Fragment } from "react"
import { Link } from "react-router"
import { Home } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type BreadcrumbTrailItem = {
  label: string
  // Sin "to": es la pagina actual - se muestra como texto plano
  // (BreadcrumbPage), no como link.
  to?: string
}

type AppBreadcrumbsProps = {
  items: BreadcrumbTrailItem[]
}

// Los componentes de components/ui/breadcrumb.tsx (shadcn) son piezas
// sueltas SIN contenedor propio - por defecto se verian como el estilo
// "Simple" de Tailwind (texto plano en fila). El estilo "Contained" que
// se pidio es justo esa fila metida dentro de una caja con borde/sombra -
// eso es lo que agrega este wrapper: border+rounded+shadow+bg-card en
// BreadcrumbList, mas un icono de casa fijo como primer crumb (hacia
// /home), antes de los items que pasa cada pantalla.
export function AppBreadcrumbs({ items }: AppBreadcrumbsProps) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="flex-nowrap gap-1.5 rounded-md border bg-card px-3 py-2 shadow-xs sm:gap-1.5">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/home" aria-label="Inicio">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {items.length > 0 && <BreadcrumbSeparator />}

        {items.map((item, index) => (
          <Fragment key={item.label}>
            <BreadcrumbItem className="min-w-0">
              {item.to ? (
                <BreadcrumbLink asChild>
                  <Link to={item.to} className="truncate">
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate">
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>

            {index < items.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
