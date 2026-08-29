import { Link } from "react-router"
import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { useBodyRegions } from "@/features/exercises/hooks"

// Nivel 1 del catalogo: Tren Superior / Tren Inferior / Zona Media. Vive en
// /categories - CategoriesPage (nivel 2) se corrio a /categories/:regionId.
export function RegionsPage() {
  const { data: regions, isLoading, isError, error } = useBodyRegions()

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Categorías</h1>
      <p className="mb-6 text-muted-foreground">
        Elegí una zona del cuerpo para ver sus categorías de ejercicios.
      </p>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {regions?.map((region, index) => (
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
