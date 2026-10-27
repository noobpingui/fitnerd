// Test de la búsqueda compartida del diario (spec 028): búsqueda mientras se
// escribe, «Favoritos» y «Recientes», favoritos, borrado de alimentos propios y
// accesibilidad. La red se simula en el api.ts de la biblioteca de alimentos.
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import {
  deleteCustomFood,
  getFavoriteFoods,
  getRecentFoods,
  searchFoodLibrary,
  setFoodFavorite,
} from "@/features/food-library/api"
import type { LibraryFood } from "@/features/food-library/types"
import {
  makeBananaFood,
  makeCustomLibraryFood,
  makeLibraryFood,
  makeRecentFood,
} from "@/test/foodLibraryFixtures"
import { FoodSearchPanel } from "./FoodSearchPanel"

vi.mock("@/features/food-library/api", () => ({
  searchFoodLibrary: vi.fn(),
  getRecentFoods: vi.fn(),
  getFavoriteFoods: vi.fn(),
  setFoodFavorite: vi.fn(),
  deleteCustomFood: vi.fn(),
}))

const searchMock = vi.mocked(searchFoodLibrary)
const recentMock = vi.mocked(getRecentFoods)
const favoritesMock = vi.mocked(getFavoriteFoods)
const setFavoriteMock = vi.mocked(setFoodFavorite)
const deleteMock = vi.mocked(deleteCustomFood)

const RICE = makeLibraryFood({
  id: "arroz-blanco-cocido",
  name: "Arroz blanco cocido",
  per_100g: { calories_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 },
})
const BANANA = makeBananaFood()
const GALLO = makeCustomLibraryFood()
const OATS = makeLibraryFood({
  id: "avena-cocida",
  name: "Avena cocida",
  per_100g: { calories_kcal: 71, protein_g: 2.5, carbs_g: 12, fat_g: 1.5 },
})

const SEARCH_FAILED = "No se pudo completar la búsqueda."
const LOAD_FAILED = "No se pudieron cargar tus alimentos."
const FAVORITE_FAILED = "No se pudo actualizar tus favoritos."
const DELETE_FAILED = "No se pudo borrar el alimento."
const LIMIT_400 = "Ya tienes 100 favoritos. Quita alguno para añadir otro."
const INITIAL_TEXT = "Busca un alimento para ver sus calorías y macros por 100 g."

type User = ReturnType<typeof userEvent.setup>

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderPanel(props: Partial<ComponentProps<typeof FoodSearchPanel>> = {}) {
  const onSelect = vi.fn()
  const onCreateCustom = vi.fn()
  const onQueryChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <FoodSearchPanel
        onSelect={onSelect}
        onCreateCustom={onCreateCustom}
        onQueryChange={onQueryChange}
        {...props}
      />
    </QueryClientProvider>
  )
  return { onSelect, onCreateCustom, onQueryChange, queryClient, view }
}

function box() {
  return screen.getByRole("searchbox", { name: "Buscar alimento" })
}

async function type(user: User, text: string) {
  await user.type(box(), text)
}

async function typeAndEnter(user: User, text: string) {
  await user.type(box(), `${text}{Enter}`)
}

function resetMocks() {
  searchMock.mockReset()
  recentMock.mockReset()
  favoritesMock.mockReset()
  setFavoriteMock.mockReset()
  deleteMock.mockReset()
  searchMock.mockResolvedValue([])
  recentMock.mockResolvedValue([])
  favoritesMock.mockResolvedValue([])
  setFavoriteMock.mockResolvedValue(undefined)
  deleteMock.mockResolvedValue(undefined)
}

// Para las pruebas del retardo de 300 ms: el reloj avanza solo, así que
// `findBy` y `waitFor` siguen funcionando, y `userEvent` lo adelanta a mano.
function timedUser(): User {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

// ---------------------------------------------------------------------------
// REQ-013: buscar mientras se escribe
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - buscar mientras se escribe", () => {
  beforeEach(() => {
    resetMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 028 REQ-013 AC-013.1
  it("300 ms después de la última tecla hace una sola petición con «arroz» y muestra sus resultados, sin botón «Buscar»", async () => {
    const user = timedUser()
    searchMock.mockResolvedValue([RICE])
    renderPanel()

    await type(user, "arroz")
    expect(searchMock).not.toHaveBeenCalled()
    await advance(300)

    expect(await screen.findByText("Arroz blanco cocido")).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock).toHaveBeenCalledWith("arroz")
    expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.1
  it("la caja se ve con su etiqueta y su ejemplo, sin ningún botón «Buscar»", () => {
    renderPanel()

    expect(box()).toHaveAttribute("placeholder", "Ej.: arroz blanco cocido, banano")
    expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.2
  it("al escribir «a», «ar», «arr» seguidos no pide nada hasta 300 ms después de la última, y pide «arr»", async () => {
    const user = timedUser()
    searchMock.mockResolvedValue([RICE])
    renderPanel()

    await type(user, "arr")
    // `type` termina unos ms de reloj simulado después de la última tecla: se mide
    // con margen por debajo (250 ms) y por encima (310 ms) de los 300 ms.
    await advance(250)
    expect(searchMock).not.toHaveBeenCalled()
    await advance(60)

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1))
    expect(searchMock).toHaveBeenCalledWith("arr")
  })

  // SDD: 028 REQ-013 AC-013.2
  it("una pausa de más de 300 ms entre teclas sí lanza una petición con lo escrito hasta entonces", async () => {
    const user = timedUser()
    renderPanel()

    await type(user, "ar")
    await advance(300)
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("ar"))
    await type(user, "roz")
    await advance(300)

    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("arroz"))
    expect(searchMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 028 REQ-013 AC-013.1
  it("busca con el texto sin los espacios de los extremos", async () => {
    const user = timedUser()
    renderPanel()

    await type(user, "  po  ")
    await advance(300)

    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("po"))
  })

  // SDD: 028 REQ-013 AC-013.4
  it("con «a» pasan 300 ms y no se hace ninguna petición ni se ve ningún aviso", async () => {
    const user = timedUser()
    renderPanel()

    await type(user, "a")
    await advance(600)

    expect(searchMock).not.toHaveBeenCalled()
    expect(screen.queryByText("La búsqueda debe tener al menos 2 caracteres.")).not.toBeInTheDocument()
    expect(screen.queryByText("Escribe qué alimento quieres buscar.")).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.4
  it("con «a» e Intro avisa «La búsqueda debe tener al menos 2 caracteres.» sin hacer ninguna petición", async () => {
    const user = timedUser()
    renderPanel()

    await typeAndEnter(user, "a")

    expect(
      await screen.findByText("La búsqueda debe tener al menos 2 caracteres.")
    ).toBeInTheDocument()
    await advance(600)
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 028 REQ-013 AC-013.5
  it("con la caja vacía e Intro avisa «Escribe qué alimento quieres buscar.» sin hacer ninguna petición", async () => {
    const user = timedUser()
    renderPanel()

    await user.type(box(), "{Enter}")

    expect(await screen.findByText("Escribe qué alimento quieres buscar.")).toBeInTheDocument()
    await advance(600)
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 028 REQ-013 AC-013.6
  it("Intro con «arroz» antes de los 300 ms busca en el momento y no se repite al cumplirse el retardo", async () => {
    const user = timedUser()
    searchMock.mockResolvedValue([RICE])
    renderPanel()

    await typeAndEnter(user, "arroz")

    expect(await screen.findByText("Arroz blanco cocido")).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    await advance(1000)
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock).toHaveBeenCalledWith("arroz")
  })

  // SDD: 028 REQ-013 AC-013.1
  it("no hay avisos de validación mientras se escribe, solo al pulsar Intro", async () => {
    const user = timedUser()
    renderPanel()

    await type(user, "a")
    await advance(500)

    expect(screen.queryByText(/al menos 2 caracteres/)).not.toBeInTheDocument()
  })
})

describe("FoodSearchPanel - resultados, carreras y errores", () => {
  beforeEach(resetMocks)

  // SDD: 028 REQ-013 AC-013.3
  it("si llega primero la respuesta de «arroz» y después la de «pollo», se ven los resultados de «arroz»", async () => {
    const user = userEvent.setup()
    const pollo = deferred<LibraryFood[]>()
    const arroz = deferred<LibraryFood[]>()
    searchMock.mockImplementation((query) => (query === "pollo" ? pollo.promise : arroz.promise))
    renderPanel()

    await typeAndEnter(user, "pollo")
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("pollo"))
    await user.clear(box())
    await typeAndEnter(user, "arroz")
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("arroz"))
    await act(async () => {
      arroz.resolve([RICE])
    })
    await screen.findByText("Arroz blanco cocido")
    await act(async () => {
      pollo.resolve([makeLibraryFood()])
    })

    expect(screen.getByText("Arroz blanco cocido")).toBeInTheDocument()
    expect(screen.queryByText("Pechuga de pollo a la plancha")).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.7
  it("sin resultados para «gallo pinto» muestra el aviso y «Crear alimento personalizado», que pasa el nombre buscado", async () => {
    const user = userEvent.setup()
    const { onCreateCustom } = renderPanel()

    await typeAndEnter(user, "gallo pinto")

    expect(
      await screen.findByText("No encontramos alimentos para «gallo pinto».")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Crear alimento personalizado" }))
    expect(onCreateCustom).toHaveBeenCalledTimes(1)
    expect(onCreateCustom).toHaveBeenCalledWith("gallo pinto")
  })

  // SDD: 028 REQ-013 AC-013.7
  it("con resultados también ofrece «Crear alimento personalizado», sin nombre", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([RICE])
    const { onCreateCustom } = renderPanel()
    await typeAndEnter(user, "arroz")
    await screen.findByText("Arroz blanco cocido")

    await user.click(screen.getByRole("button", { name: "Crear alimento personalizado" }))

    expect(onCreateCustom).toHaveBeenCalledWith("")
  })

  // SDD: 028 REQ-013 AC-013.8
  it.each([
    ["un error del servidor", new ApiError(500, "boom")],
    ["un error de red", new TypeError("Failed to fetch")],
  ])("ante %s muestra «No se pudo completar la búsqueda.» con «Reintentar» y la caja conserva el texto", async (_name, error) => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(error)
    renderPanel()

    await typeAndEnter(user, "pollo")

    expect(await screen.findByText(SEARCH_FAILED)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
    expect(box()).toHaveValue("pollo")
  })

  // SDD: 028 REQ-013 AC-013.8
  it("«Reintentar» repite la última consulta y muestra los resultados", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    searchMock.mockResolvedValue([RICE])
    renderPanel()
    await typeAndEnter(user, "arroz")
    await screen.findByText(SEARCH_FAILED)

    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Arroz blanco cocido")).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(2)
    expect(searchMock.mock.calls[1][0]).toBe("arroz")
  })

  // SDD: 028 REQ-013 AC-013.8
  it("un 429 muestra el mensaje del servidor sin «Reintentar»", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(429, "Demasiadas búsquedas."))
    renderPanel()

    await typeAndEnter(user, "pollo")

    expect(await screen.findByText("Demasiadas búsquedas.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.1
  it("«Elegir» en un resultado entrega el alimento y 100 g", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([RICE, BANANA])
    const { onSelect } = renderPanel()
    await typeAndEnter(user, "ar")

    await user.click(await screen.findByRole("button", { name: "Elegir Banano" }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "catalog", id: "banano" }), "100")
  })

  // SDD: 028 REQ-013 AC-013.7
  it("un texto inicial válido busca nada más montarse y deja la caja rellena", async () => {
    searchMock.mockResolvedValue([RICE])
    renderPanel({ initialQuery: "Salsa de tomate" })

    expect(box()).toHaveValue("Salsa de tomate")
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1))
    expect(searchMock).toHaveBeenCalledWith("Salsa de tomate")
    expect(await screen.findByText("Arroz blanco cocido")).toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.4
  it("un texto inicial de un solo carácter no busca", async () => {
    renderPanel({ initialQuery: "a" })

    expect(box()).toHaveValue("a")
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 028 REQ-013 AC-013.1
  it("avisa del texto de la caja a quien lo pide, para recuperarlo al volver", async () => {
    const user = userEvent.setup()
    const { onQueryChange } = renderPanel()

    await type(user, "arroz")

    expect(onQueryChange).toHaveBeenLastCalledWith("arroz")
  })

  // SDD: 028 REQ-013 AC-013.9
  it("muestra las acciones que le pasa quien lo usa", () => {
    renderPanel({ actions: <button type="button">Volver a la propuesta</button> })

    expect(screen.getByRole("button", { name: "Volver a la propuesta" })).toBeInTheDocument()
  })

  // SDD: 028 REQ-013 AC-013.9
  it("con una búsqueda con resultados deja de ofrecer favoritos y recientes", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    searchMock.mockResolvedValue([RICE])
    renderPanel()
    await screen.findByRole("list", { name: "Favoritos" })

    await typeAndEnter(user, "arroz")

    expect(await screen.findByRole("list", { name: "Resultados" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REQ-014: favoritos y recientes con la caja vacía
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - favoritos y recientes", () => {
  beforeEach(resetMocks)

  // SDD: 028 REQ-014 AC-014.1
  it("con «Avena cocida» en favoritos y «Banano» (150 g) en recientes muestra los dos encabezados con sus alimentos", async () => {
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()

    const favorites = await screen.findByRole("list", { name: "Favoritos" })
    const recents = await screen.findByRole("list", { name: "Recientes" })

    expect(screen.getByText("Favoritos")).toBeInTheDocument()
    expect(screen.getByText("Recientes")).toBeInTheDocument()
    expect(within(favorites).getByText("Avena cocida")).toBeInTheDocument()
    expect(within(recents).getByText("Banano")).toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.1
  it("cada alimento de las listas muestra sus macros por 100 g y su botón «Elegir»", async () => {
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()

    const recents = await screen.findByRole("list", { name: "Recientes" })

    expect(within(recents).getByText("89 kcal")).toBeInTheDocument()
    expect(within(recents).getByText("1,1 g proteína")).toBeInTheDocument()
    expect(within(recents).getByText("22,8 g carbohidratos")).toBeInTheDocument()
    expect(within(recents).getByText("0,3 g grasa")).toBeInTheDocument()
    expect(within(recents).getByRole("button", { name: "Elegir Banano" })).toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.1
  it("si solo hay recientes no muestra el encabezado «Favoritos»", async () => {
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()

    await screen.findByRole("list", { name: "Recientes" })

    expect(screen.queryByText("Favoritos")).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.2
  it("sin favoritos ni recientes no muestra esos encabezados y sí «Busca un alimento para ver sus calorías y macros por 100 g.»", async () => {
    renderPanel()

    expect(await screen.findByText(INITIAL_TEXT)).toBeInTheDocument()
    await waitFor(() => expect(recentMock).toHaveBeenCalled())
    expect(screen.queryByText("Favoritos")).not.toBeInTheDocument()
    expect(screen.queryByText("Recientes")).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.3
  it("al escribir «arroz» y llegar sus resultados dejan de verse las listas, y al borrar el texto vuelven", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    searchMock.mockResolvedValue([RICE])
    renderPanel()
    await screen.findByRole("list", { name: "Favoritos" })

    await typeAndEnter(user, "arroz")
    await screen.findByRole("list", { name: "Resultados" })
    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Recientes" })).not.toBeInTheDocument()

    await user.clear(box())

    expect(await screen.findByRole("list", { name: "Favoritos" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Recientes" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Resultados" })).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.3
  it("con un solo carácter escrito siguen viéndose las listas", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()
    await screen.findByRole("list", { name: "Recientes" })

    await type(user, "a")

    expect(screen.getByRole("list", { name: "Recientes" })).toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.4
  it("si falla la carga muestra «No se pudieron cargar tus alimentos.» con «Reintentar» y la búsqueda sigue funcionando", async () => {
    const user = userEvent.setup()
    recentMock.mockRejectedValue(new ApiError(500, "boom"))
    searchMock.mockResolvedValue([RICE])
    renderPanel()

    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()

    await typeAndEnter(user, "arroz")

    expect(await screen.findByText("Arroz blanco cocido")).toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.4
  it("«Reintentar» vuelve a pedir los recientes y los favoritos y muestra las listas", async () => {
    const user = userEvent.setup()
    recentMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()
    await screen.findByText(LOAD_FAILED)
    const recentCalls = recentMock.mock.calls.length
    const favoriteCalls = favoritesMock.mock.calls.length

    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByRole("list", { name: "Recientes" })).toBeInTheDocument()
    expect(recentMock.mock.calls.length).toBeGreaterThan(recentCalls)
    expect(favoritesMock.mock.calls.length).toBeGreaterThan(favoriteCalls)
    expect(screen.queryByText(LOAD_FAILED)).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.5
  it("elegir en «Recientes» entrega los gramos de su último registro (150)", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    const { onSelect } = renderPanel()
    const recents = await screen.findByRole("list", { name: "Recientes" })

    await user.click(within(recents).getByRole("button", { name: "Elegir Banano" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "catalog", id: "banano" }), "150")
  })

  // SDD: 028 REQ-014 AC-014.5
  it("los gramos de un reciente se escriben con coma decimal: 12,5", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(GALLO, 12.5)])
    const { onSelect } = renderPanel()
    const recents = await screen.findByRole("list", { name: "Recientes" })

    await user.click(within(recents).getByRole("button", { name: "Elegir Gallo pinto" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "custom", id: 12 }), "12,5")
  })

  // SDD: 028 REQ-014 AC-014.5
  it("elegir en «Favoritos» entrega 100 g", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    const { onSelect } = renderPanel()
    const favorites = await screen.findByRole("list", { name: "Favoritos" })

    await user.click(within(favorites).getByRole("button", { name: "Elegir Avena cocida" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "avena-cocida" }), "100")
  })

  // SDD: 028 REQ-014 AC-014.5
  it("un alimento que está a la vez en favoritos y recientes entrega los gramos de la lista donde se pulsa", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...BANANA, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood({ ...BANANA, favorite: true }, 150)])
    const { onSelect } = renderPanel()
    const favorites = await screen.findByRole("list", { name: "Favoritos" })
    const recents = await screen.findByRole("list", { name: "Recientes" })

    await user.click(within(recents).getByRole("button", { name: "Elegir Banano" }))
    await user.click(within(favorites).getByRole("button", { name: "Elegir Banano" }))

    expect(onSelect.mock.calls.map((call) => call[1])).toEqual(["150", "100"])
  })
})

// ---------------------------------------------------------------------------
// REQ-015: etiqueta «Personalizado» y favoritos
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - alimentos propios y favoritos", () => {
  beforeEach(resetMocks)

  // SDD: 028 REQ-015 AC-015.1
  it("solo «Gallo pinto» lleva «Personalizado» y los dos tienen un botón «Elegir {nombre}»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([BANANA, GALLO])
    renderPanel()

    await typeAndEnter(user, "ga")

    const list = await screen.findByRole("list", { name: "Resultados" })
    const [banano, gallo] = within(list).getAllByRole("listitem")
    expect(within(gallo).getByText("Personalizado")).toBeInTheDocument()
    expect(within(banano).queryByText("Personalizado")).not.toBeInTheDocument()
    expect(within(list).getAllByText("Personalizado")).toHaveLength(1)
    expect(within(list).getByRole("button", { name: "Elegir Banano" })).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: "Elegir Gallo pinto" })).toBeInTheDocument()
  })

  // SDD: 028 REQ-015 AC-015.1
  it("la etiqueta «Personalizado» también se ve en favoritos y recientes", async () => {
    favoritesMock.mockResolvedValue([{ ...GALLO, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood({ ...GALLO, favorite: true }, 200)])
    renderPanel()

    const favorites = await screen.findByRole("list", { name: "Favoritos" })
    const recents = await screen.findByRole("list", { name: "Recientes" })

    expect(within(favorites).getByText("Personalizado")).toBeInTheDocument()
    expect(within(recents).getByText("Personalizado")).toBeInTheDocument()
  })

  // SDD: 028 REQ-015 AC-015.1
  it("cada resultado muestra sus macros por 100 g", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()

    await typeAndEnter(user, "gallo")

    const list = await screen.findByRole("list", { name: "Resultados" })
    expect(within(list).getByText("180 kcal")).toBeInTheDocument()
    expect(within(list).getByText("6,0 g proteína")).toBeInTheDocument()
    expect(within(list).getByText("30,0 g carbohidratos")).toBeInTheDocument()
    expect(within(list).getByText("4,0 g grasa")).toBeInTheDocument()
  })

  // SDD: 028 REQ-015 AC-015.2
  it("«Añadir Banano a favoritos» pide marcar catalog/banano, pasa a «Quitar Banano de favoritos» pulsado y «Banano» aparece en «Favoritos» al vaciar la caja", async () => {
    const user = userEvent.setup()
    let bananaFavorite = false
    searchMock.mockImplementation(async () => [{ ...BANANA, favorite: bananaFavorite }])
    favoritesMock.mockImplementation(async () =>
      bananaFavorite ? [{ ...BANANA, favorite: true }] : []
    )
    setFavoriteMock.mockImplementation(async (_food, favorite) => {
      bananaFavorite = favorite
    })
    renderPanel()
    await typeAndEnter(user, "banano")

    await user.click(await screen.findByRole("button", { name: "Añadir Banano a favoritos" }))

    expect(setFavoriteMock).toHaveBeenCalledTimes(1)
    expect(setFavoriteMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "catalog", id: "banano" }),
      true
    )
    expect(
      await screen.findByRole("button", { name: "Quitar Banano de favoritos", pressed: true })
    ).toBeInTheDocument()
    await user.clear(box())
    const favorites = await screen.findByRole("list", { name: "Favoritos" })
    expect(within(favorites).getByText("Banano")).toBeInTheDocument()
  })

  // SDD: 028 REQ-015 AC-015.3
  it("«Quitar Gallo pinto de favoritos» pide quitar custom/{id} y pasa a «Añadir Gallo pinto a favoritos»", async () => {
    const user = userEvent.setup()
    let gallopintoFavorite = true
    searchMock.mockImplementation(async () => [{ ...GALLO, favorite: gallopintoFavorite }])
    setFavoriteMock.mockImplementation(async (_food, favorite) => {
      gallopintoFavorite = favorite
    })
    renderPanel()
    await typeAndEnter(user, "gallo")

    await user.click(await screen.findByRole("button", { name: "Quitar Gallo pinto de favoritos" }))

    expect(setFavoriteMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "custom", id: 12 }),
      false
    )
    expect(
      await screen.findByRole("button", { name: "Añadir Gallo pinto a favoritos", pressed: false })
    ).toBeInTheDocument()
  })

  // SDD: 028 REQ-015 AC-015.4
  it("si marcar un favorito falla muestra «No se pudo actualizar tus favoritos.» y el botón sigue como antes", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([BANANA])
    setFavoriteMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPanel()
    await typeAndEnter(user, "banano")

    await user.click(await screen.findByRole("button", { name: "Añadir Banano a favoritos" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(FAVORITE_FAILED)
    expect(
      screen.getByRole("button", { name: "Añadir Banano a favoritos", pressed: false })
    ).toBeInTheDocument()
  })

  // SDD: 028 REQ-015 AC-015.4
  it("un error de red al marcar un favorito muestra el mismo mensaje", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([BANANA])
    setFavoriteMock.mockRejectedValue(new TypeError("Failed to fetch"))
    renderPanel()
    await typeAndEnter(user, "banano")

    await user.click(await screen.findByRole("button", { name: "Añadir Banano a favoritos" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(FAVORITE_FAILED)
  })

  // SDD: 028 REQ-015 AC-015.5
  it("si marcar un favorito responde 400 por el límite muestra el mensaje del servidor", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([BANANA])
    setFavoriteMock.mockRejectedValue(new ApiError(400, LIMIT_400))
    renderPanel()
    await typeAndEnter(user, "banano")

    await user.click(await screen.findByRole("button", { name: "Añadir Banano a favoritos" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(LIMIT_400)
  })

  // SDD: 028 REQ-015 AC-015.2
  it("marcar un favorito no elige el alimento", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([BANANA])
    const { onSelect } = renderPanel()
    await typeAndEnter(user, "banano")

    await user.click(await screen.findByRole("button", { name: "Añadir Banano a favoritos" }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  // SDD: 028 REQ-015 AC-015.2
  it("desde «Recientes» también se puede marcar un favorito", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()
    const recents = await screen.findByRole("list", { name: "Recientes" })

    await user.click(within(recents).getByRole("button", { name: "Añadir Banano a favoritos" }))

    expect(setFavoriteMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "catalog", id: "banano" }),
      true
    )
  })
})

// ---------------------------------------------------------------------------
// REQ-017: borrar un alimento propio
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - borrar un alimento propio", () => {
  beforeEach(resetMocks)

  const DELETE_LABEL = "Borrar Gallo pinto de tus alimentos"
  const CONFIRM_TITLE = "¿Borrar «Gallo pinto» de tus alimentos?"

  // SDD: 028 REQ-017 AC-017.1
  it("«Borrar Gallo pinto de tus alimentos» pide confirmación con su título, su texto y los botones «Borrar» y «Cancelar»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()
    await typeAndEnter(user, "gallo")

    await user.click(await screen.findByRole("button", { name: DELETE_LABEL }))

    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })
    expect(within(confirmation).getByText("Las comidas ya registradas no cambian.")).toBeInTheDocument()
    expect(within(confirmation).getByRole("button", { name: "Borrar" })).toBeInTheDocument()
    expect(within(confirmation).getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: 028 REQ-017 AC-017.1
  it("al confirmar pide el borrado del id y «Gallo pinto» desaparece de los resultados", async () => {
    const user = userEvent.setup()
    let deleted = false
    searchMock.mockImplementation(async () => (deleted ? [] : [GALLO]))
    deleteMock.mockImplementation(async () => {
      deleted = true
    })
    renderPanel()
    await typeAndEnter(user, "gallo")
    await user.click(await screen.findByRole("button", { name: DELETE_LABEL }))
    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteMock).toHaveBeenCalledWith(12)
    await waitFor(() => expect(screen.queryByText("Gallo pinto")).not.toBeInTheDocument())
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-017 AC-017.1
  it("borrarlo desde «Favoritos» lo quita también de «Recientes»", async () => {
    const user = userEvent.setup()
    let deleted = false
    favoritesMock.mockImplementation(async () => (deleted ? [] : [{ ...GALLO, favorite: true }]))
    recentMock.mockImplementation(async () =>
      deleted ? [] : [makeRecentFood({ ...GALLO, favorite: true }, 200)]
    )
    deleteMock.mockImplementation(async () => {
      deleted = true
    })
    renderPanel()
    const favorites = await screen.findByRole("list", { name: "Favoritos" })
    await screen.findByRole("list", { name: "Recientes" })

    await user.click(within(favorites).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })
    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument())
    expect(screen.queryByRole("list", { name: "Recientes" })).not.toBeInTheDocument()
    expect(screen.queryByText("Gallo pinto")).not.toBeInTheDocument()
    expect(await screen.findByText(INITIAL_TEXT)).toBeInTheDocument()
  })

  // SDD: 028 REQ-017 AC-017.2
  it("«Cancelar» no hace ninguna petición y el alimento sigue", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()
    await typeAndEnter(user, "gallo")
    await user.click(await screen.findByRole("button", { name: DELETE_LABEL }))
    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })

    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }))

    expect(deleteMock).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(screen.getByText("Gallo pinto")).toBeInTheDocument()
  })

  // SDD: 028 REQ-017 AC-017.3
  it("si el borrado falla muestra «No se pudo borrar el alimento.» y el alimento sigue en la lista", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    deleteMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPanel()
    await typeAndEnter(user, "gallo")
    await user.click(await screen.findByRole("button", { name: DELETE_LABEL }))
    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    expect(await within(confirmation).findByText(DELETE_FAILED)).toBeInTheDocument()
    expect(screen.getByRole("alertdialog", { name: CONFIRM_TITLE })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Resultados" })).toHaveTextContent("Gallo pinto")
  })

  // SDD: 028 REQ-017 AC-017.3
  it("un 404 al borrar cuenta como éxito: el alimento ya no existía", async () => {
    const user = userEvent.setup()
    let deleted = false
    searchMock.mockImplementation(async () => (deleted ? [] : [GALLO]))
    deleteMock.mockImplementation(async () => {
      deleted = true
      throw new ApiError(404, "No encontramos ese alimento.")
    })
    renderPanel()
    await typeAndEnter(user, "gallo")
    await user.click(await screen.findByRole("button", { name: DELETE_LABEL }))
    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-017 AC-017.4
  it("un resultado del catálogo no tiene botón «Borrar»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([BANANA])
    renderPanel()
    await typeAndEnter(user, "banano")

    const list = await screen.findByRole("list", { name: "Resultados" })

    expect(within(list).queryByRole("button", { name: /^Borrar / })).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-017 AC-017.4
  it("un alimento del catálogo en favoritos o recientes tampoco tiene «Borrar»", async () => {
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()
    await screen.findByRole("list", { name: "Recientes" })

    expect(screen.queryByRole("button", { name: /^Borrar / })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// NFR-002: accesibilidad
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - accesibilidad", () => {
  beforeEach(resetMocks)

  // SDD: 028 NFR-002 AC-N002.1
  it("hay un campo «Buscar alimento», las listas «Resultados», «Favoritos» y «Recientes» y, por alimento, «Elegir {nombre}» y el favorito con aria-pressed", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    searchMock.mockResolvedValue([RICE, { ...BANANA, favorite: true }])
    renderPanel()

    const favorites = await screen.findByRole("list", { name: "Favoritos" })
    const recents = await screen.findByRole("list", { name: "Recientes" })
    expect(box()).toBeInTheDocument()
    expect(within(favorites).getByRole("button", { name: "Elegir Avena cocida" })).toBeInTheDocument()
    expect(
      within(favorites).getByRole("button", { name: "Quitar Avena cocida de favoritos", pressed: true })
    ).toBeInTheDocument()
    expect(
      within(recents).getByRole("button", { name: "Añadir Banano a favoritos", pressed: false })
    ).toBeInTheDocument()

    await typeAndEnter(user, "ar")

    const results = await screen.findByRole("list", { name: "Resultados" })
    expect(within(results).getByRole("button", { name: "Elegir Arroz blanco cocido" })).toBeInTheDocument()
    expect(
      within(results).getByRole("button", { name: "Añadir Arroz blanco cocido a favoritos", pressed: false })
    ).toBeInTheDocument()
    expect(
      within(results).getByRole("button", { name: "Quitar Banano de favoritos", pressed: true })
    ).toBeInTheDocument()
  })

  // SDD: 028 NFR-002 AC-N002.2
  it("«Buscando…» se anuncia en una región de estado", async () => {
    const user = userEvent.setup()
    searchMock.mockReturnValue(new Promise(() => {}))
    renderPanel()

    await typeAndEnter(user, "arroz")

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Buscando…"))
  })

  // SDD: 028 NFR-002 AC-N002.2
  it("«sin resultados» se anuncia en la región de estado", async () => {
    const user = userEvent.setup()
    renderPanel()

    await typeAndEnter(user, "gallo pinto")

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No encontramos alimentos para «gallo pinto».")
    )
  })

  // SDD: 028 NFR-002 AC-N002.2
  it("el error de la búsqueda se anuncia en la región de estado", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPanel()

    await typeAndEnter(user, "arroz")

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(SEARCH_FAILED))
  })

  // SDD: 028 NFR-002 AC-N002.2
  it("el error al cargar tus alimentos se anuncia en la región de estado", async () => {
    favoritesMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPanel()

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(LOAD_FAILED))
  })

  // SDD: 028 NFR-002 AC-N002.2
  it("el texto inicial también está en la región de estado", async () => {
    renderPanel()

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(INITIAL_TEXT))
  })
})
