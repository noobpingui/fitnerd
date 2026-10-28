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
  updateCustomFood,
} from "@/features/food-library/api"
import type { CustomLibraryFood, LibraryFood } from "@/features/food-library/types"
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
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}))

const updateMock = vi.mocked(updateCustomFood)
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
  updateMock.mockReset()
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

// «Favoritos» y «Recientes» arrancan plegadas: despliega la sección (si hace falta) y devuelve su lista.
async function openList(name: "Favoritos" | "Recientes", root: { findByRole: typeof screen.findByRole } = screen) {
  const toggle = await root.findByRole("button", { name: new RegExp(`^${name}`) })
  if (toggle.getAttribute("aria-expanded") === "false") await userEvent.setup().click(toggle)
  return root.findByRole("list", { name })
}

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
    await openList("Favoritos")

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

    const favorites = await openList("Favoritos")
    const recents = await openList("Recientes")

    expect(screen.getByText("Favoritos")).toBeInTheDocument()
    expect(screen.getByText("Recientes")).toBeInTheDocument()
    expect(within(favorites).getByText("Avena cocida")).toBeInTheDocument()
    expect(within(recents).getByText("Banano")).toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.1
  it("cada alimento de las listas muestra sus macros por 100 g y su botón «Elegir»", async () => {
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()

    const recents = await openList("Recientes")

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

    await openList("Recientes")

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
    await openList("Favoritos")

    await typeAndEnter(user, "arroz")
    await screen.findByRole("list", { name: "Resultados" })
    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Recientes" })).not.toBeInTheDocument()

    await user.clear(box())

    // «Favoritos» sigue desplegada; «Recientes» vuelve plegada como estaba.
    expect(await openList("Favoritos")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Recientes/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("list", { name: "Resultados" })).not.toBeInTheDocument()
  })

  it("«Favoritos» y «Recientes» arrancan plegadas, con su recuento, y no pintan sus alimentos", async () => {
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()

    const favoritesToggle = await screen.findByRole("button", { name: "Favoritos (1)" })
    const recentsToggle = screen.getByRole("button", { name: "Recientes (1)" })

    expect(favoritesToggle).toHaveAttribute("aria-expanded", "false")
    expect(recentsToggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Recientes" })).not.toBeInTheDocument()
  })

  it("«Crear alimento personalizado» y las acciones van bajo el campo, antes de «Favoritos» y «Recientes»", async () => {
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel({ actions: <button type="button">Cancelar</button> })

    const favoritesToggle = await screen.findByRole("button", { name: /^Favoritos/ })
    const create = screen.getByRole("button", { name: "Crear alimento personalizado" })
    const cancel = screen.getByRole("button", { name: "Cancelar" })
    const follows = (a: HTMLElement, b: HTMLElement) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(follows(box(), create)).toBe(true)
    expect(follows(create, cancel)).toBe(true)
    expect(follows(cancel, favoritesToggle)).toBe(true)
    expect(follows(cancel, screen.getByRole("button", { name: /^Recientes/ }))).toBe(true)
  })

  it("cada sección se despliega y se pliega por separado", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()

    await user.click(await screen.findByRole("button", { name: /^Favoritos/ }))

    expect(screen.getByRole("list", { name: "Favoritos" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Recientes" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^Favoritos/ }))

    expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Favoritos/ })).toHaveAttribute("aria-expanded", "false")
  })

  // SDD: 028 REQ-014 AC-014.3
  it("con un solo carácter escrito siguen viéndose las listas", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    renderPanel()
    await openList("Recientes")

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

    expect(await openList("Recientes")).toBeInTheDocument()
    expect(recentMock.mock.calls.length).toBeGreaterThan(recentCalls)
    expect(favoritesMock.mock.calls.length).toBeGreaterThan(favoriteCalls)
    expect(screen.queryByText(LOAD_FAILED)).not.toBeInTheDocument()
  })

  // SDD: 028 REQ-014 AC-014.5
  it("elegir en «Recientes» entrega los gramos de su último registro (150)", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(BANANA, 150)])
    const { onSelect } = renderPanel()
    const recents = await openList("Recientes")

    await user.click(within(recents).getByRole("button", { name: "Elegir Banano" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "catalog", id: "banano" }), "150")
  })

  // SDD: 028 REQ-014 AC-014.5
  it("los gramos de un reciente se escriben con coma decimal: 12,5", async () => {
    const user = userEvent.setup()
    recentMock.mockResolvedValue([makeRecentFood(GALLO, 12.5)])
    const { onSelect } = renderPanel()
    const recents = await openList("Recientes")

    await user.click(within(recents).getByRole("button", { name: "Elegir Gallo pinto" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "custom", id: 12 }), "12,5")
  })

  // SDD: 028 REQ-014 AC-014.5
  it("elegir en «Favoritos» entrega 100 g", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...OATS, favorite: true }])
    const { onSelect } = renderPanel()
    const favorites = await openList("Favoritos")

    await user.click(within(favorites).getByRole("button", { name: "Elegir Avena cocida" }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "avena-cocida" }), "100")
  })

  // SDD: 028 REQ-014 AC-014.5
  it("un alimento que está a la vez en favoritos y recientes entrega los gramos de la lista donde se pulsa", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([{ ...BANANA, favorite: true }])
    recentMock.mockResolvedValue([makeRecentFood({ ...BANANA, favorite: true }, 150)])
    const { onSelect } = renderPanel()
    const favorites = await openList("Favoritos")
    const recents = await openList("Recientes")

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

    const favorites = await openList("Favoritos")
    const recents = await openList("Recientes")

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
    const favorites = await openList("Favoritos")
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
    const recents = await openList("Recientes")

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
    const favorites = await openList("Favoritos")
    await openList("Recientes")

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
  // SDD: 028 NFR-002 AC-N002.4
  it("si el borrado falla muestra «No se pudo borrar el alimento.» y el alimento sigue en la lista", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    deleteMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPanel()
    await typeAndEnter(user, "gallo")
    await user.click(await screen.findByRole("button", { name: DELETE_LABEL }))
    const confirmation = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE })

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    // Iteración 2 (AC-N002.4): el borrado que falla cierra la confirmación; el aviso sale
    // dentro del elemento de «Gallo pinto» de «Resultados», que sigue en la lista.
    const results = screen.getByRole("list", { name: "Resultados" })
    const row = within(results).getByText("Gallo pinto").closest("li") as HTMLElement
    expect(await within(row).findByText(DELETE_FAILED)).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(results).toHaveTextContent("Gallo pinto")
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
    await openList("Recientes")

    expect(screen.queryByRole("button", { name: /^Borrar / })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Iteración 2: confirmación en línea, Escape y foco (REQ-017, NFR-002)
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - confirmación de borrado en línea", () => {
  beforeEach(resetMocks)

  const DELETE_LABEL = "Borrar Gallo pinto de tus alimentos"
  const FAVORITE_GALLO = { ...GALLO, favorite: true }

  // «Gallo pinto» a la vez en «Favoritos» y en «Recientes», con la caja vacía.
  async function renderWithBothLists() {
    favoritesMock.mockResolvedValue([FAVORITE_GALLO])
    recentMock.mockResolvedValue([makeRecentFood(FAVORITE_GALLO, 200)])
    const rendered = renderPanel()
    const recent = await openList("Recientes")
    const favorites = await openList("Favoritos")
    return { ...rendered, recent, favorites }
  }

  // Solo «Recientes», con un `onCustomFoodDeleted` espiado.
  async function renderWithDeletedCallback() {
    const onCustomFoodDeleted = vi.fn()
    recentMock.mockResolvedValue([makeRecentFood(FAVORITE_GALLO, 200)])
    favoritesMock.mockResolvedValue([])
    const rendered = renderPanel({ onCustomFoodDeleted })
    const recent = await openList("Recientes")
    return { ...rendered, recent, onCustomFoodDeleted }
  }

  function recentTrigger() {
    return within(screen.getByRole("list", { name: "Recientes" })).getByRole("button", {
      name: DELETE_LABEL,
    })
  }

  // SDD: 028 REQ-017 AC-017.5
  it("Escape cierra la confirmación sin pedir el borrado y conserva el texto y el alimento", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()
    await typeAndEnter(user, "gallo")
    const results = await screen.findByRole("list", { name: "Resultados" })
    await user.click(within(results).getByRole("button", { name: DELETE_LABEL }))
    // La confirmación está dentro del elemento del alimento, no en un diálogo aparte.
    const confirmation = await within(results).findByRole("alertdialog")
    expect(confirmation.closest("li")).toHaveTextContent("Gallo pinto")

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(deleteMock).not.toHaveBeenCalled()
    expect(box()).toHaveValue("gallo")
    expect(screen.getByRole("list", { name: "Resultados" })).toHaveTextContent("Gallo pinto")
  })

  // SDD: 028 REQ-017 AC-017.7
  it("«Borrar» de «Recientes» pinta la confirmación dentro del elemento de «Recientes», no en «Favoritos»", async () => {
    const user = userEvent.setup()
    const { recent, favorites } = await renderWithBothLists()

    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))

    const confirmation = await within(recent).findByRole("alertdialog")
    expect(confirmation.closest("li")).toBe(within(recent).getByText("Gallo pinto").closest("li"))
    expect(within(favorites).queryByRole("alertdialog")).not.toBeInTheDocument()
    // No es modal: las dos listas siguen accesibles por rol.
    expect(screen.getByRole("list", { name: "Favoritos" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Recientes" })).toBeInTheDocument()
  })

  // SDD: 028 NFR-002 AC-N002.3
  it("al abrir la confirmación el foco está en «Cancelar»", async () => {
    const user = userEvent.setup()
    const { recent } = await renderWithBothLists()

    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))

    const confirmation = await within(recent).findByRole("alertdialog")
    await waitFor(() =>
      expect(within(confirmation).getByRole("button", { name: "Cancelar" })).toHaveFocus()
    )
  })

  // SDD: 028 NFR-002 AC-N002.4
  it("«Cancelar» devuelve el foco a «Borrar Gallo pinto de tus alimentos» de «Recientes»", async () => {
    const user = userEvent.setup()
    const { recent } = await renderWithBothLists()
    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(recent).findByRole("alertdialog")

    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(recentTrigger()).toHaveFocus())
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: 028 NFR-002 AC-N002.4
  it("Escape devuelve el foco a «Borrar Gallo pinto de tus alimentos» de «Recientes»", async () => {
    const user = userEvent.setup()
    const { recent } = await renderWithBothLists()
    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    await within(recent).findByRole("alertdialog")

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(recentTrigger()).toHaveFocus())
  })

  // SDD: 028 NFR-002 AC-N002.4
  // SDD: 028 REQ-017 AC-017.3
  it("un borrado que falla cierra la confirmación, deja el aviso en «Recientes» y devuelve el foco al botón", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValue(new ApiError(500, "boom"))
    const { recent, favorites } = await renderWithBothLists()
    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(recent).findByRole("alertdialog")

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    expect(await within(recent).findByText(DELETE_FAILED)).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(within(favorites).queryByText(DELETE_FAILED)).not.toBeInTheDocument()
    await waitFor(() => expect(recentTrigger()).toHaveFocus())
  })

  // SDD: 028 NFR-002 AC-N002.5
  it("tras un borrado correcto «Gallo pinto» desaparece y el foco pasa a la caja «Buscar alimento»", async () => {
    const user = userEvent.setup()
    let deleted = false
    searchMock.mockImplementation(async () => (deleted ? [] : [GALLO]))
    deleteMock.mockImplementation(async () => {
      deleted = true
    })
    renderPanel()
    await typeAndEnter(user, "gallo")
    const results = await screen.findByRole("list", { name: "Resultados" })
    await user.click(within(results).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(results).findByRole("alertdialog")

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(screen.queryByText("Gallo pinto")).not.toBeInTheDocument())
    await waitFor(() => expect(box()).toHaveFocus())
  })

  // SDD: 028 REQ-018 AC-018.7
  it("avisa con el id borrado tras un 204", async () => {
    const user = userEvent.setup()
    const { recent, onCustomFoodDeleted } = await renderWithDeletedCallback()
    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(recent).findByRole("alertdialog")
    expect(onCustomFoodDeleted).not.toHaveBeenCalled()

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(onCustomFoodDeleted).toHaveBeenCalledTimes(1))
    expect(onCustomFoodDeleted).toHaveBeenCalledWith(12)
  })

  // SDD: 028 REQ-018 AC-018.7
  it("avisa con el id borrado también tras un 404, que cuenta como éxito", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValue(new ApiError(404, "No encontramos ese alimento."))
    const { recent, onCustomFoodDeleted } = await renderWithDeletedCallback()
    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(recent).findByRole("alertdialog")

    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(onCustomFoodDeleted).toHaveBeenCalledTimes(1))
    expect(onCustomFoodDeleted).toHaveBeenCalledWith(12)
  })

  // SDD: 028 REQ-018 AC-018.7
  it("no avisa tras un borrado que falla, pero sí cuando un segundo intento sale bien", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    const { recent, onCustomFoodDeleted } = await renderWithDeletedCallback()
    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    const first = await within(recent).findByRole("alertdialog")
    await user.click(within(first).getByRole("button", { name: "Borrar" }))
    expect(await within(recent).findByText(DELETE_FAILED)).toBeInTheDocument()
    expect(onCustomFoodDeleted).not.toHaveBeenCalled()

    await user.click(within(recent).getByRole("button", { name: DELETE_LABEL }))
    const second = await within(recent).findByRole("alertdialog")
    await user.click(within(second).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(onCustomFoodDeleted).toHaveBeenCalledTimes(1))
    expect(onCustomFoodDeleted).toHaveBeenCalledWith(12)
  })
})

// ---------------------------------------------------------------------------
// Iteración 3 (F9): la confirmación pertenece a la vista en la que se abrió
// ---------------------------------------------------------------------------

describe("FoodSearchPanel - confirmación de borrado y cambio de vista", () => {
  beforeEach(resetMocks)

  const DELETE_LABEL = "Borrar Gallo pinto de tus alimentos"
  const FAVORITE_GALLO = { ...GALLO, favorite: true }

  async function renderFavorites() {
    favoritesMock.mockResolvedValue([FAVORITE_GALLO])
    const rendered = renderPanel()
    const favorites = await openList("Favoritos")
    return { ...rendered, favorites }
  }

  // Rojo hoy: la confirmación reaparece al volver «Favoritos» y roba el foco hacia «Cancelar».
  // SDD: 028 REQ-017 AC-017.7 NFR-002 AC-N002.3
  it("si se escribe con la confirmación abierta en «Favoritos» y se vacía la caja, «Favoritos» vuelve sin confirmación y el foco sigue en «Buscar alimento»", async () => {
    const user = userEvent.setup()
    const { favorites } = await renderFavorites()
    await user.click(within(favorites).getByRole("button", { name: DELETE_LABEL }))
    await within(favorites).findByRole("alertdialog")

    await user.type(box(), "ar")
    await user.clear(box())

    const back = await openList("Favoritos")
    expect(within(back).getByText("Gallo pinto")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(box()).toHaveFocus()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // Rojo hoy: al volver «Gallo pinto» a «Resultados» la confirmación reaparece.
  // SDD: 028 REQ-017 AC-017.7 NFR-002 AC-N002.3
  it("si cambia la consulta con la confirmación abierta en «Resultados» y «Gallo pinto» vuelve, sale sin confirmación", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()
    await typeAndEnter(user, "gallo")
    const results = await screen.findByRole("list", { name: "Resultados" })
    await user.click(within(results).getByRole("button", { name: DELETE_LABEL }))
    await within(results).findByRole("alertdialog")

    await user.type(box(), " p")
    await user.keyboard("{Backspace}{Backspace}")

    const back = await screen.findByRole("list", { name: "Resultados" })
    expect(within(back).getByText("Gallo pinto")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(box()).toHaveFocus()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // Rojo hoy: el aviso se repinta al volver a mostrarse «Favoritos».
  // SDD: 028 REQ-017 AC-017.3 AC-017.7
  it("el aviso «No se pudo borrar el alimento.» no reaparece tras ocultar y volver a mostrar la lista", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValue(new ApiError(500, "boom"))
    const { favorites } = await renderFavorites()
    await user.click(within(favorites).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(favorites).findByRole("alertdialog")
    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))
    const row = within(favorites).getByText("Gallo pinto").closest("li") as HTMLElement
    expect(await within(row).findByText(DELETE_FAILED)).toBeInTheDocument()

    await user.type(box(), "ar")
    await user.clear(box())

    const back = await openList("Favoritos")
    expect(within(back).getByText("Gallo pinto")).toBeInTheDocument()
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
  })

  // Rojo hoy: al volver el alimento a «Favoritos» reaparece la confirmación con el foco en «Cancelar».
  // SDD: 028 REQ-017 AC-017.7 NFR-002 AC-N002.3
  it("si el alimento sale de «Favoritos» con la confirmación abierta y vuelve, sale sin confirmación ni foco en «Cancelar»", async () => {
    const user = userEvent.setup()
    let favorited = true
    favoritesMock.mockImplementation(async () => (favorited ? [FAVORITE_GALLO] : []))
    recentMock.mockImplementation(async () => [
      makeRecentFood({ ...GALLO, favorite: favorited }, 200),
    ])
    setFavoriteMock.mockImplementation(async (_food, favorite) => {
      favorited = favorite
    })
    renderPanel()
    const favorites = await openList("Favoritos")
    const recent = await openList("Recientes")
    await user.click(within(favorites).getByRole("button", { name: DELETE_LABEL }))
    await within(favorites).findByRole("alertdialog")

    await user.click(
      within(favorites).getByRole("button", { name: "Quitar Gallo pinto de favoritos" })
    )
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Favoritos" })).not.toBeInTheDocument()
    )
    await user.click(
      within(recent).getByRole("button", { name: "Añadir Gallo pinto a favoritos" })
    )

    const back = await openList("Favoritos")
    expect(within(back).getByText("Gallo pinto")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // Rojo hoy: el fallo devuelve el foco al botón «Borrar» aunque el usuario esté escribiendo.
  // SDD: 028 REQ-017 AC-017.3 NFR-002 AC-N002.4
  it("si se escribe mientras el borrado está en curso y falla, el foco sigue en la caja y el aviso se ve hasta que cambia la vista", async () => {
    const user = userEvent.setup()
    const pending = deferred<void>()
    deleteMock.mockReturnValue(pending.promise)
    const { favorites } = await renderFavorites()
    await user.click(within(favorites).getByRole("button", { name: DELETE_LABEL }))
    const confirmation = await within(favorites).findByRole("alertdialog")
    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    await user.type(box(), "a")

    await act(async () => {
      pending.reject(new ApiError(500, "boom"))
    })

    const row = within(screen.getByRole("list", { name: "Favoritos" }))
      .getByText("Gallo pinto")
      .closest("li") as HTMLElement
    expect(await within(row).findByText(DELETE_FAILED)).toBeInTheDocument()
    expect(box()).toHaveFocus()

    await user.type(box(), "r")
    await user.clear(box())

    const back = await openList("Favoritos")
    expect(within(back).getByText("Gallo pinto")).toBeInTheDocument()
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
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

    const favorites = await openList("Favoritos")
    const recents = await openList("Recientes")
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

// ---------------------------------------------------------------------------
// Spec 029: editar un alimento propio
// ---------------------------------------------------------------------------

const FAV_GALLO: CustomLibraryFood = { ...GALLO, favorite: true }
const AVENA_CASERA = makeCustomLibraryFood({ id: 13, name: "Avena casera", favorite: true })
const EDIT_LABEL = "Editar Gallo pinto"
const FORM_NAME = "Editar «Gallo pinto»"
const NAME_TAKEN = "Ya tienes un alimento con ese nombre."
const SAVE_FAILED = "No se pudo guardar el alimento."
const NOT_FOUND = "No encontramos ese alimento."

// Biblioteca en memoria: favoritos y recientes por nombre, búsqueda por texto y
// edición que cambia el alimento y lo devuelve (como el servidor).
function libraryBackend(initial: CustomLibraryFood[]) {
  let foods = [...initial]
  const byName = () => [...foods].sort((a, b) => a.name.localeCompare(b.name, "es"))
  favoritesMock.mockImplementation(async () => byName().filter((food) => food.favorite))
  recentMock.mockImplementation(async () => foods.map((food) => makeRecentFood(food, 200)))
  searchMock.mockImplementation(async (query) =>
    byName().filter((food) => food.name.toLowerCase().includes(query.toLowerCase()))
  )
  updateMock.mockImplementation(async (id, payload) => {
    const edited: CustomLibraryFood = {
      ...(foods.find((food) => food.id === id) as CustomLibraryFood),
      name: payload.name,
      per_100g: payload.per_100g,
    }
    foods = foods.map((food) => (food.id === id ? edited : food))
    return edited
  })
}

function nameInput(scope: { getByRole: typeof screen.getByRole } = screen) {
  return scope.getByRole("textbox", { name: "Nombre" })
}

async function changeText(user: User, field: HTMLElement, text: string) {
  await user.clear(field)
  await user.type(field, text)
}

function buttonLabels(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "")
}

describe("FoodSearchPanel - botón «Editar»", () => {
  beforeEach(resetMocks)

  // SDD: 029 REQ-006 AC-006.1
  it("en «Favoritos» el propio lleva «Elegir», la estrella, «Editar» y «Borrar», en ese orden, y el del catálogo no tiene «Editar»", async () => {
    favoritesMock.mockResolvedValue([{ ...BANANA, favorite: true }, FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")

    const own = within(favorites).getByText("Gallo pinto").closest("li") as HTMLElement
    const catalog = within(favorites).getByText("Banano").closest("li") as HTMLElement

    expect(buttonLabels(own)).toEqual([
      "Elegir Gallo pinto",
      "Quitar Gallo pinto de favoritos",
      "Editar Gallo pinto",
      "Borrar Gallo pinto de tus alimentos",
    ])
    expect(within(catalog).queryByRole("button", { name: /^Editar/ })).not.toBeInTheDocument()
  })

  // SDD: 029 REQ-006 AC-006.2
  it("también está en «Recientes»", async () => {
    recentMock.mockResolvedValue([makeRecentFood(GALLO, 200)])
    renderPanel()
    const recent = await openList("Recientes")

    expect(within(recent).getByRole("button", { name: EDIT_LABEL })).toBeInTheDocument()
  })

  // SDD: 029 REQ-006 AC-006.2
  it("también está en los resultados de buscar «gallo»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()

    await typeAndEnter(user, "gallo")

    const results = await screen.findByRole("list", { name: "Resultados" })
    expect(within(results).getByRole("button", { name: EDIT_LABEL })).toBeInTheDocument()
  })

  // SDD: 029 REQ-006 AC-006.1
  it("un resultado del catálogo no tiene «Editar»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([RICE, GALLO])
    renderPanel()

    await typeAndEnter(user, "ar")

    const results = await screen.findByRole("list", { name: "Resultados" })
    const catalog = within(results).getByText("Arroz blanco cocido").closest("li") as HTMLElement
    expect(within(results).getAllByRole("button", { name: /^Editar/ })).toHaveLength(1)
    expect(within(catalog).queryByRole("button", { name: /^Editar/ })).not.toBeInTheDocument()
  })

  // SDD: 029 REQ-006 AC-006.1
  it("pulsar «Editar» no elige el alimento", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([FAV_GALLO])
    const { onSelect } = renderPanel()
    const favorites = await openList("Favoritos")

    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))

    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe("FoodSearchPanel - formulario de edición en línea", () => {
  beforeEach(resetMocks)

  // SDD: 029 REQ-007 AC-007.1
  it("«Editar Gallo pinto» abre el formulario dentro del elemento de «Favoritos», con los valores actuales, y la lista sigue visible", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")

    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))

    const form = await within(favorites).findByRole("form", { name: FORM_NAME })
    expect(form.closest("li")).toBe(within(favorites).getByText("Gallo pinto", { selector: "p" }).closest("li"))
    expect(nameInput(within(form))).toHaveValue("Gallo pinto")
    expect(within(form).getByRole("textbox", { name: "Calorías por 100 g (kcal)" })).toHaveValue("180")
    expect(within(form).getByRole("textbox", { name: "Proteína por 100 g (g)" })).toHaveValue("6")
    expect(within(form).getByRole("textbox", { name: "Carbohidratos por 100 g (g)" })).toHaveValue("30")
    expect(within(form).getByRole("textbox", { name: "Grasa por 100 g (g)" })).toHaveValue("4")
    expect(within(form).getByRole("button", { name: "Guardar" })).toBeInTheDocument()
    expect(within(form).getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Favoritos" })).toBeInTheDocument()
    expect(box()).toBeInTheDocument()
  })

  // SDD: 029 REQ-007 AC-007.7
  it("«Editar» de «Recientes» pinta el formulario en «Recientes» y no en «Favoritos»", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([FAV_GALLO])
    recentMock.mockResolvedValue([makeRecentFood(FAV_GALLO, 200)])
    renderPanel()
    const recent = await openList("Recientes")
    const favorites = await openList("Favoritos")

    await user.click(within(recent).getByRole("button", { name: EDIT_LABEL }))

    expect(await within(recent).findByRole("form", { name: FORM_NAME })).toBeInTheDocument()
    expect(within(favorites).queryByRole("form")).not.toBeInTheDocument()
  })

  // SDD: 029 REQ-007 AC-007.1
  it("en los resultados de la búsqueda el formulario sale en «Resultados»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderPanel()
    await typeAndEnter(user, "gallo")
    const results = await screen.findByRole("list", { name: "Resultados" })

    await user.click(within(results).getByRole("button", { name: EDIT_LABEL }))

    expect(await within(results).findByRole("form", { name: FORM_NAME })).toBeInTheDocument()
  })

  // SDD: 029 REQ-007 AC-007.2
  it("«Cancelar» cierra el formulario sin ninguna petición y al reabrirlo muestra los valores actuales", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(favorites).findByRole("form", { name: FORM_NAME })
    await changeText(user, nameInput(within(form)), "Otro nombre")

    await user.click(within(form).getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    expect(updateMock).not.toHaveBeenCalled()
    expect(within(favorites).getByText("Gallo pinto", { selector: "p" })).toBeInTheDocument()
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    const reopened = await within(favorites).findByRole("form", { name: FORM_NAME })
    expect(nameInput(within(reopened))).toHaveValue("Gallo pinto")
  })

  // SDD: 029 REQ-007 AC-007.6
  it("abrir «Borrar» en otro alimento cierra el formulario sin guardar, y «Editar» cierra la confirmación sin borrar", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([AVENA_CASERA, FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    await within(favorites).findByRole("form", { name: FORM_NAME })

    await user.click(
      within(favorites).getByRole("button", { name: "Borrar Avena casera de tus alimentos" })
    )

    expect(
      await within(favorites).findByRole("alertdialog", {
        name: "¿Borrar «Avena casera» de tus alimentos?",
      })
    ).toBeInTheDocument()
    expect(screen.queryByRole("form")).not.toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()

    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))

    expect(await within(favorites).findByRole("form", { name: FORM_NAME })).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.6
  it("solo hay un formulario o una confirmación abiertos: editar otro alimento cierra el primero", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([AVENA_CASERA, FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    await within(favorites).findByRole("form", { name: FORM_NAME })

    await user.click(within(favorites).getByRole("button", { name: "Editar Avena casera" }))

    expect(await within(favorites).findByRole("form", { name: "Editar «Avena casera»" })).toBeInTheDocument()
    expect(screen.getAllByRole("form")).toHaveLength(1)
  })

  // SDD: 029 REQ-007 AC-007.8
  it("escribir en la caja de búsqueda cierra el formulario sin petición", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    await within(favorites).findByRole("form", { name: FORM_NAME })

    await user.type(box(), "a")

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    expect(updateMock).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.8
  it("plegar «Favoritos» cierra el formulario y al desplegar de nuevo no vuelve", async () => {
    const user = userEvent.setup()
    favoritesMock.mockResolvedValue([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    await within(favorites).findByRole("form", { name: FORM_NAME })

    await user.click(screen.getByRole("button", { name: /^Favoritos/ }))

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /^Favoritos/ }))
    await screen.findByRole("list", { name: "Favoritos" })
    expect(screen.queryByRole("form")).not.toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe("FoodSearchPanel - guardar la edición", () => {
  beforeEach(resetMocks)

  // Abre el formulario de «Gallo pinto» en la lista indicada, con la biblioteca simulada.
  async function openEditor(
    user: User,
    list: "Favoritos" | "Recientes" = "Favoritos",
    props: Partial<ComponentProps<typeof FoodSearchPanel>> = {},
    foods: CustomLibraryFood[] = [FAV_GALLO]
  ) {
    libraryBackend(foods)
    const rendered = renderPanel(props)
    const section = await openList(list)
    await user.click(within(section).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(section).findByRole("form", { name: FORM_NAME })
    return { ...rendered, section, form }
  }

  async function fillAndEnable(user: User, form: HTMLElement) {
    await changeText(user, nameInput(within(form)), " Gallo pinto con huevo ")
    await changeText(
      user,
      within(form).getByRole("textbox", { name: "Calorías por 100 g (kcal)" }),
      "200"
    )
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())
  }

  // SDD: 029 REQ-010 AC-010.1
  // SDD: 029 REQ-010 AC-010.2
  it("«Guardar» envía el id y el cuerpo, muestra «Guardando…» y después las listas con el nombre y los valores nuevos", async () => {
    const user = userEvent.setup()
    const { form, section } = await openEditor(user, "Favoritos")
    const real = updateMock.getMockImplementation() as NonNullable<ReturnType<typeof updateMock.getMockImplementation>>
    const pending = deferred<CustomLibraryFood>()
    updateMock.mockImplementation((id, payload) => pending.promise.then(() => real(id, payload)))
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith(12, {
      name: "Gallo pinto con huevo",
      per_100g: { calories_kcal: 200, protein_g: 6, carbs_g: 30, fat_g: 4 },
    })
    expect(within(form).getByRole("button", { name: "Guardando…" })).toBeDisabled()
    expect(within(form).getByRole("button", { name: "Cancelar" })).toBeDisabled()

    await act(async () => {
      pending.resolve({} as CustomLibraryFood)
    })

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    const row = within(section).getByText("Gallo pinto con huevo").closest("li") as HTMLElement
    expect(row).toHaveTextContent(/200 kcal/)
    expect(within(section).queryByText("Gallo pinto", { selector: "p" })).not.toBeInTheDocument()
  })

  // SDD: 029 REQ-010 AC-010.2
  it("«Recientes» también muestra el nombre y los valores nuevos", async () => {
    const user = userEvent.setup()
    const { form } = await openEditor(user, "Favoritos")
    const recent = await openList("Recientes")
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(within(recent).getByText("Gallo pinto con huevo")).toBeInTheDocument())
    expect(within(recent).getByText("Gallo pinto con huevo").closest("li")).toHaveTextContent(/200 kcal/)
    expect(within(recent).queryByText("Gallo pinto", { selector: "p" })).not.toBeInTheDocument()
  })

  // SDD: 029 REQ-010 AC-010.7
  it("renombrar «Gallo pinto» a «Arepa» lo pone antes de «Avena casera» en «Favoritos»", async () => {
    const user = userEvent.setup()
    const { form, section } = await openEditor(user, "Favoritos", {}, [AVENA_CASERA, FAV_GALLO])
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => within(item).getByText(/Gallo pinto|Avena casera/, { selector: "p" }).textContent)
    ).toEqual(["Avena casera", "Gallo pinto"])
    await changeText(user, nameInput(within(form)), "Arepa")
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    const names = within(section)
      .getAllByRole("listitem")
      .map((item) => within(item).getByText(/Arepa|Avena casera/, { selector: "p" }).textContent)
    expect(names).toEqual(["Arepa", "Avena casera"])
  })

  // SDD: 029 REQ-010 AC-010.1
  it("`onCustomFoodEdited` recibe el alimento devuelto por el servidor", async () => {
    const user = userEvent.setup()
    const onCustomFoodEdited = vi.fn()
    // La prop `onCustomFoodEdited` aún no existe en el tipo del panel (la añade la tarea T-069).
    const { form } = await openEditor(
      user,
      "Favoritos",
      { onCustomFoodEdited } as unknown as Partial<ComponentProps<typeof FoodSearchPanel>>
    )
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(onCustomFoodEdited).toHaveBeenCalledTimes(1))
    expect(onCustomFoodEdited).toHaveBeenCalledWith({
      ...FAV_GALLO,
      name: "Gallo pinto con huevo",
      per_100g: { calories_kcal: 200, protein_g: 6, carbs_g: 30, fat_g: 4 },
    })
  })

  // SDD: 029 REQ-010 AC-010.3
  it("un 409 deja el formulario con lo escrito, avisa «Ya tienes un alimento con ese nombre.» y deshabilita «Guardar» hasta cambiar el nombre", async () => {
    const user = userEvent.setup()
    const { form } = await openEditor(user, "Favoritos")
    updateMock.mockRejectedValue(new ApiError(409, NAME_TAKEN))
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(within(form).getByRole("status")).toHaveTextContent(NAME_TAKEN))
    expect(screen.getByRole("form", { name: FORM_NAME })).toBeInTheDocument()
    expect(nameInput(within(form))).toHaveValue(" Gallo pinto con huevo ")
    expect(within(form).getByRole("textbox", { name: "Calorías por 100 g (kcal)" })).toHaveValue("200")
    expect(within(form).getByRole("button", { name: "Guardar" })).toBeDisabled()

    await changeText(user, nameInput(within(form)), "Gallo pinto con queso")

    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())
    expect(within(form).getByRole("status")).toHaveTextContent("")
  })

  // SDD: 029 REQ-010 AC-010.4
  it("un 404 cierra el formulario, muestra «No encontramos ese alimento.» y vuelve a pedir favoritos y recientes", async () => {
    const user = userEvent.setup()
    const { form, section } = await openEditor(user, "Favoritos")
    updateMock.mockRejectedValue(new ApiError(404, "No encontramos ese alimento."))
    await fillAndEnable(user, form)
    const favoriteCalls = favoritesMock.mock.calls.length
    const recentCalls = recentMock.mock.calls.length

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument()
    expect(screen.queryByRole("form")).not.toBeInTheDocument()
    await waitFor(() => expect(favoritesMock.mock.calls.length).toBeGreaterThan(favoriteCalls))
    await waitFor(() => expect(recentMock.mock.calls.length).toBeGreaterThan(recentCalls))
    expect(section).toBeInTheDocument()
  })

  // SDD: 029 REQ-010 AC-010.5
  it("un 500 muestra «No se pudo guardar el alimento.», conserva lo escrito y deja «Guardar» habilitado", async () => {
    const user = userEvent.setup()
    const { form } = await openEditor(user, "Favoritos")
    updateMock.mockRejectedValue(new ApiError(500, "boom"))
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    expect(await within(form).findByText(SAVE_FAILED)).toBeInTheDocument()
    expect(nameInput(within(form))).toHaveValue(" Gallo pinto con huevo ")
    expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled()
  })

  // SDD: 029 REQ-010 AC-010.5
  it("un error de red muestra el mismo mensaje", async () => {
    const user = userEvent.setup()
    const { form } = await openEditor(user, "Favoritos")
    updateMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    expect(await within(form).findByText(SAVE_FAILED)).toBeInTheDocument()
    expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled()
  })

  // SDD: 029 REQ-010 AC-010.5
  it("un 400 muestra el mensaje del servidor y conserva lo escrito", async () => {
    const user = userEvent.setup()
    const { form } = await openEditor(user, "Favoritos")
    updateMock.mockRejectedValue(new ApiError(400, "Las calorías por 100 g deben estar entre 0 y 900."))
    await fillAndEnable(user, form)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    expect(
      await within(form).findByText("Las calorías por 100 g deben estar entre 0 y 900.")
    ).toBeInTheDocument()
    expect(nameInput(within(form))).toHaveValue(" Gallo pinto con huevo ")
  })

  // SDD: 029 REQ-010 AC-010.6
  it("con «Guardando…» en curso, pulsar «Guardar» otra vez o Intro no envía otra petición", async () => {
    const user = userEvent.setup()
    const { form } = await openEditor(user, "Favoritos")
    const pending = deferred<CustomLibraryFood>()
    updateMock.mockReturnValue(pending.promise)
    await fillAndEnable(user, form)
    await user.click(within(form).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))

    await user.click(within(form).getByRole("button", { name: "Guardando…" }))
    await user.type(nameInput(within(form)), "{Enter}")

    expect(updateMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve({ ...FAV_GALLO, name: "Gallo pinto con huevo" })
    })
  })
})

describe("FoodSearchPanel - foco al editar", () => {
  beforeEach(resetMocks)

  // SDD: 029 NFR-001 AC-N001.1
  it("al abrir el formulario el foco está en «Nombre»", async () => {
    const user = userEvent.setup()
    libraryBackend([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")

    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))

    const form = await within(favorites).findByRole("form", { name: FORM_NAME })
    await waitFor(() => expect(nameInput(within(form))).toHaveFocus())
  })

  // SDD: 029 NFR-001 AC-N001.2
  it("«Cancelar» devuelve el foco a «Editar Gallo pinto» de «Recientes»", async () => {
    const user = userEvent.setup()
    libraryBackend([FAV_GALLO])
    renderPanel()
    const recent = await openList("Recientes")
    await user.click(within(recent).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(recent).findByRole("form", { name: FORM_NAME })

    await user.click(within(form).getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    await waitFor(() =>
      expect(within(recent).getByRole("button", { name: EDIT_LABEL })).toHaveFocus()
    )
  })

  // SDD: 029 NFR-001 AC-N001.2
  it("Escape devuelve el foco a «Editar Gallo pinto» de «Recientes» y conserva la caja", async () => {
    const user = userEvent.setup()
    libraryBackend([FAV_GALLO])
    renderPanel()
    const recent = await openList("Recientes")
    await user.click(within(recent).getByRole("button", { name: EDIT_LABEL }))
    await within(recent).findByRole("form", { name: FORM_NAME })

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    await waitFor(() =>
      expect(within(recent).getByRole("button", { name: EDIT_LABEL })).toHaveFocus()
    )
    expect(updateMock).not.toHaveBeenCalled()
  })

  // SDD: 029 NFR-001 AC-N001.3
  it("tras guardar en «Favoritos» el foco está en «Editar Gallo pinto con huevo» de «Favoritos»", async () => {
    const user = userEvent.setup()
    libraryBackend([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(favorites).findByRole("form", { name: FORM_NAME })
    await changeText(user, nameInput(within(form)), "Gallo pinto con huevo")
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Favoritos" })).getByRole("button", {
          name: "Editar Gallo pinto con huevo",
        })
      ).toHaveFocus()
    )
  })

  // SDD: 029 NFR-001 AC-N001.4
  it("si el alimento ya no sale en «Resultados» tras guardar, el foco pasa a la caja «Buscar alimento»", async () => {
    const user = userEvent.setup()
    libraryBackend([GALLO])
    renderPanel()
    await typeAndEnter(user, "gallo")
    const results = await screen.findByRole("list", { name: "Resultados" })
    await user.click(within(results).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(results).findByRole("form", { name: FORM_NAME })
    await changeText(user, nameInput(within(form)), "Pinto")
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    await waitFor(() => expect(box()).toHaveFocus())
    expect(box()).toHaveValue("gallo")
  })

  // SDD: 029 NFR-001 AC-N001.1
  it("tras un fallo al guardar el foco vuelve al campo «Nombre», no al cuerpo de la página", async () => {
    const user = userEvent.setup()
    libraryBackend([FAV_GALLO])
    renderPanel()
    const favorites = await openList("Favoritos")
    await user.click(within(favorites).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(favorites).findByRole("form", { name: FORM_NAME })
    await changeText(user, nameInput(within(form)), "Gallo pinto con huevo")
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())
    updateMock.mockRejectedValue(new ApiError(500, "boom"))

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    expect(await within(form).findByText(SAVE_FAILED)).toBeInTheDocument()
    await waitFor(() => expect(nameInput(within(form))).toHaveFocus())
  })
})

describe("FoodSearchPanel - aviso al borrar un propio que ya no existe al editar (F2)", () => {
  beforeEach(resetMocks)

  async function editAndSave(onCustomFoodDeleted: () => void, onCustomFoodEdited = vi.fn()) {
    const user = userEvent.setup()
    libraryBackend([FAV_GALLO])
    renderPanel({ onCustomFoodDeleted, onCustomFoodEdited })
    const section = await openList("Favoritos")
    await user.click(within(section).getByRole("button", { name: EDIT_LABEL }))
    const form = await within(section).findByRole("form", { name: FORM_NAME })
    await changeText(user, nameInput(within(form)), "Gallo pinto con huevo")
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeEnabled())
    return { user, form, onCustomFoodEdited }
  }

  // SDD: 029 REQ-010 AC-010.4
  it("un 404 al editar llama una vez a `onCustomFoodDeleted` con el id 12", async () => {
    const onCustomFoodDeleted = vi.fn()
    const { user, form } = await editAndSave(onCustomFoodDeleted)
    updateMock.mockRejectedValue(new ApiError(404, NOT_FOUND))

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(onCustomFoodDeleted).toHaveBeenCalledTimes(1))
    expect(onCustomFoodDeleted).toHaveBeenCalledWith(12)
  })

  // SDD: 029 REQ-010 AC-010.4
  it.each([
    ["409", new ApiError(409, NAME_TAKEN)],
    ["400", new ApiError(400, "Las calorías por 100 g deben estar entre 0 y 900.")],
    ["500", new ApiError(500, "boom")],
  ])("un %s al editar no llama a `onCustomFoodDeleted`", async (_label, error) => {
    const onCustomFoodDeleted = vi.fn()
    const { user, form } = await editAndSave(onCustomFoodDeleted)
    updateMock.mockRejectedValue(error)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(within(form).getByRole("button", { name: "Guardar" })).toBeInTheDocument())
    expect(onCustomFoodDeleted).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-010 AC-010.4
  it("un 200 solo llama a `onCustomFoodEdited`, no a `onCustomFoodDeleted`", async () => {
    const onCustomFoodDeleted = vi.fn()
    const { user, form, onCustomFoodEdited } = await editAndSave(onCustomFoodDeleted)

    await user.click(within(form).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(onCustomFoodEdited).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument())
    expect(onCustomFoodDeleted).not.toHaveBeenCalled()
  })
})
