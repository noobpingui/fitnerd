// Test del diálogo «Añadir a {sección}» (specs 022 y 023): búsqueda en el
// catálogo genérico, gramos con vista previa, alimento personalizado y
// errores. La red se simula en los api.ts del diario, del catálogo y de los
// alimentos de USDA (este último solo para comprobar que ya no se usa).
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { addMealItems, getDiary } from "@/features/diary/api"
import { searchCatalog } from "@/features/catalog/api"
import { searchFoods } from "@/features/foods/api"
import type { CatalogFood } from "@/features/catalog/types"
import { makeCatalogFood } from "@/test/catalogFixtures"
import { makeMeal } from "@/test/diaryFixtures"
import { useDiary } from "../hooks"
import type { Meal } from "../types"
import { AddFoodDialog } from "./AddFoodDialog"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
}))
vi.mock("@/features/catalog/api", () => ({
  searchCatalog: vi.fn(),
}))
vi.mock("@/features/foods/api", () => ({
  searchFoods: vi.fn(),
}))

const addMock = vi.mocked(addMealItems)
const getDiaryMock = vi.mocked(getDiary)
const searchMock = vi.mocked(searchCatalog)
const usdaSearchMock = vi.mocked(searchFoods)

const CHICKEN: CatalogFood = makeCatalogFood()
const BANANA: CatalogFood = makeCatalogFood({
  id: "banano",
  name: "Banano",
  per_100g: { calories_kcal: 89, protein_g: 1.09, carbs_g: 22.84, fat_g: 0.33 },
})

const CHICKEN_100G = "165 kcal · 31,0 g proteína · 0,0 g carbohidratos · 3,6 g grasa"
const CHICKEN_150G = "248 kcal · 46,5 g proteína · 0,0 g carbohidratos · 5,4 g grasa"
const GALLO_PREVIEW = "400 kcal · 13,8 g proteína · 67,5 g carbohidratos · 8,0 g grasa"
const SAVE_FAILED = "No se pudo guardar. Vuelve a intentarlo."
const SEARCH_FAILED = "No se pudo completar la búsqueda."

type User = ReturnType<typeof userEvent.setup>

// Lee el diario del día para comprobar que se vuelve a leer tras guardar.
function DiaryProbe() {
  useDiary("2026-10-20")
  return null
}

function renderDialog() {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <DiaryProbe />
      <AddFoodDialog mealType="breakfast" label="Desayuno" date="2026-10-20" onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose }
}

function dialog() {
  return screen.getByRole("dialog", { name: "Añadir a Desayuno" })
}

async function search(user: User, text: string) {
  await user.type(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" }), text)
  await user.click(within(dialog()).getByRole("button", { name: "Buscar" }))
}

async function choose(user: User, food: CatalogFood) {
  await user.click(await within(dialog()).findByRole("button", { name: `Elegir ${food.name}` }))
}

async function pickChicken(user: User) {
  searchMock.mockResolvedValue({ results: [CHICKEN] })
  await search(user, "pollo")
  await choose(user, CHICKEN)
}

async function setGrams(user: User, text: string) {
  const field = within(dialog()).getByLabelText("Gramos")
  await user.clear(field)
  if (text) await user.type(field, text)
}

async function openCustomForm(user: User) {
  await user.click(within(dialog()).getByRole("button", { name: "Crear alimento personalizado" }))
}

async function fillCustom(
  user: User,
  values: Partial<Record<"name" | "grams" | "calories" | "protein" | "carbs" | "fat", string>> = {}
) {
  const all = {
    name: "Gallo pinto",
    grams: "250",
    calories: "160",
    protein: "5,5",
    carbs: "27",
    fat: "3,2",
    ...values,
  }
  const labels = {
    name: "Nombre",
    grams: "Gramos",
    calories: "Calorías por 100 g (kcal)",
    protein: "Proteína por 100 g (g)",
    carbs: "Carbohidratos por 100 g (g)",
    fat: "Grasa por 100 g (g)",
  } as const
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    const field = within(dialog()).getByLabelText(labels[key])
    await user.clear(field)
    if (all[key]) await user.type(field, all[key])
  }
}

function resetMocks() {
  addMock.mockReset()
  getDiaryMock.mockReset()
  searchMock.mockReset()
  usdaSearchMock.mockReset()
  // Valor válido por defecto: el componente aún usa la búsqueda de USDA y no
  // debe desmontarse por un mock sin resultado; cada test fija el suyo.
  searchMock.mockResolvedValue({ results: [] })
  usdaSearchMock.mockResolvedValue({ results: [] })
  addMock.mockResolvedValue(makeMeal({ meal_type: "breakfast" }) as Meal)
  getDiaryMock.mockResolvedValue({
    date: "2026-10-20",
    meals: [],
    totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    incomplete: [],
  })
}

describe("AddFoodDialog - búsqueda en el catálogo", () => {
  beforeEach(resetMocks)

  // SDD: 023 REQ-009 AC-009.1
  it("se abre con la descripción «Busca un alimento o crea uno propio.», la caja con su ejemplo y el botón «Buscar»", () => {
    renderDialog()

    expect(dialog()).toBeInTheDocument()
    expect(
      within(dialog()).getByText("Busca un alimento o crea uno propio.")
    ).toBeInTheDocument()
    const box = within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })
    expect(box).toHaveAttribute("placeholder", "Ej.: arroz blanco cocido, banano")
    expect(within(dialog()).getByRole("button", { name: "Buscar" })).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 023 REQ-009 AC-009.1
  it("ya no habla de USDA en la descripción", () => {
    renderDialog()

    expect(within(dialog()).queryByText(/USDA/)).not.toBeInTheDocument()
  })

  // SDD: 023 REQ-009 AC-009.2
  it("busca en el catálogo (no en USDA) y muestra la pechuga con sus macros por 100 g y sin etiqueta de origen", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [CHICKEN] })

    await search(user, "pollo")

    expect(await within(dialog()).findByText("Pechuga de pollo a la plancha")).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0][0]).toBe("pollo")
    expect(usdaSearchMock).not.toHaveBeenCalled()
    const list = within(dialog()).getByRole("list", { name: "Resultados" })
    expect(within(list).getByText("165 kcal")).toBeInTheDocument()
    expect(within(list).getByText("31,0 g proteína")).toBeInTheDocument()
    expect(within(list).getByText("0,0 g carbohidratos")).toBeInTheDocument()
    expect(within(list).getByText("3,6 g grasa")).toBeInTheDocument()
    expect(dialog().textContent).not.toContain("Foundation")
    expect(dialog().textContent).not.toContain("SR Legacy")
  })

  // SDD: 023 REQ-009 AC-009.2
  it("la búsqueda también se lanza con Intro", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [CHICKEN] })

    await user.type(
      within(dialog()).getByRole("searchbox", { name: "Buscar alimento" }),
      "pollo{Enter}"
    )

    expect(await within(dialog()).findByText("Pechuga de pollo a la plancha")).toBeInTheDocument()
    expect(usdaSearchMock).not.toHaveBeenCalled()
  })

  // SDD: 023 REQ-009 AC-009.3
  it("al elegir la pechuga muestra «Gramos» con 100 y la vista previa por 100 g", async () => {
    const user = userEvent.setup()
    renderDialog()

    await pickChicken(user)

    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("100")
    expect(within(dialog()).getByText(CHICKEN_100G)).toBeInTheDocument()
    expect(within(dialog()).getByText("Pechuga de pollo a la plancha")).toBeInTheDocument()
  })

  // SDD: 023 REQ-009 AC-009.3
  it("al cambiar los gramos a 150 actualiza la vista previa sin hacer ninguna petición", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickChicken(user)

    await setGrams(user, "150")

    expect(within(dialog()).getByText(CHICKEN_150G)).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 023 REQ-009 AC-009.3
  it("la vista previa admite la coma decimal en los gramos", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickChicken(user)

    await setGrams(user, "150,0")

    expect(within(dialog()).getByText(CHICKEN_150G)).toBeInTheDocument()
  })

  // SDD: 023 REQ-009 AC-009.3
  it("los cuatro valores del alimento elegido se muestran con dato, sin «—»", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [BANANA] })
    await search(user, "banano")

    await choose(user, BANANA)

    const text = dialog().textContent ?? ""
    expect(text).toContain("89 kcal")
    expect(text).toContain("1,1 g proteína")
    expect(text).toContain("22,8 g carbohidratos")
    expect(text).not.toContain("—")
    expect(text).not.toContain("NaN")
  })

  // SDD: 023 REQ-009 AC-009.4
  it("«Añadir» envía el identificador del catálogo y los gramos a la comida de la sección, cierra el diálogo y relee el diario", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await waitFor(() => expect(getDiaryMock).toHaveBeenCalledTimes(1))
    await pickChicken(user)
    await setGrams(user, "150")

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock).toHaveBeenCalledWith({
      date: "2026-10-20",
      meal_type: "breakfast",
      items: [{ catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 150 }],
    })
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 023 REQ-009 AC-009.4
  it("no envía el FDC ID ni el nombre del alimento del catálogo", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    await waitFor(() => expect(addMock).toHaveBeenCalled())
    const item = addMock.mock.calls[0][0].items[0]
    expect(Object.keys(item).sort()).toEqual(["catalog_id", "grams"])
  })

  // SDD: 023 REQ-009 AC-009.5
  it("sin resultados, muestra «No encontramos alimentos para «gallo pinto».» con el botón para crear uno personalizado con el nombre relleno", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [] })

    await search(user, "gallo pinto")

    expect(
      await within(dialog()).findByText("No encontramos alimentos para «gallo pinto».")
    ).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0][0]).toBe("gallo pinto")
    expect(usdaSearchMock).not.toHaveBeenCalled()
    await openCustomForm(user)
    expect(within(dialog()).getByLabelText("Nombre")).toHaveValue("gallo pinto")
  })

  // SDD: 023 REQ-009 AC-009.6
  it.each([
    ["un error del servidor", new ApiError(500, "boom")],
    ["un error de red", new TypeError("Failed to fetch")],
  ])("ante %s muestra «No se pudo completar la búsqueda.» con «Reintentar» y conserva el texto", async (_name, error) => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockRejectedValue(error)

    await search(user, "pollo")

    expect(await within(dialog()).findByText(SEARCH_FAILED)).toBeInTheDocument()
    expect(within(dialog()).getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
    expect(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })).toHaveValue(
      "pollo"
    )
  })

  // SDD: 023 REQ-009 AC-009.6
  it("«Reintentar» repite la última consulta en el catálogo y muestra los resultados", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    searchMock.mockResolvedValue({ results: [CHICKEN] })
    await search(user, "pollo")
    await within(dialog()).findByText(SEARCH_FAILED)

    await user.click(within(dialog()).getByRole("button", { name: "Reintentar" }))

    expect(await within(dialog()).findByText("Pechuga de pollo a la plancha")).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(2)
    expect(searchMock.mock.calls[1][0]).toBe("pollo")
    expect(usdaSearchMock).not.toHaveBeenCalled()
  })

  // SDD: 023 REQ-009 AC-009.7
  it("con la caja vacía avisa «Escribe qué alimento quieres buscar.» y no hace ninguna petición", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Buscar" }))

    expect(
      await within(dialog()).findByText("Escribe qué alimento quieres buscar.")
    ).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
    expect(usdaSearchMock).not.toHaveBeenCalled()

    // Con una consulta válida sí se pide al catálogo, y no a USDA.
    searchMock.mockResolvedValue({ results: [CHICKEN] })
    await search(user, "po")
    await within(dialog()).findByRole("button", { name: "Elegir Pechuga de pollo a la plancha" })
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(usdaSearchMock).not.toHaveBeenCalled()
  })

  // SDD: 023 REQ-009 AC-009.7
  it("con «a» avisa «La búsqueda debe tener al menos 2 caracteres.» y no hace ninguna petición", async () => {
    const user = userEvent.setup()
    renderDialog()

    await search(user, "a")

    expect(
      await within(dialog()).findByText("La búsqueda debe tener al menos 2 caracteres.")
    ).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
    expect(usdaSearchMock).not.toHaveBeenCalled()

    // Con una consulta válida sí se pide al catálogo, y no a USDA.
    searchMock.mockResolvedValue({ results: [CHICKEN] })
    await search(user, "po")
    await within(dialog()).findByRole("button", { name: "Elegir Pechuga de pollo a la plancha" })
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(usdaSearchMock).not.toHaveBeenCalled()
  })

  // SDD: 023 NFR-002 AC-N002.1
  it("la caja se encuentra por su nombre accesible y, con resultados, hay una lista «Resultados» con un botón «Elegir {nombre}» por alimento", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [CHICKEN, BANANA] })

    await search(user, "po")

    const list = await within(dialog()).findByRole("list", { name: "Resultados" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    expect(
      within(list).getByRole("button", { name: "Elegir Pechuga de pollo a la plancha" })
    ).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: "Elegir Banano" })).toBeInTheDocument()
  })

  // SDD: 023 NFR-002 AC-N002.2
  it("«Buscando…» se anuncia en una región de estado", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockReturnValue(new Promise(() => {}))

    await search(user, "pollo")

    const status = await within(dialog()).findByRole("status")
    expect(status).toHaveTextContent("Buscando…")
    expect(status).toHaveAttribute("aria-live", "polite")
  })

  // SDD: 023 NFR-002 AC-N002.2
  it("«sin resultados» se anuncia en la región de estado", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [] })

    await search(user, "gallo pinto")

    const status = await within(dialog()).findByRole("status")
    await waitFor(() =>
      expect(status).toHaveTextContent("No encontramos alimentos para «gallo pinto».")
    )
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0][0]).toBe("gallo pinto")
    expect(usdaSearchMock).not.toHaveBeenCalled()
  })

  // SDD: 023 NFR-002 AC-N002.2
  it("el error de la búsqueda se anuncia en la región de estado", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockRejectedValue(new ApiError(500, "boom"))

    await search(user, "pollo")

    const status = await within(dialog()).findByRole("status")
    await waitFor(() => expect(status).toHaveTextContent(SEARCH_FAILED))
  })
})

describe("AddFoodDialog - guardar y cerrar", () => {
  beforeEach(resetMocks)

  // SDD: 022 REQ-011 AC-011.5
  it.each([
    ["", "Los gramos deben estar entre 1 y 2000."],
    ["0", "Los gramos deben estar entre 1 y 2000."],
    ["2001", "Los gramos deben estar entre 1 y 2000."],
    ["150,25", "Los gramos admiten como mucho un decimal."],
  ])("con los gramos %j avisa «%s» y no hace ninguna petición", async (grams, message) => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await pickChicken(user)
    await setGrams(user, grams)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    expect(await within(dialog()).findByText(message)).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-011 AC-011.6
  it("si el servidor responde 400 sigue abierto con lo elegido y muestra su mensaje", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    addMock.mockRejectedValue(new ApiError(400, "No encontramos ese alimento."))
    await pickChicken(user)
    await setGrams(user, "150")

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    const alert = await within(dialog()).findByRole("alert")
    expect(alert).toHaveTextContent("No encontramos ese alimento.")
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("150")
    expect(within(dialog()).getByText(CHICKEN.name)).toBeInTheDocument()
  })

  // SDD: 022 REQ-011 AC-011.6
  it("ante cualquier otro error muestra el mensaje genérico y sigue abierto", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    addMock.mockRejectedValue(new ApiError(500, "boom"))
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    const alert = await within(dialog()).findByRole("alert")
    expect(alert).toHaveTextContent(SAVE_FAILED)
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-011 AC-011.6
  it("ante un error de red muestra el mensaje genérico", async () => {
    const user = userEvent.setup()
    renderDialog()
    addMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
  })

  // SDD: 022 REQ-011 AC-011.8
  it("«Cancelar» cierra el diálogo y no guarda nada", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Cancelar" }))

    expect(onClose).toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-011 AC-011.8
  it("cerrar el diálogo con Escape no guarda nada", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await pickChicken(user)

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-011 AC-011.9
  it("«Volver a la búsqueda» muestra los resultados anteriores sin repetir la búsqueda", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Volver a la búsqueda" }))

    expect(
      await within(dialog()).findByRole("button", { name: `Elegir ${CHICKEN.name}` })
    ).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })).toHaveValue(
      "pollo"
    )
  })

  // SDD: 022 REQ-011 AC-011.10
  it("mientras guarda, «Añadir» está desactivado y muestra «Guardando…»", async () => {
    const user = userEvent.setup()
    renderDialog()
    addMock.mockReturnValue(new Promise<Meal>(() => {}))
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    const saving = await within(dialog()).findByRole("button", { name: "Guardando…" })
    expect(saving).toBeDisabled()
  })

  // SDD: 022 REQ-011 AC-011.4
  it("no envía nada si se pulsa «Añadir» dos veces mientras guarda", async () => {
    const user = userEvent.setup()
    renderDialog()
    addMock.mockReturnValue(new Promise<Meal>(() => {}))
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))
    await within(dialog()).findByRole("button", { name: "Guardando…" })
    await user.click(within(dialog()).getByRole("button", { name: "Guardando…" }))

    expect(addMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 023 NFR-002 AC-N002.1
  it("los campos del paso de gramos se encuentran por su etiqueta", async () => {
    const user = userEvent.setup()
    renderDialog()

    await pickChicken(user)

    expect(within(dialog()).getByLabelText("Gramos")).toBeInTheDocument()
  })

  // SDD: 022 NFR-002 AC-N002.3
  it("el error al guardar se anuncia en una región con rol alert", async () => {
    const user = userEvent.setup()
    renderDialog()
    addMock.mockRejectedValue(new ApiError(500, "boom"))
    await pickChicken(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    const alert = await within(dialog()).findByRole("alert")
    expect(alert).toHaveTextContent(SAVE_FAILED)
  })
})

describe("AddFoodDialog - alimento personalizado", () => {
  beforeEach(() => {
    resetMocks()
  })

  // SDD: 022 REQ-012 AC-012.1
  // SDD: 022 NFR-002 AC-N002.1
  it("«Crear alimento personalizado» muestra los seis campos por su etiqueta", async () => {
    const user = userEvent.setup()
    renderDialog()

    await openCustomForm(user)

    for (const label of [
      "Nombre",
      "Gramos",
      "Calorías por 100 g (kcal)",
      "Proteína por 100 g (g)",
      "Carbohidratos por 100 g (g)",
      "Grasa por 100 g (g)",
    ]) {
      expect(within(dialog()).getByLabelText(label)).toBeInTheDocument()
    }
  })

  // SDD: 022 REQ-012 AC-012.2
  it("«Añadir» envía el alimento personalizado y cierra el diálogo", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await openCustomForm(user)
    await fillCustom(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(addMock).toHaveBeenCalledWith({
      date: "2026-10-20",
      meal_type: "breakfast",
      items: [
        {
          name: "Gallo pinto",
          grams: 250,
          per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
        },
      ],
    })
  })

  // SDD: 022 REQ-012 AC-012.3
  it("muestra la vista previa de la porción y la actualiza al cambiar los gramos", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForm(user)

    await fillCustom(user)

    expect(within(dialog()).getByText(GALLO_PREVIEW)).toBeInTheDocument()
    await fillCustom(user, { grams: "100" })
    expect(
      within(dialog()).getByText("160 kcal · 5,5 g proteína · 27,0 g carbohidratos · 3,2 g grasa")
    ).toBeInTheDocument()
  })

  // SDD: 022 REQ-012 AC-012.4
  it.each([
    [{ name: "" }, "Escribe el nombre del alimento."],
    [{ calories: "" }, "Indica las calorías, proteína, carbohidratos y grasa por 100 g."],
    [{ calories: "901" }, "Las calorías por 100 g deben estar entre 0 y 900."],
    [{ protein: "101" }, "Los macros por 100 g deben estar entre 0 y 100 g."],
    [
      { protein: "50", carbs: "50", fat: "1" },
      "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g.",
    ],
    [{ grams: "0" }, "Los gramos deben estar entre 1 y 2000."],
  ])("con %j avisa «%s» junto al campo y no hace ninguna petición", async (values, message) => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await openCustomForm(user)
    await fillCustom(user, values)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    expect(await within(dialog()).findByText(message)).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-012 AC-012.5
  it("el campo «Nombre» no admite más de 100 caracteres", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForm(user)

    await user.type(within(dialog()).getByLabelText("Nombre"), "a".repeat(150))

    expect((within(dialog()).getByLabelText("Nombre") as HTMLInputElement).value).toHaveLength(100)
  })

  // SDD: 022 REQ-011 AC-011.6
  // SDD: 022 REQ-012 AC-012.2
  it("si guardar el personalizado falla, sigue abierto con lo escrito y muestra el error", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    addMock.mockRejectedValue(new ApiError(500, "boom"))
    await openCustomForm(user)
    await fillCustom(user)

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog()).getByLabelText("Nombre")).toHaveValue("Gallo pinto")
  })

  // SDD: 022 REQ-012 AC-012.1
  it("«Volver a la búsqueda» desde el formulario personalizado regresa a la búsqueda", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForm(user)

    await user.click(within(dialog()).getByRole("button", { name: "Volver a la búsqueda" }))

    expect(
      await within(dialog()).findByRole("searchbox", { name: "Buscar alimento" })
    ).toBeInTheDocument()
  })
})
