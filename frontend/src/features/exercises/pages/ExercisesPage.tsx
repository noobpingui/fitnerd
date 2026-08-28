import { Link, useParams } from "react-router"
import { ArrowLeft } from "lucide-react"
import { ApiError } from "@/lib/apiClient"
import { ExerciseCard } from "@/features/exercises/components/ExerciseCard"
import {
  useAddFavorite,
  useExerciseCategories,
  useExercisesByCategory,
  useFavorites,
  useRemoveFavorite,
} from "@/features/exercises/hooks"

export function ExercisesPage() {
  const { categoryId } = useParams<{ categoryId: string }>()

  // useExerciseCategories() ya esta en cache (la pantalla anterior la pidio)
  // asi que esto no dispara un nuevo request de red - solo leemos el nombre.
  const { data: categories } = useExerciseCategories()
  const category = categories?.find((c) => c.id === categoryId)

  const {
    data: exercises,
    isLoading,
    isError,
    error,
  } = useExercisesByCategory(categoryId!)
  const { data: favorites } = useFavorites()
  const favoriteIds = new Set(favorites?.map((f) => f.id))

  const addFavorite = useAddFavorite()
  const removeFavorite = useRemoveFavorite()

  function handleToggle(exerciseId: string, isFavorite: boolean) {
    if (isFavorite) {
      removeFavorite.mutate(exerciseId)
    } else {
      addFavorite.mutate(exerciseId)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link
        to="/categories"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Categorías
      </Link>

      <h1 className="mb-6 text-2xl font-bold">
        {category?.name ?? "Ejercicios"}
      </h1>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {exercises?.map((exercise) => {
          const isFavorite = favoriteIds.has(exercise.id)
          // Cada mutation solo sabe "el ultimo id que se le paso" - esto
          // evita que TODOS los corazones se deshabiliten mientras uno
          // solo esta viajando al backend.
          const isToggling =
            (addFavorite.isPending && addFavorite.variables === exercise.id) ||
            (removeFavorite.isPending &&
              removeFavorite.variables === exercise.id)

          return (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isFavorite={isFavorite}
              isToggling={isToggling}
              onToggleFavorite={() => handleToggle(exercise.id, isFavorite)}
            />
          )
        })}
      </div>
    </div>
  )
}
