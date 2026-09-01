import { Link, useParams } from "react-router"
import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs"
import { ApiError } from "@/lib/apiClient"
import { useBodyRegions, useExerciseCategories } from "@/features/exercises/hooks"

// Nivel 2 del catalogo: las categorias musculares (Pecho, Espalda, etc.)
// dentro de la region elegida en RegionsPage (nivel 1).
export function CategoriesPage() {
  const { regionId } = useParams<{ regionId: string }>()

  // useBodyRegions() ya esta en cache (RegionsPage la pidio antes) asi que
  // esto no dispara un nuevo request de red - solo leemos el nombre.
  const { data: regions } = useBodyRegions()
  const region = regions?.find((r) => r.id === regionId)

  const {
    data: categories,
    isLoading,
    isError,
    error,
  } = useExerciseCategories(regionId!)

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <AppBreadcrumbs
        items={[
          { label: "Catálogo", to: "/categories" },
          { label: region?.name ?? "Categorías" },
        ]}
      />

      <h1 className="mb-2 text-2xl font-bold">{region?.name ?? "Categorías"}</h1>
      <p className="mb-6 text-muted-foreground">
        Revisa el catálogo de ejercicios, su correcta ejecución y elige tus
        favoritos.
      </p>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {categories?.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <Link to={`/categories/${regionId}/${category.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="font-medium">
                  {category.name}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
