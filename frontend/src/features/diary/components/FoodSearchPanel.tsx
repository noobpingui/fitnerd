import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
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
import type { CustomLibraryFood, LibraryFood } from "@/features/food-library/types"
import {
  FOOD_QUERY_MAX_LENGTH,
  foodSearchFormSchema,
  type FoodSearchFormValues,
} from "@/features/foods/schemas"
import { searchErrorView } from "@/features/foods/searchError"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { useEscapeCapture } from "@/lib/useEscapeCapture"
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

type ListLabel = "Resultados" | "Favoritos" | "Recientes"
type DeleteTarget = {
  food: CustomLibraryFood
  list: ListLabel
  trigger: HTMLButtonElement
  query: string // valor de la caja (sin recortar) al pulsar «Borrar»
}

// Búsqueda compartida del diario: busca mientras se escribe (con retardo), ofrece
// «Favoritos» y «Recientes» con la caja vacía y deja marcar favoritos y borrar
// alimentos propios.
export function FoodSearchPanel({
  initialQuery = "",
  onQueryChange,
  onSelect,
  onCreateCustom,
  onCustomFoodDeleted,
  actions,
}: {
  initialQuery?: string
  onQueryChange?: (query: string) => void
  onSelect: (food: LibraryFood, defaultGrams: string) => void
  onCreateCustom: (name: string) => void
  onCustomFoodDeleted?: (customFoodId: number) => void
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
  const [target, setTarget] = useState<DeleteTarget | null>(null)
  const [confirming, setConfirming] = useState(false)
  // «Favoritos» y «Recientes» arrancan plegadas para no saturar la vista.
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(false)

  function handleSubmit(values: FoodSearchFormValues) {
    flush(values.query)
  }

  function toggleFavorite(food: LibraryFood) {
    if (setFavorite.isPending) return
    setFavorite.mutate({ food, favorite: !food.favorite })
  }

  // El foco vuelve al botón «Borrar» pulsado o, si ya no está, a la caja de búsqueda.
  function focusTrigger(current: DeleteTarget) {
    if (current.trigger.isConnected) current.trigger.focus()
    else form.setFocus("query")
  }

  function confirmDelete() {
    if (!target || !confirming || deleteFood.isPending) return
    const current = target
    deleteFood.mutate(current.food.id, {
      onSuccess: () => {
        onCustomFoodDeleted?.(current.food.id)
        form.setFocus("query")
        setConfirming(false)
        setTarget(null)
      },
      onError: () => {
        setConfirming(false)
        const text = form.getValues("query")
        if (text === current.query) focusTrigger(current)
        else setTarget({ ...current, query: text })
      },
    })
  }

  function cancelDelete() {
    if (!target || deleteFood.isPending) return
    const current = target
    setConfirming(false)
    setTarget(null)
    deleteFood.reset()
    focusTrigger(current)
  }

  function startDelete(list: ListLabel) {
    return (food: CustomLibraryFood, trigger: HTMLButtonElement) => {
      deleteFood.reset()
      setTarget({ food, list, trigger, query: form.getValues("query") })
      setConfirming(true)
    }
  }

  // Dentro del elemento donde se pulsó «Borrar»: la confirmación, o el error del borrado.
  function renderInline(list: ListLabel) {
    return (food: LibraryFood): ReactNode => {
      if (!target || target.list !== list) return null
      if (target.food.kind !== food.kind || target.food.id !== food.id) return null
      if (confirming) {
        return (
          <DeleteConfirmation
            title={`¿Borrar «${target.food.name}» de tus alimentos?`}
            description="Las comidas ya registradas no cambian."
            isPending={deleteFood.isPending}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )
      }
      if (deleteFood.isError) {
        return (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {DELETE_CUSTOM_FOOD_FAILED_MESSAGE}
          </p>
        )
      }
      return null
    }
  }

  function listProps(list: ListLabel) {
    return {
      onToggleFavorite: toggleFavorite,
      onDelete: startDelete(list),
      renderInline: renderInline(list),
      disabled: setFavorite.isPending,
    }
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

  function isTargetShown(current: DeleteTarget): boolean {
    const same = (food: LibraryFood) =>
      food.kind === current.food.kind && food.id === current.food.id
    if (current.list === "Resultados") return hasResults && (search.data ?? []).some(same)
    if (current.list === "Favoritos") return showLists && favoritesOpen && favoriteFoods.some(same)
    return showLists && recentsOpen && recentFoods.some(same)
  }

  // Cierra la confirmación sin mover el foco a su botón (salvo que haya quedado en el cuerpo).
  function dismissDelete() {
    setConfirming(false)
    setTarget(null)
    deleteFood.reset()
    const focused = document.activeElement
    if (focused === null || focused === document.body) form.setFocus("query")
  }

  const shown = target !== null && isTargetShown(target)
  const isDeleting = deleteFood.isPending
  const deleted = deleteFood.isSuccess

  // La confirmación pertenece a la vista donde se abrió: si cambia el texto o el
  // alimento deja de mostrarse, se cierra en silencio.
  useEffect(() => {
    if (!target || isDeleting || deleted) return
    if (typed !== target.query || !shown) dismissDelete()
    // dismissDelete solo usa referencias estables y setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, typed, shown, isDeleting, deleted])

  return (
    <div>
      <Form {...form}>
        <form autoComplete="off" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3" noValidate>
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buscar alimento</FormLabel>
                <FormControl>
                  <Input
                    type="search"
                    autoComplete="off"
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

      {/* Arriba, bajo el campo: con listas largas los botones no quedan al final. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {!noResults && createButton("", false)}
        {actions}
      </div>

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
        <CollapsibleSection
          title="Favoritos"
          count={favoriteFoods.length}
          open={favoritesOpen}
          onToggle={() => setFavoritesOpen((current) => !current)}
        >
          <LibraryFoodList
            label="Favoritos"
            foods={favoriteFoods}
            onSelect={(food) => onSelect(food, DEFAULT_GRAMS)}
            {...listProps("Favoritos")}
          />
        </CollapsibleSection>
      )}

      {showLists && recentFoods.length > 0 && (
        <CollapsibleSection
          title="Recientes"
          count={recentFoods.length}
          open={recentsOpen}
          onToggle={() => setRecentsOpen((current) => !current)}
        >
          <LibraryFoodList
            label="Recientes"
            foods={recentFoods}
            onSelect={(food) => {
              const recent = recentFoods.find((item) => item.kind === food.kind && item.id === food.id)
              onSelect(food, recent ? gramsText(recent.last_grams) : DEFAULT_GRAMS)
            }}
            {...listProps("Recientes")}
          />
        </CollapsibleSection>
      )}

      {hasResults && (
        <LibraryFoodList
          label="Resultados"
          foods={search.data ?? []}
          onSelect={(food) => onSelect(food, DEFAULT_GRAMS)}
          {...listProps("Resultados")}
        />
      )}
    </div>
  )
}

// Sección que se despliega al pulsar su cabecera; plegada no pinta la lista.
function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}): ReactElement {
  const panelId = useId()
  return (
    <section className="mb-4">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between rounded-md py-1 font-medium"
        >
          <span>
            <span>{title}</span> <span className="font-normal text-muted-foreground">({count})</span>
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} className="mt-2 space-y-2" hidden={!open}>
        {open && children}
      </div>
    </section>
  )
}

// Confirmación en línea (no modal): el resto de la búsqueda sigue accesible mientras está abierta.
function DeleteConfirmation({
  title,
  description,
  isPending,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}): ReactElement {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Escape cancela la confirmación (con el borrado en curso se consume sin hacer nada).
  useEscapeCapture(onCancel, true)

  return (
    <div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="mt-3 space-y-3 rounded-lg border border-destructive/40 p-4"
    >
      <p id={titleId} className="font-medium">
        {title}
      </p>
      <p id={descriptionId} className="text-sm text-muted-foreground">
        {description}
      </p>
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
