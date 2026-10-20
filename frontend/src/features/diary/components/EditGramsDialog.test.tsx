// Test del diálogo «Editar gramos» (spec 022). La red se simula en el api.ts
// del diario.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { getDiary, updateMealItemGrams } from "@/features/diary/api"
import { makeMeal, makeMealItem } from "@/test/diaryFixtures"
import type { MealItem } from "../types"
import { EditGramsDialog } from "./EditGramsDialog"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
}))

const updateMock = vi.mocked(updateMealItemGrams)
const getDiaryMock = vi.mocked(getDiary)

const SAVE_FAILED = "No se pudo guardar. Vuelve a intentarlo."

function renderDialog(item: MealItem = makeMealItem()) {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <EditGramsDialog mealId={12} item={item} date="2026-10-20" onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose }
}

function dialog() {
  return screen.getByRole("dialog", { name: "Editar gramos" })
}

async function setGrams(user: ReturnType<typeof userEvent.setup>, text: string) {
  const field = within(dialog()).getByLabelText("Gramos")
  await user.clear(field)
  if (text) await user.type(field, text)
}

describe("EditGramsDialog", () => {
  beforeEach(() => {
    updateMock.mockReset()
    getDiaryMock.mockReset()
    updateMock.mockResolvedValue(makeMeal())
    getDiaryMock.mockResolvedValue({
      date: "2026-10-20",
      meals: [],
      totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      incomplete: [],
    })
  })

  // SDD: 022 REQ-013 AC-013.1
  it("se abre con los gramos del alimento y la vista previa de sus valores por 100 g guardados", () => {
    renderDialog()

    expect(dialog()).toBeInTheDocument()
    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("150")
    expect(
      within(dialog()).getByText("248 kcal · 46,5 g proteína · 0,0 g carbohidratos · 5,4 g grasa")
    ).toBeInTheDocument()
  })

  // SDD: 022 REQ-013 AC-013.1
  it("usa los valores por 100 g guardados en el alimento, no los de USDA", () => {
    renderDialog(
      makeMealItem({
        per_100g: { calories_kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 1 },
        grams: 150.5,
      })
    )

    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("150,5")
    expect(
      within(dialog()).getByText("151 kcal · 15,1 g proteína · 30,1 g carbohidratos · 1,5 g grasa")
    ).toBeInTheDocument()
  })

  // SDD: 022 REQ-013 AC-013.1
  it("la vista previa se actualiza al cambiar los gramos", async () => {
    const user = userEvent.setup()
    renderDialog()

    await setGrams(user, "200")

    expect(
      within(dialog()).getByText("330 kcal · 62,0 g proteína · 0,0 g carbohidratos · 7,1 g grasa")
    ).toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-013 AC-013.2
  it("«Guardar» envía los gramos nuevos de ese alimento y cierra el diálogo", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await setGrams(user, "200")

    await user.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith(12, 31, 200)
  })

  // SDD: 022 REQ-013 AC-013.2
  it("acepta los gramos con coma decimal", async () => {
    const user = userEvent.setup()
    renderDialog()
    await setGrams(user, "150,5")

    await user.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(12, 31, 150.5))
  })

  // SDD: 022 REQ-013 AC-013.3
  it.each([
    ["", "Los gramos deben estar entre 1 y 2000."],
    ["0", "Los gramos deben estar entre 1 y 2000."],
    ["2001", "Los gramos deben estar entre 1 y 2000."],
    ["150,25", "Los gramos admiten como mucho un decimal."],
  ])("con los gramos %j avisa «%s» y no hace ninguna petición", async (grams, message) => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await setGrams(user, grams)

    await user.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    expect(await within(dialog()).findByText(message)).toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-013 AC-013.5
  it("si guardar falla muestra el mensaje genérico y sigue abierto", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    updateMock.mockRejectedValue(new ApiError(500, "boom"))
    await setGrams(user, "200")

    await user.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("200")
  })

  // SDD: 022 REQ-013 AC-013.5
  it("si el servidor responde 400 muestra su mensaje", async () => {
    const user = userEvent.setup()
    renderDialog()
    updateMock.mockRejectedValue(new ApiError(400, "Los gramos deben estar entre 1 y 2000."))
    await setGrams(user, "200")

    await user.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "Los gramos deben estar entre 1 y 2000."
    )
  })

  // SDD: 022 REQ-013 AC-013.2
  it("«Cancelar» cierra el diálogo sin guardar", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await setGrams(user, "200")

    await user.click(within(dialog()).getByRole("button", { name: "Cancelar" }))

    expect(onClose).toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  // SDD: 022 REQ-013 AC-013.2
  it("mientras guarda, «Guardar» muestra «Guardando…» y está desactivado", async () => {
    const user = userEvent.setup()
    renderDialog()
    updateMock.mockReturnValue(new Promise(() => {}))

    await user.click(within(dialog()).getByRole("button", { name: "Guardar" }))

    expect(await within(dialog()).findByRole("button", { name: "Guardando…" })).toBeDisabled()
  })
})
