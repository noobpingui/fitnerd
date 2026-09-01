import { Link } from "react-router"
import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { useBodyRegions } from "@/features/exercises/hooks"

// Nivel 1 del catalogo: Tren Superior / Tren Inferior / Zona Media. Vive en
// /categories - CategoriesPage (nivel 2) se corrio a /categories/:regionId.

// El backend devuelve las regiones ordenadas alfabeticamente (para que el
// orden sea estable entre cargas), pero el orden que se quiere mostrar en
// pantalla no es alfabetico. REGION_ORDER fija esa posicion "a mano"; una
// region que no este en esta lista (alguna nueva que se agregue a futuro)
// cae al final, ordenada alfabeticamente entre si por sortRegions.
const REGION_ORDER = ["General", "Tren Superior", "Zona Media (Core)", "Tren Inferior"]

function sortRegions<T extends { name: string }>(regions: T[]): T[] {
  return [...regions].sort((a, b) => {
    const indexA = REGION_ORDER.indexOf(a.name)
    const indexB = REGION_ORDER.indexOf(b.name)
    // Si alguna no esta en REGION_ORDER, indexOf da -1 - la mandamos al
    // final (Infinity) en vez de al principio.
    const rankA = indexA === -1 ? Infinity : indexA
    const rankB = indexB === -1 ? Infinity : indexB
    if (rankA !== rankB) return rankA - rankB
    return a.name.localeCompare(b.name)
  })
}

export function RegionsPage() {
  const { data: regions, isLoading, isError, error } = useBodyRegions()
  const orderedRegions = regions ? sortRegions(regions) : regions

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Catálogo</h1>
      <p className="mb-6 text-muted-foreground">
        Elige una zona del cuerpo para ver sus categorías de ejercicios.
      </p>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {orderedRegions?.map((region, index) => (
          <motion.div
            key={region.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <Link to={`/categories/${region.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="font-medium">
                  {region.name}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
