import { ApiError } from "@/lib/apiClient"
import { ExerciseCard } from "@/features/exercises/components/ExerciseCard"
import { useFavorites, useRemoveFavorite } from "@/features/exercises/hooks"

export function FavoritesPage() {
  const { data: favorites, isLoading, isError, error } = useFavorites()
  const removeFavorite = useRemoveFavorite()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Mis favoritos</h1>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      {favorites?.length === 0 && (
        <p className="text-muted-foreground">
          Todavia no marcaste ningun ejercicio como favorito.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {favorites?.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isFavorite
            isToggling={
              removeFavorite.isPending &&
              removeFavorite.variables === exercise.id
            }
            onToggleFavorite={() => removeFavorite.mutate(exercise.id)}
          />
        ))}
      </div>
    </div>
  )
}
