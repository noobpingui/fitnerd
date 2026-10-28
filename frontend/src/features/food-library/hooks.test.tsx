// Hooks de la biblioteca de alimentos para editar un alimento propio (spec 029): la
// comprobación del nombre repetido y la mutación de edición. La red se simula en el
// api.ts de la feature. Se usan temporizadores reales con un retardo corto: con
// `setTimeout` falso TanStack Query no vacía sus notificaciones.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { ApiError } from "@/lib/apiClient"
import {
  makeBananaFood,
  makeCustomLibraryFood,
} from "@/test/foodLibraryFixtures"
import { searchFoodLibrary, updateCustomFood } from "./api"
import { foodLibraryKeys, useCustomFoodNameCheck, useUpdateCustomFood } from "./hooks"

vi.mock("@/features/food-library/api", () => ({
  searchFoodLibrary: vi.fn(),
  getRecentFoods: vi.fn(),
  getFavoriteFoods: vi.fn(),
  setFoodFavorite: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}))

const searchMock = vi.mocked(searchFoodLibrary)
const updateMock = vi.mocked(updateCustomFood)

const DELAY = 40

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const GALLO = makeCustomLibraryFood({ id: 12, name: "Gallo pinto", favorite: true })
const AVENA = makeCustomLibraryFood({ id: 13, name: "Avena casera", favorite: true })
const ARROZ_MAMA = makeCustomLibraryFood({ id: 14, name: "Arroz con pollo de mamá" })

function renderCheck(name: string, food = GALLO) {
  const queryClient = makeClient()
  return renderHook(({ value }) => useCustomFoodNameCheck(food, value, DELAY), {
    initialProps: { value: name },
    wrapper: wrapperFor(queryClient),
  })
}

beforeEach(() => {
  searchMock.mockReset()
  updateMock.mockReset()
})

describe("useCustomFoodNameCheck", () => {
  // SDD: 029 REQ-009 AC-009.1
  it("está «comprobando» durante el retardo y la petición, y después marca el repetido", async () => {
    const pending = deferred<never[]>()
    searchMock.mockReturnValue(pending.promise as never)
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "avena CASERA" })
    expect(result.current).toEqual({ checking: true, taken: false })

    // Pasado el retardo, la petición sigue en curso: sigue «comprobando».
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("avena CASERA"))
    expect(result.current.checking).toBe(true)
    expect(result.current.taken).toBe(false)

    await act(async () => {
      pending.resolve([AVENA] as never)
    })
    await waitFor(() => expect(result.current).toEqual({ checking: false, taken: true }))
  })

  // SDD: 029 REQ-009 AC-009.1
  it("al cambiar a un nombre libre el aviso desaparece", async () => {
    // La búsqueda de ambos nombres devuelve «Avena casera»: solo el primero la repite.
    searchMock.mockResolvedValue([AVENA])
    const { result, rerender } = renderCheck("Gallo pinto")
    rerender({ value: "avena CASERA" })
    await waitFor(() => expect(result.current.taken).toBe(true))

    rerender({ value: "Avena casera de la abuela" })

    await waitFor(() => expect(result.current).toEqual({ checking: false, taken: false }))
  })

  // SDD: 029 REQ-009 AC-009.2
  it("cuenta un propio que no es favorito y no distingue tildes ni mayúsculas", async () => {
    searchMock.mockResolvedValue([ARROZ_MAMA])
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "  ARROZ con pollo de mama " })

    await waitFor(() => expect(result.current.taken).toBe(true))
  })

  // SDD: 029 REQ-009 AC-009.3
  it("su propio nombre con otras mayúsculas no es un nombre repetido y no hace petición", async () => {
    searchMock.mockResolvedValue([GALLO])
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "GALLO PINTO" })
    await new Promise((resolve) => setTimeout(resolve, DELAY * 3))

    expect(result.current).toEqual({ checking: false, taken: false })
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-009 AC-009.3
  it("el resultado con el mismo id no cuenta aunque la búsqueda lo devuelva", async () => {
    searchMock.mockResolvedValue([GALLO])
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "Gallo pinto casero" })
    await waitFor(() => expect(searchMock).toHaveBeenCalled())

    await waitFor(() => expect(result.current).toEqual({ checking: false, taken: false }))
  })

  // SDD: 029 REQ-009 AC-009.4
  it("un alimento del catálogo con el mismo nombre no cuenta", async () => {
    searchMock.mockResolvedValue([makeBananaFood()])
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "Banano" })
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("Banano"))

    await waitFor(() => expect(result.current).toEqual({ checking: false, taken: false }))
  })

  // SDD: 029 REQ-009 AC-009.4
  it("un propio con otra clave de nombre tampoco cuenta", async () => {
    searchMock.mockResolvedValue([AVENA])
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "Avena" })
    await waitFor(() => expect(searchMock).toHaveBeenCalled())

    await waitFor(() => expect(result.current).toEqual({ checking: false, taken: false }))
  })

  // SDD: 029 REQ-009 AC-009.5
  it("si la búsqueda falla no hay aviso ni «comprobando»", async () => {
    searchMock.mockRejectedValue(new ApiError(500, "boom"))
    const { result, rerender } = renderCheck("Gallo pinto")

    rerender({ value: "avena CASERA" })

    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    await waitFor(() => expect(result.current).toEqual({ checking: false, taken: false }))
  })

  // SDD: 029 REQ-009 AC-009.1
  it("con el nombre sin cambios no hay petición ni «comprobando»", async () => {
    const { result } = renderCheck("Gallo pinto")
    await new Promise((resolve) => setTimeout(resolve, DELAY * 3))

    expect(result.current).toEqual({ checking: false, taken: false })
    expect(searchMock).not.toHaveBeenCalled()
  })
})

describe("useUpdateCustomFood", () => {
  const payload = {
    name: "Gallo pinto con huevo",
    per_100g: { calories_kcal: 200, protein_g: 9, carbs_g: 28, fat_g: 6 },
  }

  // SDD: 029 REQ-010 AC-010.2
  it("envía la edición y, tras el 200, invalida todas las consultas de la biblioteca", async () => {
    const edited = makeCustomLibraryFood({ name: payload.name, per_100g: payload.per_100g })
    updateMock.mockResolvedValue(edited)
    const queryClient = makeClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useUpdateCustomFood(), {
      wrapper: wrapperFor(queryClient),
    })

    let returned: unknown
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 12, payload })
    })

    expect(updateMock).toHaveBeenCalledWith(12, payload)
    expect(returned).toEqual(edited)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: foodLibraryKeys.all })
  })

  // SDD: 029 REQ-010 AC-010.2
  it("sigue «pendiente» hasta que terminan de llegar las listas nuevas", async () => {
    updateMock.mockResolvedValue(makeCustomLibraryFood())
    const queryClient = makeClient()
    const refetch = deferred<void>()
    vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(refetch.promise)
    const { result } = renderHook(() => useUpdateCustomFood(), {
      wrapper: wrapperFor(queryClient),
    })

    act(() => {
      result.current.mutate({ id: 12, payload })
    })
    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.isPending).toBe(true)

    await act(async () => {
      refetch.resolve()
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  // SDD: 029 REQ-010 AC-010.4
  it("tras un 404 invalida las consultas de la biblioteca y deja pasar el error", async () => {
    const failure = new ApiError(404, "No encontramos ese alimento.")
    updateMock.mockRejectedValue(failure)
    const queryClient = makeClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useUpdateCustomFood(), {
      wrapper: wrapperFor(queryClient),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 12, payload })).rejects.toBe(failure)
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: foodLibraryKeys.all })
  })

  // SDD: 029 REQ-010 AC-010.3
  it("tras un 409 deja pasar el error", async () => {
    const failure = new ApiError(409, "Ya tienes un alimento con ese nombre.")
    updateMock.mockRejectedValue(failure)
    const { result } = renderHook(() => useUpdateCustomFood(), {
      wrapper: wrapperFor(makeClient()),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 12, payload })).rejects.toBe(failure)
    })
  })
})
