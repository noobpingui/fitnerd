// Test de PÁGINA de «Alimentos» (spec 021). La red se simula en api.ts.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { searchFoods } from "@/features/foods/api"
import type { Food, FoodSearchResponse } from "@/features/foods/types"
import { FoodsPage } from "./FoodsPage"

vi.mock("@/features/foods/api", () => ({
  searchFoods: vi.fn(),
}))

const searchMock = vi.mocked(searchFoods)

const ATTRIBUTION =
  "Datos: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central."
const RATE_LIMIT_MESSAGE =
  "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."
const UNAVAILABLE_MESSAGE =
  "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."

const CHICKEN: Food = {
  fdc_id: 171477,
  description: "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
  data_type: "sr_legacy",
  per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
}
const RICE: Food = {
  fdc_id: 168878,
  description: "Rice, white, long-grain, regular, raw",
  data_type: "foundation",
  per_100g: { calories_kcal: 130, protein_g: 2.7, carbs_g: null, fat_g: 0.3 },
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <FoodsPage />
    </QueryClientProvider>
  )
}

function searchBox() {
  return screen.getByRole("searchbox", { name: "Buscar alimento" })
}

function searchButton() {
  return screen.getByRole("button", { name: "Buscar" })
}

type User = ReturnType<typeof userEvent.setup>

async function typeAndSearch(user: User, text: string) {
  await user.type(searchBox(), text)
  await user.click(searchButton())
}

describe("FoodsPage", () => {
  beforeEach(() => {
    searchMock.mockReset()
  })

  // SDD: 021 REQ-012 AC-012.1
  it("recién abierta muestra la caja, el botón y el texto inicial", () => {
    renderPage()

    expect(screen.getByRole("heading", { level: 1, name: "Alimentos" })).toBeInTheDocument()
    expect(searchBox()).toBeInTheDocument()
    expect(searchBox()).toHaveAttribute("placeholder", "Ej.: chicken breast, arroz blanco")
    expect(searchButton()).toBeInTheDocument()
    expect(
      screen.getByText("Busca un alimento para ver sus calorías y macros por 100 g.")
    ).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 021 REQ-012 AC-012.2
  it("muestra cada alimento con su descripción, su origen y sus valores por 100 g", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [CHICKEN, RICE] })
    renderPage()

    await typeAndSearch(user, "chicken")

    const items = await screen.findAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(searchMock).toHaveBeenCalledWith("chicken")
    const first = within(items[0])
    expect(first.getByText(CHICKEN.description)).toBeInTheDocument()
    expect(first.getByText("SR Legacy")).toBeInTheDocument()
    expect(first.getByText("165 kcal")).toBeInTheDocument()
    expect(first.getByText("31,0 g proteína")).toBeInTheDocument()
    expect(first.getByText("0,0 g carbohidratos")).toBeInTheDocument()
    expect(first.getByText("3,6 g grasa")).toBeInTheDocument()
    const second = within(items[1])
    expect(second.getByText(RICE.description)).toBeInTheDocument()
    expect(second.getByText("Foundation")).toBeInTheDocument()
  })

  // SDD: 021 REQ-012 AC-012.3
  it("muestra «—» en lugar de un valor sin dato", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [RICE] })
    renderPage()

    await typeAndSearch(user, "rice")

    const item = within(await screen.findByRole("listitem"))
    expect(item.getByText("— carbohidratos")).toBeInTheDocument()
    expect(item.getByText("2,7 g proteína")).toBeInTheDocument()
  })

  // SDD: 021 REQ-012 AC-012.4
  it("la tecla Intro lanza la misma búsqueda que el botón", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [CHICKEN] })
    renderPage()

    await user.type(searchBox(), "chicken{Enter}")

    expect(await screen.findByText(CHICKEN.description)).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock).toHaveBeenCalledWith("chicken")
  })

  // SDD: 021 REQ-012 AC-012.5
  it("mientras la búsqueda está en curso muestra «Buscando…» y desactiva el botón", async () => {
    const user = userEvent.setup()
    let resolveSearch: (value: FoodSearchResponse) => void = () => {}
    searchMock.mockReturnValue(
      new Promise<FoodSearchResponse>((resolve) => {
        resolveSearch = resolve
      })
    )
    renderPage()

    await typeAndSearch(user, "chicken")

    expect(await screen.findByText("Buscando…")).toBeInTheDocument()
    expect(searchButton()).toBeDisabled()

    resolveSearch({ results: [CHICKEN] })
    expect(await screen.findByText(CHICKEN.description)).toBeInTheDocument()
    expect(screen.queryByText("Buscando…")).not.toBeInTheDocument()
    expect(searchButton()).toBeEnabled()
  })

  // SDD: 021 REQ-012 AC-012.6
  it("sin resultados muestra el aviso con la consulta buscada", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [] })
    renderPage()

    await typeAndSearch(user, "zzxqv")

    expect(await screen.findByText("No encontramos alimentos para «zzxqv».")).toBeInTheDocument()
  })

  // SDD: 021 REQ-012 AC-012.6
  it("el aviso de sin resultados usa la consulta sin los espacios de los extremos", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [] })
    renderPage()

    await typeAndSearch(user, "  zzxqv  ")

    expect(await screen.findByText("No encontramos alimentos para «zzxqv».")).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledWith("zzxqv")
  })

  // SDD: 021 REQ-012 AC-012.7
  it("escribir sin pulsar «Buscar» ni Intro no hace ninguna petición", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(searchBox(), "chicken")

    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 021 REQ-013 AC-013.1
  it.each([["", "caja vacía"], ["   ", "solo espacios"]])(
    "con %j (%s) avisa y no hace ninguna petición",
    async (text) => {
      const user = userEvent.setup()
      renderPage()

      if (text) await user.type(searchBox(), text)
      await user.click(searchButton())

      expect(await screen.findByText("Escribe qué alimento quieres buscar.")).toBeInTheDocument()
      expect(searchMock).not.toHaveBeenCalled()
    }
  )

  // SDD: 021 REQ-013 AC-013.2
  it("con un solo carácter avisa de la longitud mínima y no hace ninguna petición", async () => {
    const user = userEvent.setup()
    renderPage()

    await typeAndSearch(user, "a")

    expect(
      await screen.findByText("La búsqueda debe tener al menos 2 caracteres.")
    ).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
    expect(searchBox()).toHaveValue("a")
  })

  // SDD: 021 REQ-013 AC-013.3
  it("la caja no admite más de 100 caracteres", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(searchBox(), "a".repeat(150))

    expect((searchBox() as HTMLInputElement).value).toHaveLength(100)
  })

  // SDD: 021 REQ-013 AC-013.4
  it("ante un error del servidor avisa con «Reintentar» y conserva el texto", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPage()

    await typeAndSearch(user, "chicken")

    expect(await screen.findByText("No se pudo completar la búsqueda.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
    expect(searchBox()).toHaveValue("chicken")
  })

  // SDD: 021 REQ-013 AC-013.4
  it("ante un error de red avisa con «Reintentar»", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    renderPage()

    await typeAndSearch(user, "chicken")

    expect(await screen.findByText("No se pudo completar la búsqueda.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })

  // SDD: 021 REQ-013 AC-013.5
  it("«Reintentar» repite la misma búsqueda", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    searchMock.mockResolvedValueOnce({ results: [CHICKEN] })
    renderPage()
    await typeAndSearch(user, "chicken")
    await screen.findByText("No se pudo completar la búsqueda.")

    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText(CHICKEN.description)).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(2)
    expect(searchMock.mock.calls[1][0]).toBe(searchMock.mock.calls[0][0])
    expect(searchMock.mock.calls[1][0]).toBe("chicken")
  })

  // SDD: 021 REQ-013 AC-013.5
  it("«Reintentar» repite la última búsqueda aunque se haya editado la caja", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    searchMock.mockResolvedValueOnce({ results: [CHICKEN] })
    renderPage()
    await typeAndSearch(user, "chicken")
    await screen.findByText("No se pudo completar la búsqueda.")
    await user.type(searchBox(), " breast")

    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2))
    expect(searchMock.mock.calls[1][0]).toBe("chicken")
  })

  // SDD: 021 REQ-013 AC-013.6
  it("ante un 429 muestra el mensaje del servidor y conserva el texto", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(429, RATE_LIMIT_MESSAGE))
    renderPage()

    await typeAndSearch(user, "chicken")

    expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument()
    expect(searchBox()).toHaveValue("chicken")
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument()
  })

  // SDD: 021 REQ-013 AC-013.7
  it("ante un 503 muestra el mensaje del servidor con «Reintentar» y conserva el texto", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(503, UNAVAILABLE_MESSAGE))
    renderPage()

    await typeAndSearch(user, "chicken")

    expect(await screen.findByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
    expect(searchBox()).toHaveValue("chicken")
  })

  // SDD: 021 REQ-014 AC-014.1
  it("la atribución a USDA se ve sin resultados", () => {
    renderPage()

    expect(screen.getByText(ATTRIBUTION)).toBeInTheDocument()
  })

  // SDD: 021 REQ-014 AC-014.1
  it("la atribución a USDA se ve con resultados", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [CHICKEN] })
    renderPage()

    await typeAndSearch(user, "chicken")
    await screen.findByText(CHICKEN.description)

    expect(screen.getByText(ATTRIBUTION)).toBeInTheDocument()
  })

  // SDD: 021 NFR-002 AC-N002.1
  it("el campo de búsqueda tiene el nombre accesible «Buscar alimento»", () => {
    renderPage()

    expect(screen.getByRole("searchbox", { name: "Buscar alimento" })).toBeInTheDocument()
  })

  // SDD: 021 NFR-002 AC-N002.2
  it("«Buscando…» se anuncia dentro de la región de estado", async () => {
    const user = userEvent.setup()
    searchMock.mockReturnValue(new Promise<FoodSearchResponse>(() => {}))
    renderPage()

    await typeAndSearch(user, "chicken")

    const status = await screen.findByRole("status")
    expect(within(status).getByText("Buscando…")).toBeInTheDocument()
    expect(status).toHaveAttribute("aria-live", "polite")
  })

  // SDD: 021 NFR-002 AC-N002.2
  it("«sin resultados» se anuncia dentro de la región de estado", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue({ results: [] })
    renderPage()

    await typeAndSearch(user, "zzxqv")

    const status = await screen.findByRole("status")
    expect(
      await within(status).findByText("No encontramos alimentos para «zzxqv».")
    ).toBeInTheDocument()
  })

  // SDD: 021 NFR-002 AC-N002.2
  it("el error se anuncia dentro de la región de estado", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPage()

    await typeAndSearch(user, "chicken")

    const status = await screen.findByRole("status")
    expect(
      await within(status).findByText("No se pudo completar la búsqueda.")
    ).toBeInTheDocument()
  })
})
