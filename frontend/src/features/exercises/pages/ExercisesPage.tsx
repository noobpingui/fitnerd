import { useParams } from "react-router"
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs"
import { ApiError } from "@/lib/apiClient"
import { ExerciseCard } from "@/features/exercises/components/ExerciseCard"
import {
  useAddFavorite,
  useBodyRegions,
  useExerciseCategories,
  useExercisesByCategory,
  useFavorites,
  useRemoveFavorite,
} from "@/features/exercises/hooks"

export function ExercisesPage() {
  const { regionId, categoryId } = useParams<{
    regionId: string
    categoryId: string
  }>()

  // useBodyRegions()/useExerciseCategories() ya estan en cache (RegionsPage
  // y CategoriesPage las pidieron antes, con este mismo regionId) asi que
  // esto no dispara un nuevo request de red - solo leemos los nombres para
  // el breadcrumb.
  const { data: regions } = useBodyRegions()
  const region = regions?.find((r) => r.id === regionId)

  const { data: categories } = useExerciseCategories(regionId!)
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
      <AppBreadcrumbs
        items={[
          { label: "Catálogo", to: "/categories" },
          { label: region?.name ?? "Categorías", to: `/categories/${regionId}` },
          { label: category?.name ?? "Ejercicios" },
        ]}
      />

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
