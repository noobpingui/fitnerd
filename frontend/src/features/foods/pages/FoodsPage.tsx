import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { FoodResultList } from "../components/FoodResultList"
import { FoodSearchForm } from "../components/FoodSearchForm"
import { useFoodSearch } from "../hooks"
import { searchErrorView } from "../searchError"

const ATTRIBUTION =
  "Datos: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central."

export function FoodsPage(): ReactElement {
  const { mutate, isIdle, isPending, isError, isSuccess, error, data, variables } =
    useFoodSearch()

  function handleSearch(query: string) {
    if (isPending) return
    mutate(query)
  }

  const errorView = isError ? searchErrorView(error) : null
  const noResults = isSuccess && data.results.length === 0

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-4 text-2xl font-semibold">Alimentos</h1>

      <FoodSearchForm onSearch={handleSearch} isSearching={isPending} />

      <div role="status" aria-live="polite" className="my-4 text-sm text-muted-foreground">
        {isIdle && "Busca un alimento para ver sus calorías y macros por 100 g."}
        {isPending && "Buscando…"}
        {noResults && `No encontramos alimentos para «${variables}».`}
        {errorView && (
          <>
            <p className="text-destructive">{errorView.message}</p>
            {errorView.canRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => mutate(variables as string)}
              >
                Reintentar
              </Button>
            )}
          </>
        )}
      </div>

      {isSuccess && !noResults && <FoodResultList foods={data.results} />}

      <p className="mt-8 text-xs text-muted-foreground">{ATTRIBUTION}</p>
    </div>
  )
}
