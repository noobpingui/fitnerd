import { useState, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCatalogSearch } from "@/features/catalog/hooks"
import { CatalogResultList } from "@/features/catalog/components/CatalogResultList"
import type { CatalogFood } from "@/features/catalog/types"
import { FoodSearchForm } from "@/features/foods/components/FoodSearchForm"
import { searchErrorView } from "@/features/foods/searchError"
import { saveErrorMessage } from "../errors"
import { useAddMealItems } from "../hooks"
import type { CatalogItemPayload, CustomItemPayload, MealType } from "../types"
import { CustomFoodForm } from "./CustomFoodForm"
import { PortionForm } from "./PortionForm"

type Step = "search" | "portion" | "custom"

export function AddFoodDialog({
  mealType,
  label,
  date,
  onClose,
}: {
  mealType: MealType
  label: string
  date: string
  onClose: () => void
}): ReactElement {
  const [step, setStep] = useState<Step>("search")
  const [food, setFood] = useState<CatalogFood | null>(null)
  // La búsqueda vive aquí para que «Volver a la búsqueda» conserve los resultados.
  const search = useCatalogSearch()
  const add = useAddMealItems(date)

  function handleSearch(query: string) {
    if (search.isPending) return
    search.mutate(query)
  }

  function goTo(next: Step) {
    add.reset()
    setStep(next)
  }

  function choose(selected: CatalogFood) {
    setFood(selected)
    goTo("portion")
  }

  async function save(item: CatalogItemPayload | CustomItemPayload) {
    if (add.isPending) return
    try {
      await add.mutateAsync({ date, meal_type: mealType, items: [item] })
    } catch {
      return
    }
    onClose()
  }

  const errorView = search.isError ? searchErrorView(search.error) : null
  const noResults = search.isSuccess && search.data.results.length === 0

  const cancelButton = (
    <Button type="button" variant="ghost" disabled={add.isPending} onClick={onClose}>
      Cancelar
    </Button>
  )
  const customButton = (
    <Button
      type="button"
      variant="outline"
      size={noResults ? "sm" : "default"}
      className={noResults ? "mt-2" : undefined}
      onClick={() => goTo("custom")}
    >
      Crear alimento personalizado
    </Button>
  )
  const backButton = (
    <Button
      type="button"
      variant="outline"
      disabled={add.isPending}
      onClick={() => goTo("search")}
    >
      Volver a la búsqueda
    </Button>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !add.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Añadir a ${label}`}</DialogTitle>
          <DialogDescription>Busca un alimento o crea uno propio.</DialogDescription>
        </DialogHeader>

        {add.isError && (
          <p role="alert" className="text-sm text-destructive">
            {saveErrorMessage(add.error)}
          </p>
        )}

        {step === "search" && (
          <div>
            <FoodSearchForm
              onSearch={handleSearch}
              isSearching={search.isPending}
              defaultQuery={search.variables ?? ""}
              placeholder="Ej.: arroz blanco cocido, banano"
            />

            <div role="status" aria-live="polite" className="my-4 text-sm text-muted-foreground">
              {search.isIdle && "Busca un alimento para ver sus calorías y macros por 100 g."}
              {search.isPending && "Buscando…"}
              {noResults && (
                <>
                  <p>{`No encontramos alimentos para «${search.variables}».`}</p>
                  {customButton}
                </>
              )}
              {errorView && (
                <>
                  <p className="text-destructive">{errorView.message}</p>
                  {errorView.canRetry && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => search.mutate(search.variables as string)}
                    >
                      Reintentar
                    </Button>
                  )}
                </>
              )}
            </div>

            {search.isSuccess && !noResults && (
              <CatalogResultList foods={search.data.results} onSelect={choose} />
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!noResults && customButton}
              {cancelButton}
            </div>
          </div>
        )}

        {step === "portion" && food && (
          <div className="space-y-3">
            <p className="font-medium">{food.name}</p>
            <PortionForm
              key={food.id}
              per100g={food.per_100g}
              defaultGrams="100"
              submitLabel="Añadir"
              isSaving={add.isPending}
              onSubmit={(grams) => save({ catalog_id: food.id, grams })}
            >
              {backButton}
              {cancelButton}
            </PortionForm>
          </div>
        )}

        {step === "custom" && (
          <CustomFoodForm
            defaultName={noResults ? String(search.variables ?? "") : ""}
            isSaving={add.isPending}
            onSubmit={save}
          >
            {backButton}
            {cancelButton}
          </CustomFoodForm>
        )}
      </DialogContent>
    </Dialog>
  )
}
