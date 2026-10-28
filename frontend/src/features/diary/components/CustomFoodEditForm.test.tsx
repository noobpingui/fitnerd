// Formulario de edición de un alimento propio, aislado (spec 029): campos, regla de
// «cambio», aviso de nombre repetido, validación, envío, Escape y accesibilidad. La
// comprobación del nombre usa el hook real con la búsqueda simulada en el api.ts de la
// biblioteca de alimentos.
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { searchFoodLibrary } from "@/features/food-library/api"
import { makeBananaFood, makeCustomLibraryFood } from "@/test/foodLibraryFixtures"
import { CustomFoodEditForm } from "./CustomFoodEditForm"
import { UPDATE_CUSTOM_FOOD_FAILED_MESSAGE } from "../errors"

vi.mock("@/features/food-library/api", () => ({
  searchFoodLibrary: vi.fn(),
  getRecentFoods: vi.fn(),
  getFavoriteFoods: vi.fn(),
  setFoodFavorite: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}))

const searchMock = vi.mocked(searchFoodLibrary)

const GALLO = makeCustomLibraryFood({ favorite: true }) // 180 kcal, 6 g, 30 g y 4 g
const AVENA = makeCustomLibraryFood({ id: 13, name: "Avena casera", favorite: true })
const TAKEN = "Ya tienes un alimento con ese nombre."

function renderForm(props: Partial<ComponentProps<typeof CustomFoodEditForm>> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CustomFoodEditForm
        food={GALLO}
        isSaving={false}
        serverError={null}
        nameTakenKey={null}
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
      />
    </QueryClientProvider>
  )
  return { onSubmit, onCancel, view }
}

const nameField = () => screen.getByRole("textbox", { name: "Nombre" })
const caloriesField = () => screen.getByRole("textbox", { name: "Calorías por 100 g (kcal)" })
const proteinField = () => screen.getByRole("textbox", { name: "Proteína por 100 g (g)" })
const carbsField = () => screen.getByRole("textbox", { name: "Carbohidratos por 100 g (g)" })
const fatField = () => screen.getByRole("textbox", { name: "Grasa por 100 g (g)" })
const saveButton = () => screen.getByRole("button", { name: /^Guardar|^Guardando/ })

async function replaceText(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.clear(field)
  if (text !== "") await user.type(field, text)
}

beforeEach(() => {
  searchMock.mockReset()
  searchMock.mockResolvedValue([])
})

describe("CustomFoodEditForm - estructura y accesibilidad", () => {
  // SDD: 029 REQ-007 AC-007.1
  // SDD: 029 NFR-001 AC-N001.1
  it("es un formulario con nombre accesible «Editar «Gallo pinto»» y su título visible", () => {
    renderForm()

    const form = screen.getByRole("form", { name: "Editar «Gallo pinto»" })
    expect(form).toBeInTheDocument()
    expect(screen.getByText("Editar «Gallo pinto»")).toBeInTheDocument()
  })

  // SDD: 029 REQ-007 AC-007.1
  it("muestra los cinco campos rellenos con los valores actuales y los botones «Guardar» y «Cancelar»", () => {
    renderForm()

    expect(nameField()).toHaveValue("Gallo pinto")
    expect(caloriesField()).toHaveValue("180")
    expect(proteinField()).toHaveValue("6")
    expect(carbsField()).toHaveValue("30")
    expect(fatField()).toHaveValue("4")
    expect(saveButton()).toHaveTextContent("Guardar")
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: /Gramos/ })).not.toBeInTheDocument()
  })

  // SDD: 029 REQ-007 AC-007.1
  it("los valores decimales se escriben con coma", () => {
    renderForm({
      food: makeCustomLibraryFood({
        per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
      }),
    })

    expect(fatField()).toHaveValue("3,57")
    expect(carbsField()).toHaveValue("0")
  })

  // SDD: 029 NFR-001 AC-N001.1
  it("al montarse el foco está en el campo «Nombre»", async () => {
    renderForm()

    await waitFor(() => expect(nameField()).toHaveFocus())
  })

  // SDD: 029 NFR-001 AC-N001.5
  it("el aviso de nombre repetido vive en una región de estado siempre presente y vacía sin aviso", () => {
    renderForm()

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("")
    expect(nameField()).not.toHaveAttribute("aria-describedby", expect.stringContaining(status.id))
  })
})

describe("CustomFoodEditForm - «Guardar» solo con cambios", () => {
  // SDD: 029 REQ-008 AC-008.1
  it("recién abierto, «Guardar» está deshabilitado", () => {
    renderForm()

    expect(saveButton()).toBeDisabled()
  })

  // SDD: 029 REQ-008 AC-008.2
  it("cambiar las calorías a 190 lo habilita y volver a 180 lo deshabilita", async () => {
    const user = userEvent.setup()
    renderForm()

    await replaceText(user, caloriesField(), "190")
    expect(saveButton()).toBeEnabled()

    await replaceText(user, caloriesField(), "180")
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 029 REQ-008 AC-008.3
  it("cambiar el nombre a «gallo pinto» lo habilita", async () => {
    const user = userEvent.setup()
    renderForm()

    await replaceText(user, nameField(), "gallo pinto")

    await waitFor(() => expect(saveButton()).toBeEnabled())
  })

  // SDD: 029 REQ-008 AC-008.4
  it("añadir espacios al nombre o escribir la proteína como «6,0» sigue sin habilitarlo", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(nameField())
    await user.keyboard("{End}   ")
    await replaceText(user, proteinField(), "6,0")

    expect(saveButton()).toBeDisabled()
    // Espera a que termine cualquier comprobación pendiente: sigue deshabilitado.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 029 REQ-008 AC-008.5
  it("vaciar las calorías lo habilita y, al pulsarlo, avisa sin enviar nada", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await replaceText(user, caloriesField(), "")
    expect(saveButton()).toBeEnabled()
    await user.click(saveButton())

    expect(
      await screen.findByText("Indica las calorías, proteína, carbohidratos y grasa por 100 g.")
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("CustomFoodEditForm - validación y envío", () => {
  // SDD: 029 REQ-007 AC-007.5
  it("con el nombre vacío avisa «Escribe el nombre del alimento.» y no envía", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await replaceText(user, nameField(), "")
    await user.click(saveButton())

    expect(await screen.findByText("Escribe el nombre del alimento.")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.5
  it("con 901 kcal avisa del rango de calorías y no envía", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await replaceText(user, caloriesField(), "901")
    await user.click(saveButton())

    expect(
      await screen.findByText("Las calorías por 100 g deben estar entre 0 y 900.")
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.5
  it("con proteína 40, carbohidratos 40 y grasa 30 avisa de la suma de macros y no envía", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await replaceText(user, proteinField(), "40")
    await replaceText(user, carbsField(), "40")
    await replaceText(user, fatField(), "30")
    await user.click(saveButton())

    expect(
      await screen.findByText(
        "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
      )
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-010 AC-010.1
  it("con valores válidos envía el nombre recortado y los cuatro números", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await replaceText(user, nameField(), " Gallo pinto con huevo ")
    await replaceText(user, caloriesField(), "200")
    await replaceText(user, proteinField(), "9")
    await replaceText(user, carbsField(), "28")
    await replaceText(user, fatField(), "6")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Gallo pinto con huevo",
      per_100g: { calories_kcal: 200, protein_g: 9, carbs_g: 28, fat_g: 6 },
    })
  })

  // SDD: 029 REQ-010 AC-010.1
  it("Intro en un campo con cambios válidos también envía", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await replaceText(user, caloriesField(), "190")
    await user.keyboard("{Enter}")

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0].per_100g.calories_kcal).toBe(190)
  })

  // SDD: 029 REQ-010 AC-010.5
  it("muestra el error del servidor junto a los botones en un aviso con role=alert", () => {
    renderForm({ serverError: "No se pudo guardar el alimento." })

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar el alimento.")
  })
})

describe("CustomFoodEditForm - guardando", () => {
  // SDD: 029 REQ-010 AC-010.1
  it("con `isSaving` muestra «Guardando…» y deshabilita «Guardar» y «Cancelar»", () => {
    renderForm({ isSaving: true })

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()
  })

  // SDD: 029 REQ-010 AC-010.6
  it("con `isSaving` pulsar Intro en un campo no envía otra petición", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ isSaving: true })

    await user.type(caloriesField(), "1{Enter}")
    await user.type(nameField(), "{Enter}")

    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.2
  it("«Cancelar» llama a `onCancel` sin enviar nada", async () => {
    const user = userEvent.setup()
    const { onSubmit, onCancel } = renderForm()

    await replaceText(user, nameField(), "Otro nombre")
    await user.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.3
  it("Escape llama a `onCancel` una sola vez y sin enviar", async () => {
    const user = userEvent.setup()
    const { onSubmit, onCancel } = renderForm()

    await user.keyboard("{Escape}")

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-007 AC-007.3
  it("con el guardado en curso Escape no cierra el formulario", async () => {
    const user = userEvent.setup()
    const { onCancel } = renderForm({ isSaving: true })

    await user.keyboard("{Escape}")

    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe("CustomFoodEditForm - nombre repetido", () => {
  // SDD: 029 REQ-009 AC-009.1
  // SDD: 029 NFR-001 AC-N001.5
  it("«avena CASERA» muestra el aviso en la región de estado, descrito desde «Nombre», y deshabilita «Guardar»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([AVENA])
    renderForm()

    await replaceText(user, nameField(), "avena CASERA")

    const status = screen.getByRole("status")
    await waitFor(() => expect(status).toHaveTextContent(TAKEN))
    expect(nameField().getAttribute("aria-describedby") ?? "").toContain(status.id)
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 029 REQ-009 AC-009.1
  it("al cambiar a «Avena casera de la abuela» el aviso desaparece y «Guardar» se habilita", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([AVENA])
    renderForm()
    await replaceText(user, nameField(), "avena CASERA")
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TAKEN))

    await replaceText(user, nameField(), "Avena casera de la abuela")

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(""))
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(nameField().getAttribute("aria-describedby") ?? "").not.toContain(
      screen.getByRole("status").id
    )
  })

  // SDD: 029 REQ-009
  it("mientras se comprueba el nombre «Guardar» está deshabilitado, y se habilita al terminar sin repetido", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([])
    renderForm()

    await replaceText(user, nameField(), "Gallo pinto nuevo")
    expect(saveButton()).toBeDisabled()

    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(searchMock).toHaveBeenCalledWith("Gallo pinto nuevo")
  })

  // SDD: 029 REQ-009 AC-009.3
  it("su propio nombre con otras mayúsculas no muestra aviso y habilita «Guardar»", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([GALLO])
    renderForm()

    await replaceText(user, nameField(), "GALLO PINTO")

    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByRole("status")).toHaveTextContent("")
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-009 AC-009.4
  it("un nombre que solo existe en el catálogo no muestra aviso", async () => {
    const user = userEvent.setup()
    searchMock.mockResolvedValue([makeBananaFood()])
    renderForm()

    await replaceText(user, nameField(), "Banano")

    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByRole("status")).toHaveTextContent("")
  })

  // SDD: 029 REQ-009 AC-009.5
  it("si la comprobación falla no hay aviso y «Guardar» se habilita", async () => {
    const user = userEvent.setup()
    searchMock.mockRejectedValue(new ApiError(500, "boom"))
    renderForm()

    await replaceText(user, nameField(), "avena CASERA")

    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByRole("status")).toHaveTextContent("")
  })

  // SDD: 029 REQ-010 AC-010.3
  it("con `nameTakenKey` muestra el aviso solo mientras el nombre tenga esa clave y deshabilita «Guardar»", async () => {
    const user = userEvent.setup()
    renderForm({ nameTakenKey: "gallo pinto con huevo" })
    // El nombre actual no coincide con la clave rechazada: sin aviso.
    expect(screen.getByRole("status")).toHaveTextContent("")

    await replaceText(user, nameField(), "  GALLO pinto con HUEVO ")

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TAKEN))
    expect(saveButton()).toBeDisabled()
    expect(nameField().getAttribute("aria-describedby") ?? "").toContain(
      screen.getByRole("status").id
    )
  })

  // SDD: 029 REQ-010 AC-010.3
  it("con `nameTakenKey`, cambiar el nombre quita el aviso y habilita «Guardar»", async () => {
    const user = userEvent.setup()
    renderForm({ nameTakenKey: "gallo pinto con huevo" })
    await replaceText(user, nameField(), "Gallo pinto con huevo")
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TAKEN))

    await replaceText(user, nameField(), "Gallo pinto con huevo y queso")

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(""))
    await waitFor(() => expect(saveButton()).toBeEnabled())
  })
})

describe("CustomFoodEditForm - foco al terminar un guardado fallido (F3, R1)", () => {
  type Outcome = { serverError: string | null; nameTakenKey: string | null }

  async function focusCaloriesThenFinish(after: Outcome) {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const tree = (isSaving: boolean, outcome: Outcome) => (
      <QueryClientProvider client={queryClient}>
        <CustomFoodEditForm
          food={GALLO}
          isSaving={isSaving}
          serverError={outcome.serverError}
          nameTakenKey={outcome.nameTakenKey}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>
    )
    const { rerender } = render(tree(true, { serverError: null, nameTakenKey: null }))
    await user.click(caloriesField())
    expect(caloriesField()).toHaveFocus()

    rerender(tree(false, after))
  }

  // SDD: 029 NFR-001 AC-N001.1
  it("de `isSaving` a no con `serverError` el foco va a «Nombre»", async () => {
    await focusCaloriesThenFinish({ serverError: UPDATE_CUSTOM_FOOD_FAILED_MESSAGE, nameTakenKey: null })

    await waitFor(() => expect(nameField()).toHaveFocus())
  })

  // SDD: 029 NFR-001 AC-N001.1
  it("de `isSaving` a no con `nameTakenKey` (409) el foco va a «Nombre»", async () => {
    await focusCaloriesThenFinish({ serverError: null, nameTakenKey: "gallo pinto con huevo" })

    await waitFor(() => expect(nameField()).toHaveFocus())
  })

  // SDD: 029 NFR-001 AC-N001.1
  it("de `isSaving` a no sin `serverError` ni `nameTakenKey` el foco sigue en «Calorías»", async () => {
    await focusCaloriesThenFinish({ serverError: null, nameTakenKey: null })

    await new Promise((r) => setTimeout(r, 50))
    expect(caloriesField()).toHaveFocus()
  })
})

describe("CustomFoodEditForm - Intro durante la comprobación del nombre (F4)", () => {
  const CHECKING = "Comprobando el nombre…"

  function pendingSearch(result: Awaited<ReturnType<typeof searchFoodLibrary>>) {
    let resolve!: () => void
    const promise = new Promise<typeof result>((done) => {
      resolve = () => done(result)
    })
    searchMock.mockReturnValue(promise)
    return resolve
  }

  // SDD: 029 REQ-009 AC-010.6
  it("Intro con la comprobación en curso no envía y la región de estado muestra «Comprobando el nombre…»; al terminar sin coincidencias desaparece, habilita «Guardar» y no envía", async () => {
    const user = userEvent.setup()
    const finish = pendingSearch([])
    const { onSubmit } = renderForm()
    await replaceText(user, nameField(), "Gallo pinto nuevo")
    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    expect(saveButton()).toBeDisabled()

    await user.keyboard("{Enter}")

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING)
    finish()
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(""))
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-009 AC-009.1
  it("con nombre repetido al terminar muestra el aviso de nombre repetido en lugar del texto de comprobación", async () => {
    const user = userEvent.setup()
    const finish = pendingSearch([AVENA])
    const { onSubmit } = renderForm()
    await replaceText(user, nameField(), "avena casera")
    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    await user.keyboard("{Enter}")
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING)

    finish()

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TAKEN))
    expect(screen.getByRole("status")).not.toHaveTextContent(CHECKING)
    expect(saveButton()).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-009 AC-010.6
  it("cambiar el nombre después de Intro quita el texto de comprobación", async () => {
    const user = userEvent.setup()
    pendingSearch([])
    renderForm()
    await replaceText(user, nameField(), "Gallo pinto nuevo")
    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    await user.keyboard("{Enter}")
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING)

    await user.type(nameField(), " 2")

    expect(screen.getByRole("status")).not.toHaveTextContent(CHECKING)
  })

  // SDD: 029 REQ-009 AC-010.6
  it("volver al mismo nombre con la comprobación en curso no muestra el texto antiguo ni envía", async () => {
    const user = userEvent.setup()
    pendingSearch([])
    const { onSubmit } = renderForm()
    await replaceText(user, nameField(), "Gallo pinto nuevo")
    await waitFor(() => expect(searchMock).toHaveBeenCalled())
    await user.keyboard("{Enter}")
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING)

    await user.type(nameField(), " 2")
    await user.type(nameField(), "{Backspace}{Backspace}")

    expect(nameField()).toHaveValue("Gallo pinto nuevo")
    expect(screen.getByRole("status")).not.toHaveTextContent(CHECKING)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-009 AC-010.6
  it("Intro sin cambios no muestra el texto de comprobación", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(nameField(), "{Enter}")

    expect(screen.getByRole("status")).toHaveTextContent("")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // SDD: 029 REQ-009 AC-010.6
  it("Intro con `isSaving` no muestra el texto de comprobación", async () => {
    const user = userEvent.setup()
    pendingSearch([])
    const { onSubmit } = renderForm({ isSaving: true })
    await replaceText(user, nameField(), "Gallo pinto nuevo")
    await waitFor(() => expect(searchMock).toHaveBeenCalled())

    await user.keyboard("{Enter}")

    expect(screen.getByRole("status")).not.toHaveTextContent(CHECKING)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
