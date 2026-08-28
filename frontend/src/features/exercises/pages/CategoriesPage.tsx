import { Link } from "react-router"
import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { useExerciseCategories } from "@/features/exercises/hooks"

export function CategoriesPage() {
  const { data: categories, isLoading, isError, error } = useExerciseCategories()

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Categorías</h1>
      <p className="mb-6 text-muted-foreground">
        Revisa el catálogo de ejercicios, su correcta ejecución y elegi tus
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
            <Link to={`/categories/${category.id}`}>
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
