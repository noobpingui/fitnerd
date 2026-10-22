import { useEffect, useRef, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { useCatalogSearch } from "@/features/catalog/hooks"
import { CatalogResultList } from "@/features/catalog/components/CatalogResultList"
import type { CatalogFood } from "@/features/catalog/types"
import { FoodSearchForm } from "@/features/foods/components/FoodSearchForm"
import { searchErrorView } from "@/features/foods/searchError"
import { foodSearchFormSchema } from "@/features/foods/schemas"

// Búsqueda en el catálogo desde la propuesta. Si el texto inicial es una
// búsqueda válida, se lanza al montarse.
export function ProposalSearchStep({
  initialQuery,
  onSelect,
  onBack,
}: {
  initialQuery: string
  onSelect: (food: CatalogFood) => void
  onBack: () => void
}): ReactElement {
  const search = useCatalogSearch()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const parsed = foodSearchFormSchema.safeParse({ query: initialQuery })
    if (parsed.success) search.mutate(parsed.data.query)
    // Solo al montarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(query: string) {
    if (search.isPending) return
    search.mutate(query)
  }

  const errorView = search.isError ? searchErrorView(search.error) : null
  const noResults = search.isSuccess && search.data.results.length === 0

  return (
    <div>
      <FoodSearchForm
        onSearch={handleSearch}
        isSearching={search.isPending}
        defaultQuery={initialQuery}
        placeholder="Ej.: arroz blanco cocido, banano"
      />

      <div role="status" aria-live="polite" className="my-4 text-sm text-muted-foreground">
        {search.isIdle && "Busca un alimento para ver sus calorías y macros por 100 g."}
        {search.isPending && "Buscando…"}
        {noResults && <p>{`No encontramos alimentos para «${search.variables}».`}</p>}
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
        <CatalogResultList foods={search.data.results} onSelect={onSelect} />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Volver a la propuesta
        </Button>
      </div>
    </div>
  )
}
