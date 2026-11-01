// Test del diálogo «Añadir alimento» del chat de porciones (spec 032): precarga
// con la estimación, comida obligatoria, guardado como alimento personalizado y
// errores. La red se simula en el api.ts del diario.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { addMealItems, getDiary } from "@/features/diary/api"
import { makeMeal } from "@/test/diaryFixtures"
import type { Meal, PortionEstimateAnswer } from "../types"
import { PortionAddFoodDialog } from "./PortionAddFoodDialog"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
}))

const addMock = vi.mocked(addMealItems)
const getDiaryMock = vi.mocked(getDiary)

const SAVE_FAILED = "No se pudo guardar. Vuelve a intentarlo."
const GRAMS_RANGE = "Los gramos deben estar entre 1 y 2000."
const MEAL_REQUIRED = "Elige en qué comida añadirlo."
const LIBRARY_NOTICE =
  "Se guardará en tus alimentos para usarlo otro día. Si ya tienes uno con el mismo nombre, se actualizarán sus valores."

const EGGS: PortionEstimateAnswer = {
  kind: "estimate",
  grams: 250,
  unit: "5 huevos grandes",
  note: "Unos 50 g por huevo sin cáscara.",
  name: "Huevo",
  per100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
}
const BARE: PortionEstimateAnswer = { kind: "estimate", grams: 120, unit: null, note: null }

type User = ReturnType<typeof userEvent.setup>

function renderDialog(answer: PortionEstimateAnswer = EGGS, date = "2026-10-31") {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <PortionAddFoodDialog answer={answer} date={date} onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose }
}

const dialog = () => screen.getByRole("dialog", { name: "Añadir alimento" })
const field = (label: string) => within(dialog()).getByLabelText(label)
const addButton = () => within(dialog()).getByRole("button", { name: "Añadir" })

async function pickMeal(user: User, label: "Desayuno" | "Almuerzo" | "Cena" | "Meriendas") {
  await user.click(within(dialog()).getByRole("radio", { name: label }))
}

beforeEach(() => {
  addMock.mockReset()
  getDiaryMock.mockReset()
  addMock.mockResolvedValue(makeMeal({ meal_type: "dinner" }) as Meal)
  getDiaryMock.mockResolvedValue({
    date: "2026-10-31",
    meals: [],
    totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    incomplete: [],
  })
})

describe("PortionAddFoodDialog - precarga", () => {
  // SDD: 032 NFR-003 AC-N003.1
  it("es un diálogo con el nombre accesible «Añadir alimento»", () => {
    renderDialog()

    expect(screen.getByRole("dialog", { name: "Añadir alimento" })).toBeInTheDocument()
    expect(
      within(dialog()).getByText("Revisa los datos de la IA y elige en qué comida añadirlo.")
    ).toBeInTheDocument()
  })

  // SDD: 032 REQ-007 AC-007.1
  it("precarga nombre, gramos y los cuatro valores por 100 g con coma decimal", () => {
    renderDialog()

    expect(field("Nombre")).toHaveValue("Huevo")
    expect(field("Gramos")).toHaveValue("250")
    expect(field("Calorías por 100 g (kcal)")).toHaveValue("143")
    expect(field("Proteína por 100 g (g)")).toHaveValue("12,6")
    expect(field("Carbohidratos por 100 g (g)")).toHaveValue("0,7")
    expect(field("Grasa por 100 g (g)")).toHaveValue("9,5")
  })

  // SDD: 032 REQ-007 AC-007.2
  it("muestra la vista previa de la porción y el aviso de la biblioteca", () => {
    renderDialog()

    expect(
      within(dialog()).getByText(
        /^\d+ kcal · \d+,\d g proteína · \d+,\d g carbohidratos · \d+,\d g grasa$/
      )
    ).toBeInTheDocument()
    expect(within(dialog()).getByText(LIBRARY_NOTICE)).toBeInTheDocument()
  })

  // SDD: 032 REQ-007 AC-007.3
  it("sin nombre ni valores por 100 g, esos campos quedan vacíos y los gramos se conservan", () => {
    renderDialog(BARE)

    expect(field("Gramos")).toHaveValue("120")
    expect(field("Nombre")).toHaveValue("")
    expect(field("Calorías por 100 g (kcal)")).toHaveValue("")
    expect(field("Proteína por 100 g (g)")).toHaveValue("")
    expect(field("Carbohidratos por 100 g (g)")).toHaveValue("")
    expect(field("Grasa por 100 g (g)")).toHaveValue("")
  })

  // SDD: 032 REQ-007 AC-007.4
  it("con 3000 g los precarga, avisa del rango al añadir y no envía nada", async () => {
    const user = userEvent.setup()
    renderDialog({ ...EGGS, grams: 3000 })
    expect(field("Gramos")).toHaveValue("3000")
    await pickMeal(user, "Cena")

    await user.click(addButton())

    expect(await within(dialog()).findByText(GRAMS_RANGE)).toBeInTheDocument()
    expect(field("Gramos")).toHaveValue("3000")
    expect(addMock).not.toHaveBeenCalled()
  })
})

describe("PortionAddFoodDialog - comida obligatoria", () => {
  // SDD: 032 REQ-008 AC-008.1
  it("el campo «Comida» ofrece Desayuno, Almuerzo, Cena y Meriendas, sin ninguna elegida", () => {
    renderDialog()

    const group = within(dialog()).getByRole("radiogroup", { name: "Comida" })
    const radios = within(group).getAllByRole("radio")
    expect(radios.map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      "Desayuno",
      "Almuerzo",
      "Cena",
      "Meriendas",
    ])
    for (const radio of radios) expect(radio).not.toBeChecked()
  })

  // SDD: 032 REQ-008 AC-008.1
  it("el campo «Comida» va antes del formulario", () => {
    renderDialog()

    const group = within(dialog()).getByRole("radiogroup", { name: "Comida" })
    expect(
      Boolean(group.compareDocumentPosition(field("Nombre")) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)
  })

  // SDD: 032 REQ-008 AC-008.2
  it("«Añadir» sin comida elegida avisa «Elige en qué comida añadirlo.» y no envía nada", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.click(addButton())

    expect(await within(dialog()).findByText(MEAL_REQUIRED)).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 032 REQ-008 AC-008.2
  it("elegir una comida quita el aviso", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(addButton())
    await within(dialog()).findByText(MEAL_REQUIRED)

    await pickMeal(user, "Almuerzo")

    expect(within(dialog()).queryByText(MEAL_REQUIRED)).not.toBeInTheDocument()
  })
})

describe("PortionAddFoodDialog - guardar", () => {
  // SDD: 032 REQ-009 AC-009.1
  it("con «Cena» elegida envía una sola petición con el alimento personalizado y cierra", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await pickMeal(user, "Cena")

    await user.click(addButton())

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock).toHaveBeenCalledWith({
      date: "2026-10-31",
      meal_type: "dinner",
      items: [
        {
          name: "Huevo",
          grams: 250,
          per_100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
        },
      ],
    })
  })

  // SDD: 032 REQ-009 AC-009.2
  it("con otra fecha y «Desayuno» la petición lleva esa fecha y breakfast", async () => {
    const user = userEvent.setup()
    renderDialog(EGGS, "2026-10-20")
    await pickMeal(user, "Desayuno")

    await user.click(addButton())

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0]).toMatchObject({ date: "2026-10-20", meal_type: "breakfast" })
  })

  // SDD: 032 REQ-009 AC-009.2
  it.each([
    ["Almuerzo", "lunch"],
    ["Meriendas", "snack"],
  ] as const)("«%s» se envía como %s", async (label, mealType) => {
    const user = userEvent.setup()
    renderDialog()
    await pickMeal(user, label)

    await user.click(addButton())

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0].meal_type).toBe(mealType)
  })

  // SDD: 032 REQ-007 AC-007.6
  it("se envían los valores editados, no los de la respuesta", async () => {
    const user = userEvent.setup()
    renderDialog()
    await pickMeal(user, "Cena")
    await user.clear(field("Nombre"))
    await user.type(field("Nombre"), "Huevo duro")
    await user.clear(field("Gramos"))
    await user.type(field("Gramos"), "100")

    await user.click(addButton())

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0].items).toEqual([
      {
        name: "Huevo duro",
        grams: 100,
        per_100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
      },
    ])
  })

  // SDD: 032 REQ-009 AC-009.4
  it("mientras guarda, un segundo clic no envía otra petición y el botón muestra «Guardando…»", async () => {
    const user = userEvent.setup()
    addMock.mockReturnValue(new Promise<Meal>(() => {}))
    renderDialog()
    await pickMeal(user, "Cena")

    await user.click(addButton())
    const saving = await within(dialog()).findByRole("button", { name: "Guardando…" })
    await user.click(saving)

    expect(saving).toBeDisabled()
    expect(addMock).toHaveBeenCalledTimes(1)
  })
})

describe("PortionAddFoodDialog - errores y cierre", () => {
  // SDD: 032 REQ-010 AC-010.1
  it("un 400 mantiene el diálogo abierto, muestra el mensaje del servidor y conserva lo escrito", async () => {
    const user = userEvent.setup()
    addMock.mockRejectedValue(new ApiError(400, GRAMS_RANGE))
    const { onClose } = renderDialog()
    await pickMeal(user, "Cena")
    await user.clear(field("Nombre"))
    await user.type(field("Nombre"), "Huevo duro")

    await user.click(addButton())

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(GRAMS_RANGE)
    expect(onClose).not.toHaveBeenCalled()
    expect(field("Nombre")).toHaveValue("Huevo duro")
    expect(field("Gramos")).toHaveValue("250")
    expect(field("Calorías por 100 g (kcal)")).toHaveValue("143")
  })

  // SDD: 032 REQ-010 AC-010.2
  it.each([
    ["un 500", () => new ApiError(500, "boom")],
    ["un fallo de red", () => new TypeError("Failed to fetch")],
  ])("%s muestra el mensaje genérico y el diálogo sigue abierto", async (_name, makeError) => {
    const user = userEvent.setup()
    addMock.mockRejectedValue(makeError())
    const { onClose } = renderDialog()
    await pickMeal(user, "Cena")

    await user.click(addButton())

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 032 REQ-010 AC-010.3
  it("«Cancelar» cierra el diálogo y no envía nada", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Cancelar" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 032 REQ-010 AC-010.3
  it("Escape cierra el diálogo y no envía nada", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
  })
})
