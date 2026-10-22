import { useState, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { REMOVE_FAILED_MESSAGE } from "../errors"
import { formatKcal } from "../format"
import { useRemoveMealItem } from "../hooks"
import type { Meal, MealItem, MealType } from "../types"
import { AddFoodDialog } from "./AddFoodDialog"
import { EditGramsDialog } from "./EditGramsDialog"
import { MealItemRow } from "./MealItemRow"
import { MealPhotoDialog } from "./MealPhotoDialog"

export function MealSection({
  type,
  label,
  meal,
  date,
}: {
  type: MealType
  label: string
  meal: Meal | null
  date: string
}): ReactElement {
  const [adding, setAdding] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [editing, setEditing] = useState<MealItem | null>(null)
  const remove = useRemoveMealItem(date)
  const items = meal?.items ?? []

  function handleRemove(item: MealItem) {
    if (!meal) return
    remove.mutate({ mealId: meal.id, itemId: item.id })
  }

  return (
    <Card className="mb-4">
      <CardContent>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{label}</h2>
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatKcal(meal?.totals.calories_kcal ?? 0)}
          </span>
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
