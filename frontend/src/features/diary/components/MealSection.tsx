import { useEffect, useRef, useState, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { REMOVE_FAILED_MESSAGE } from "../errors"
import { formatKcal } from "../format"
import { useRemoveMealItem, type RemovalUndoState } from "../hooks"
import type { Meal, MealItem, MealType } from "../types"
import { AddFoodDialog } from "./AddFoodDialog"
import { DeleteMealDialog } from "./DeleteMealDialog"
import { EditGramsDialog } from "./EditGramsDialog"
import { MealItemRow } from "./MealItemRow"
import { MealPhotoDialog } from "./MealPhotoDialog"

export function MealSection({
  type,
  label,
  meal,
  date,
  undo,
  onDialogOpenChange,
}: {
  type: MealType
  label: string
  meal: Meal | null
  date: string
  undo: RemovalUndoState
  onDialogOpenChange: (open: boolean) => void
}): ReactElement {
  const [adding, setAdding] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [editing, setEditing] = useState<MealItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const remove = useRemoveMealItem(date)
  const items = meal?.items ?? []
  const dialogOpen = adding || photoOpen || editing !== null || deleting
  const notice = undo.notice?.mealType === type ? undo.notice : null

  // La página pausa el cambio de día mientras haya un diálogo abierto (AC-005.4).
  const notifyRef = useRef(onDialogOpenChange)
  useEffect(() => {
    notifyRef.current = onDialogOpenChange
  })
  useEffect(() => {
    notifyRef.current(dialogOpen)
  }, [dialogOpen])
  useEffect(() => {
    return () => notifyRef.current(false)
  }, [])

  function handleRemove(item: MealItem) {
    if (!meal) return
    remove.mutate(
      { mealId: meal.id, itemId: item.id },
      {
        onSuccess: (token) =>
          undo.offer(token ? { token, name: item.name, mealType: type } : null),
      }
    )
  }

  return (
    <Card className="mb-4">
      <CardContent>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{label}</h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleting(true)}
              >
                {`Vaciar ${label.toLowerCase()}`}
              </Button>
            )}
            <span className="tabular-nums text-sm text-muted-foreground">
              {formatKcal(meal?.totals.calories_kcal ?? 0)}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Sin alimentos.</p>
        ) : (
          <ul aria-label={`Alimentos de ${label}`}>
            {items.map((item) => (
              <MealItemRow
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onRemove={() => handleRemove(item)}
                isRemoving={remove.isPending && remove.variables?.itemId === item.id}
              />
            ))}
          </ul>
        )}

        {remove.isError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {REMOVE_FAILED_MESSAGE}
          </p>
        )}

        <div role="status" aria-live="polite">
          {notice && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{`Quitaste ${notice.name}.`}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={undo.isRestoring}
                onClick={undo.undo}
              >
                Deshacer
              </Button>
              {undo.error && <span className="text-muted-foreground">{undo.error}</span>}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            Añadir alimento
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Cargar imagen en ${label}`}
            onClick={() => setPhotoOpen(true)}
          >
            Cargar imagen
          </Button>
        </div>
      </CardContent>

      {adding && (
        <AddFoodDialog
          mealType={type}
          label={label}
          date={date}
          onClose={() => setAdding(false)}
        />
      )}
      {photoOpen && (
        <MealPhotoDialog
          mealType={type}
          label={label}
          date={date}
          onClose={() => setPhotoOpen(false)}
          onRegisterManually={() => {
            setPhotoOpen(false)
            setAdding(true)
          }}
        />
      )}
      {deleting && meal && (
        <DeleteMealDialog
          mealId={meal.id}
          label={label}
          itemCount={items.length}
          date={date}
          onClose={() => setDeleting(false)}
        />
      )}
      {editing && meal && (
        <EditGramsDialog
          mealId={meal.id}
          item={editing}
          date={date}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}
