import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  useDeleteCustomFood,
  useFavoriteFoods,
  useFoodLibrarySearch,
  useRecentFoods,
  useSetFoodFavorite,
} from "@/features/food-library/hooks"
import type { LibraryFood } from "@/features/food-library/types"
import {
  FOOD_QUERY_MAX_LENGTH,
  foodSearchFormSchema,
  type FoodSearchFormValues,
} from "@/features/foods/schemas"
import { searchErrorView } from "@/features/foods/searchError"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { SEARCH_DEBOUNCE_MS } from "../constants"
import {
  DELETE_CUSTOM_FOOD_FAILED_MESSAGE,
  LIBRARY_LOAD_FAILED_MESSAGE,
  favoriteErrorMessage,
} from "../errors"
import { gramsText } from "../format"
import { LibraryFoodList } from "./LibraryFoodList"

const MIN_QUERY_LENGTH = 2
const DEFAULT_GRAMS = "100"
const INITIAL_TEXT = "Busca un alimento para ver sus calorías y macros por 100 g."

// Búsqueda compartida del diario: busca mientras se escribe (con retardo), ofrece
// «Favoritos» y «Recientes» con la caja vacía y deja marcar favoritos y borrar
// alimentos propios.
export function FoodSearchPanel({
  initialQuery = "",
  onQueryChange,
  onSelect,
  onCreateCustom,
  actions,
}: {
  initialQuery?: string
  onQueryChange?: (query: string) => void
  onSelect: (food: LibraryFood, defaultGrams: string) => void
  onCreateCustom: (name: string) => void
  actions?: ReactNode
}): ReactElement {
  const form = useForm<FoodSearchFormValues>({
    resolver: zodResolver(foodSearchFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: { query: initialQuery },
  })
  const typed = useWatch({ control: form.control, name: "query" }) ?? ""
  const trimmed = typed.trim()
  const [active, flush] = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    onQueryChange?.(typed)
    // Solo cuando cambia el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed])

  const showLists = trimmed.length < MIN_QUERY_LENGTH
  const waiting = !showLists && trimmed !== active
  const query =
    !showLists && !waiting && active.length <= FOOD_QUERY_MAX_LENGTH ? active : null

  const search = useFoodLibrarySearch(query)
  const favorites = useFavoriteFoods()
  const recents = useRecentFoods()
  const setFavorite = useSetFoodFavorite()
  const deleteFood = useDeleteCustomFood()
  const [toDelete, setToDelete] = useState<LibraryFood | null>(null)

  function handleSubmit(values: FoodSearchFormValues) {
    flush(values.query)
  }

  function toggleFavorite(food: LibraryFood) {
    if (setFavorite.isPending) return
    setFavorite.mutate({ food, favorite: !food.favorite })
  }

  function confirmDelete() {
    if (!toDelete || deleteFood.isPending) return
    deleteFood.mutate(toDelete.id as number, { onSuccess: () => setToDelete(null) })
  }

  function cancelDelete() {
    setToDelete(null)
    deleteFood.reset()
  }

  const listProps = {
    onToggleFavorite: toggleFavorite,
    onDelete: (food: LibraryFood) => {
      deleteFood.reset()
      setToDelete(food)
    },
    disabled: setFavorite.isPending,
  }

  const createButton = (name: string, small: boolean) => (
    <Button
      type="button"
      variant="outline"
      size={small ? "sm" : "default"}
      className={small ? "mt-2" : undefined}
      onClick={() => onCreateCustom(name)}
    >
      Crear alimento personalizado
    </Button>
  )

  const loadFailed = showLists && (favorites.isError || recents.isError)
  const favoriteFoods = favorites.data ?? []
  const recentFoods = recents.data ?? []
  const listsLoading = showLists && (favorites.isPending || recents.isPending) && !loadFailed
  const noLists =
    showLists &&
    !loadFailed &&
    !listsLoading &&
    favoriteFoods.length === 0 &&
    recentFoods.length === 0

  const searchError = !showLists && search.isError ? searchErrorView(search.error) : null
  const searching = !showLists && (waiting || (query !== null && search.isPending))
  const noResults = !showLists && !waiting && search.isSuccess && search.data.length === 0
  const hasResults = !showLists && !waiting && search.isSuccess && search.data.length > 0

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3" noValidate>
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buscar alimento</FormLabel>
                <FormControl>
                  <Input
                    type="search"
                    placeholder="Ej.: arroz blanco cocido, banano"
                    maxLength={FOOD_QUERY_MAX_LENGTH}
                    {...field}
                    onChange={(event) => {
                      field.onChange(event)
                      if (form.formState.errors.query) form.clearErrors("query")
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <div role="status" aria-live="polite" className="my-4 text-sm text-muted-foreground">
        {noLists && INITIAL_TEXT}
        {loadFailed && (
          <>
            <p className="text-destructive">{LIBRARY_LOAD_FAILED_MESSAGE}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                void favorites.refetch()
                void recents.refetch()
              }}
            >
              Reintentar
            </Button>
          </>
        )}
        {searching && "Buscando…"}
        {noResults && (
          <>
            <p>{`No encontramos alimentos para «${query}».`}</p>
            {createButton(query ?? "", true)}
          </>
        )}
        {searchError && (
          <>
            <p className="text-destructive">{searchError.message}</p>
            {searchError.canRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void search.refetch()}
              >
                Reintentar
              </Button>
            )}
          </>
        )}
      </div>

      {setFavorite.isError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {favoriteErrorMessage(setFavorite.error)}
        </p>
      )}

      {showLists && favoriteFoods.length > 0 && (
        <section className="mb-4 space-y-2">
          <h3 className="font-medium">Favoritos</h3>
          <LibraryFoodList
            label="Favoritos"
            foods={favoriteFoods}
            onSelect={(food) => onSelect(food, DEFAULT_GRAMS)}
            {...listProps}
          />
        </section>
      )}

      {showLists && recentFoods.length > 0 && (
        <section className="mb-4 space-y-2">
          <h3 className="font-medium">Recientes</h3>
          <LibraryFoodList
            label="Recientes"
            foods={recentFoods}
            onSelect={(food) => {
              const recent = recentFoods.find((item) => item.kind === food.kind && item.id === food.id)
              onSelect(food, recent ? gramsText(recent.last_grams) : DEFAULT_GRAMS)
            }}
            {...listProps}
          />
        </section>
      )}

      {hasResults && (
        <LibraryFoodList
          label="Resultados"
          foods={search.data ?? []}
          onSelect={(food) => onSelect(food, DEFAULT_GRAMS)}
          {...listProps}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!noResults && createButton("", false)}
        {actions}
      </div>

      {toDelete && (
        <DeleteConfirmation
          title={`¿Borrar «${toDelete.name}» de tus alimentos?`}
          description="Las comidas ya registradas no cambian."
          isPending={deleteFood.isPending}
          error={deleteFood.isError ? DELETE_CUSTOM_FOOD_FAILED_MESSAGE : null}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  )
}

// Confirmación en línea (no modal): el resto de la búsqueda sigue accesible mientras está abierta.
function DeleteConfirmation({
  title,
  description,
  isPending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  isPending: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}): ReactElement {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="mt-4 space-y-3 rounded-lg border border-destructive/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isPending) onCancel()
      }}
    >
      <p id={titleId} className="font-medium">
        {title}
      </p>
      <p id={descriptionId} className="text-sm text-muted-foreground">
        {description}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
          Borrar
        </Button>
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
