import { AnimatePresence, motion } from "motion/react"
import { ApiError } from "@/lib/apiClient"
import { useExerciseCategories } from "@/features/exercises/hooks"

// Placeholder temporal - la pantalla real del catalogo (listar categorias,
// entrar a una, favoritos) se construye en el proximo paso. Por ahora esto
// solo confirma que, una vez logueado, las queries protegidas funcionan.
export function CategoriesPage() {
  const { data, isLoading, isError, error } = useExerciseCategories()

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-12 text-foreground">
      <motion.h1
        className="text-4xl font-bold"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        fitnerd <span className="text-primary">frontend</span>
      </motion.h1>

      <div className="min-h-16 w-64 rounded-lg border bg-card p-4 text-center text-sm text-card-foreground">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.p
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Cargando categorias...
            </motion.p>
          )}
          {isError && (
            <motion.p
              key="error"
              className="text-destructive"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Error ({error instanceof ApiError ? error.status : "?"}):{" "}
              {error.message}
            </motion.p>
          )}
          {data && (
            <motion.p
              key="data"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {data.length} categorias recibidas
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
