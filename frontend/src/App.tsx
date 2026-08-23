import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { apiFetch, ApiError } from "@/lib/apiClient"

type ExerciseCategory = {
  id: string
  name: string
}

function App() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exercise-categories"],
    queryFn: () => apiFetch<ExerciseCategory[]>("/api/exercise-categories"),
  })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <motion.h1
        className="text-4xl font-bold"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        fitnerd <span className="text-primary">frontend</span>
      </motion.h1>

      <div className="flex gap-3">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button>Default</Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="secondary">Secondary</Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="outline">Outline</Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="destructive">Destructive</Button>
        </motion.div>
      </div>

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

export default App
