import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { ApiError } from "@/lib/apiClient"
import {
  useAllExerciseCategories,
  useFavorites,
  useRemoveFavorite,
} from "@/features/exercises/hooks"
import type { Exercise } from "@/features/exercises/types"
import {
  useAddWeeklyPlanEntry,
  useRemoveWeeklyPlanEntry,
  useWeeklyPlan,
} from "@/features/weekly-plan/hooks"
import { WEEK_DAYS } from "@/features/weekly-plan/constants"
import { DraggableFavoriteCard } from "@/features/weekly-plan/components/DraggableFavoriteCard"
import { DayColumn } from "@/features/weekly-plan/components/DayColumn"

// Reconoce el id "day-<n>" que le pusimos a cada DayColumn droppable.
const DAY_DROPPABLE_ID = /^day-(\d)$/

export function FavoritesPage() {
  const { data: favorites, isLoading, isError, error } = useFavorites()
  const removeFavorite = useRemoveFavorite()
  const { data: categories } = useAllExerciseCategories()

  const { data: weeklyPlan } = useWeeklyPlan()
  const addEntry = useAddWeeklyPlanEntry()
  const removeEntry = useRemoveWeeklyPlanEntry()

  // El id del ejercicio que se esta arrastrando ahora mismo (o null si no
  // hay drag en curso) - solo lo usamos para saber que texto mostrar en el
  // DragOverlay (la "tarjeta fantasma" que sigue al mouse/dedo).
  const [draggingExerciseId, setDraggingExerciseId] = useState<string | null>(
    null
  )

  // Mapa id -> Exercise para no andar buscando en el array cada vez.
  // La planificacion semanal (weeklyPlan) solo trae exercise_id, no el
  // detalle - lo sacamos de favorites, que ya esta cargado en esta misma
  // pantalla.
  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>()
    for (const exercise of favorites ?? []) map.set(exercise.id, exercise)
    return map
  }, [favorites])

  // Nombre de categoria por id, para agrupar los favoritos sin tener que
  // tocar la tabla exercise_favorites ni la de weekly_plan_entries: cada
  // Exercise ya trae su category_id (types.ts), solo faltaba una forma de
  // resolver el NOMBRE sin conocer de antemano la region de cada uno -
  // useAllExerciseCategories() trae todas las categorias activas para eso.
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories ?? []) map.set(category.id, category.name)
    return map
  }, [categories])

  // Agrupa los favoritos por categoria y ordena los grupos alfabeticamente
  // por nombre - asi el orden en pantalla es estable entre cargas (no
  // depende de en que orden llegaron del backend). Un ejercicio cuya
  // categoria no aparece en categoryNameById (caso raro: se desactivo la
  // categoria pero el ejercicio sigue activo) cae en un grupo "Otros".
  const favoritesByCategory = useMemo(() => {
    const grouped = new Map<string, Exercise[]>()
    for (const exercise of favorites ?? []) {
      const list = grouped.get(exercise.category_id) ?? []
      list.push(exercise)
      grouped.set(exercise.category_id, list)
    }

    return [...grouped.entries()]
      .map(([categoryId, exercises]) => ({
        categoryId,
        categoryName: categoryNameById.get(categoryId) ?? "Otros",
        exercises,
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [favorites, categoryNameById])

  // Agrupa las entradas de la planificacion por dia, ya con el Exercise
  // completo resuelto. Si un ejercicio se desfavorito despues de haber sido
  // agregado a un dia, exerciseById.get() da undefined y ese entry se
  // omite en silencio (no debería pasar seguido, y no vale la pena
  // mostrar un error por eso).
  const itemsByDay = useMemo(() => {
    const grouped = new Map<number, { entryId: string; exercise: Exercise }[]>()
    for (const { day } of WEEK_DAYS) grouped.set(day, [])

    for (const entry of weeklyPlan ?? []) {
      const exercise = exerciseById.get(entry.exercise_id)
      if (!exercise) continue
      grouped.get(entry.day_of_week)?.push({ entryId: entry.id, exercise })
    }

    return grouped
  }, [weeklyPlan, exerciseById])

  // PointerSensor cubre mouse/trackpad: activationConstraint de 8px evita
  // que un simple click (sin mover el mouse) se confunda con un drag.
  // TouchSensor cubre celular/tablet: como en touch no hay "click sin
  // mover" tan claro, usa un pequeño delay (hay que mantener el dedo
  // 200ms) para distinguir "quiero arrastrar" de "quiero hacer scroll".
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    setDraggingExerciseId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingExerciseId(null)

    const { active, over } = event
    if (!over) return // se solto fuera de cualquier columna

    const match = DAY_DROPPABLE_ID.exec(String(over.id))
    if (!match) return

    addEntry.mutate({
      exercise_id: String(active.id),
      day_of_week: Number(match[1]),
    })
  }

  const draggingExercise = draggingExerciseId
    ? exerciseById.get(draggingExerciseId)
    : undefined

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Mis favoritos</h1>
      <p className="mb-6 text-muted-foreground">
        Arma tu rutina semanal con tu lista de favoritos - Arrastra un ejercicio hacia el día que quieras
        incluirlo.
      </p>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      {favorites?.length === 0 && (
        <p className="text-muted-foreground">
          Todavía no marcaste ningún ejercicio como favorito.
        </p>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingExerciseId(null)}
      >
        <div className="flex flex-col gap-6">
          {/* Lista de favoritos - arriba, agrupada por categoria. Dentro de
              cada grupo sigue siendo flex-wrap (fichas chicas que se
              acomodan solas por ancho disponible). */}
          <div className="flex flex-col gap-4">
            {favoritesByCategory.map(({ categoryId, categoryName, exercises }) => (
              <div key={categoryId}>
                <h2 className="mb-1.5 px-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {categoryName}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {exercises.map((exercise) => (
                    <DraggableFavoriteCard
                      key={exercise.id}
                      exercise={exercise}
                      isRemoving={
                        removeFavorite.isPending &&
                        removeFavorite.variables === exercise.id
                      }
                      onRemoveFavorite={() => removeFavorite.mutate(exercise.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Linea divisoria (mismo recurso que HomePage.tsx entre la
              grilla de cards y el slideshow) para que quede claro que
              "favoritos" y "rutina" son dos secciones separadas. */}
          <div className="border-t" />

          {/* h2 (no h1: es un titulo de seccion dentro de esta pantalla,
              no el titulo de la pantalla en si) con el mismo estilo del
              h1 de arriba, para separar visualmente "favoritos" de
              "rutina" sin que se sienta como una pantalla distinta. */}
          <h2 className="text-2xl font-bold">Rutina Semanal</h2>

          {/* Columnas de la semana - abajo. Grilla FIJA de 3 columnas
              (nunca 4 ni 7, en ninguna pantalla): con nombres de ejercicio
              largos, 3 columnas le dan a cada card bastante mas ancho que
              antes para que el nombre se lea completo. WEEK_DAYS trae los
              7 dias Domingo->Sabado en orden, asi que el flujo normal del
              grid ya arma solo Dom/Lun/Mar en la fila 1 y Mie/Jue/Vie en
              la fila 2 - lo unico que hay que forzar a mano es Sabado
              (el 7mo), que va solo en la fila 3 y centrado (columna 2 de
              3) en vez de pegado a la izquierda. */}
          <div className="grid grid-cols-3 gap-2">
            {WEEK_DAYS.map(({ day, label }) => (
              <DayColumn
                key={day}
                day={day}
                label={label}
                items={itemsByDay.get(day) ?? []}
                onRemove={(entryId) => removeEntry.mutate(entryId)}
                removingEntryId={
                  removeEntry.isPending ? (removeEntry.variables ?? null) : null
                }
                className={day === 6 ? "col-start-2" : undefined}
              />
            ))}
          </div>
        </div>

        {/* DragOverlay: la "tarjeta fantasma" que sigue al mouse/dedo
            mientras se arrastra. Sin esto tambien funcionaria (dnd-kit no
            lo exige), pero se ve mucho mas claro que algo se esta
            moviendo. */}
        <DragOverlay>
          {draggingExercise && (
            <div className="rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-lg">
              {draggingExercise.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
