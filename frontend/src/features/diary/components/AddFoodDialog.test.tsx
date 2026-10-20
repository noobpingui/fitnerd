// Test del diálogo «Añadir a {sección}» (spec 022): búsqueda en USDA, gramos
// con vista previa, alimento personalizado y errores. La red se simula en los
// api.ts del diario y de los alimentos.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { addMealItems, getDiary } from "@/features/diary/api"
import { searchFoods } from "@/features/foods/api"
import type { Food } from "@/features/foods/types"
import { makeMeal } from "@/test/diaryFixtures"
import type { Meal } from "../types"
import { AddFoodDialog } from "./AddFoodDialog"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
}))
vi.mock("@/features/foods/api", () => ({
  searchFoods: vi.fn(),
}))

const addMock = vi.mocked(addMealItems)
const getDiaryMock = vi.mocked(getDiary)
const searchMock = vi.mocked(searchFoods)

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

const CHICKEN_100G = "165 kcal · 31,0 g proteína · 0,0 g carbohidratos · 3,6 g grasa"
const CHICKEN_150G = "248 kcal · 46,5 g proteína · 0,0 g carbohidratos · 5,4 g grasa"
const GALLO_PREVIEW = "400 kcal · 13,8 g proteína · 67,5 g carbohidratos · 8,0 g grasa"
const SAVE_FAILED = "No se pudo guardar. Vuelve a intentarlo."

type User = ReturnType<typeof userEvent.setup>

function renderDialog() {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
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

async function choose(user: User, food: Food) {
  await user.click(await within(dialog()).findByRole("button", { name: `Elegir ${food.description}` }))
}

async function pickChicken(user: User) {
  searchMock.mockResolvedValue({ results: [CHICKEN] })
  await search(user, "chicken")
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

describe("AddFoodDialog - búsqueda y gramos", () => {
  beforeEach(() => {
    addMock.mockReset()
    getDiaryMock.mockReset()
    searchMock.mockReset()
    addMock.mockResolvedValue(makeMeal({ meal_type: "breakfast" }) as Meal)
    getDiaryMock.mockResolvedValue({
      date: "2026-10-20",
      meals: [],
      totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      incomplete: [],
    })
  })

  // SDD: 022 REQ-011 AC-011.1
  // SDD: 022 NFR-002 AC-N002.1
  it("se abre como un diálogo «Añadir a Desayuno» con la caja «Buscar alimento» y el botón «Buscar»", () => {
    renderDialog()

    expect(dialog()).toBeInTheDocument()
    expect(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })).toBeInTheDocument()
    expect(within(dialog()).getByRole("button", { name: "Buscar" })).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-011 AC-011.2
  it("al elegir el pollo muestra «Gramos» con 100 y la vista previa por 100 g", async () => {
    const user = userEvent.setup()
    renderDialog()

    await pickChicken(user)

    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("100")
    expect(within(dialog()).getByText(CHICKEN_100G)).toBeInTheDocument()
    expect(within(dialog()).getByText(CHICKEN.description)).toBeInTheDocument()
  })

  // SDD: 022 REQ-011 AC-011.3
  it("al cambiar los gramos a 150 actualiza la vista previa sin hacer ninguna petición", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickChicken(user)

    await setGrams(user, "150")

    expect(within(dialog()).getByText(CHICKEN_150G)).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-011 AC-011.3
  it("la vista previa admite la coma decimal en los gramos", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickChicken(user)

    await setGrams(user, "150,0")

    expect(within(dialog()).getByText(CHICKEN_150G)).toBeInTheDocument()
  })

  // SDD: 022 REQ-011 AC-011.4
  it("«Añadir» envía el alimento a la comida de la sección y de hoy, cierra el diálogo y relee el diario", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await pickChicken(user)
    await setGrams(user, "150")

    await user.click(within(dialog()).getByRole("button", { name: "Añadir" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock).toHaveBeenCalledWith({
      date: "2026-10-20",
      meal_type: "breakfast",
      items: [{ fdc_id: 171477, grams: 150 }],
    })
  })

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
    expect(within(dialog()).getByText(CHICKEN.description)).toBeInTheDocument()
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

  // SDD: 022 REQ-011 AC-011.7
  it("un nutriente sin dato se muestra como «—» en la vista previa", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [RICE] })
    await search(user, "rice")

    await choose(user, RICE)

    const text = dialog().textContent ?? ""
    expect(text).toContain("130 kcal")
    expect(text).toContain("2,7 g proteína")
    expect(text).toContain("—")
    expect(text).not.toContain("null")
    expect(text).not.toContain("NaN")
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
      await within(dialog()).findByRole("button", { name: `Elegir ${CHICKEN.description}` })
    ).toBeInTheDocument()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })).toHaveValue(
      "chicken"
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

  // SDD: 022 NFR-002 AC-N002.1
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
    addMock.mockReset()
    getDiaryMock.mockReset()
    searchMock.mockReset()
    addMock.mockResolvedValue(makeMeal({ meal_type: "breakfast" }) as Meal)
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

  // SDD: 022 REQ-012 AC-012.6
  it("sin resultados, el botón «Crear alimento personalizado» sale junto al aviso y rellena el nombre con la consulta", async () => {
    const user = userEvent.setup()
    renderDialog()
    searchMock.mockResolvedValue({ results: [] })

    await search(user, "gallo pinto")

    expect(
      await within(dialog()).findByText("No encontramos alimentos para «gallo pinto».")
    ).toBeInTheDocument()
    await openCustomForm(user)
    expect(within(dialog()).getByLabelText("Nombre")).toHaveValue("gallo pinto")
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
