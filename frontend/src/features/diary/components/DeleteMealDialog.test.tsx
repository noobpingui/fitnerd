// Confirmación de «Borrar comida» (spec 026). La red se simula en el api.ts del
// diario; el diálogo es un `alertdialog` de Radix.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { deleteMeal } from "@/features/diary/api"
import { DeleteMealDialog } from "./DeleteMealDialog"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
  analyzeMealPhoto: vi.fn(),
  restoreMealItem: vi.fn(),
  deleteMeal: vi.fn(),
}))

const deleteMock = vi.mocked(deleteMeal)

const DATE = "2026-10-20"
const FAILED = "No se pudo borrar la comida. Vuelve a intentarlo."

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function renderDialog(itemCount = 3) {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData(["diary", DATE], { date: DATE, meals: [] })
  render(
    <QueryClientProvider client={queryClient}>
      <DeleteMealDialog
        mealId={7}
        label="Cena"
        itemCount={itemCount}
        date={DATE}
        onClose={onClose}
      />
    </QueryClientProvider>
  )
  return { onClose, queryClient }
}

function dialog() {
  return screen.getByRole("alertdialog", { name: "¿Borrar Cena?" })
}

describe("DeleteMealDialog", () => {
  beforeEach(() => {
    deleteMock.mockReset()
    deleteMock.mockResolvedValue(undefined)
  })

  // SDD: 026 REQ-006 AC-006.2
  it("con 3 alimentos pregunta «¿Borrar Cena?» y avisa de que se quitarán los 3", () => {
    renderDialog(3)

    expect(within(dialog()).getByText("¿Borrar Cena?")).toBeInTheDocument()
    expect(
      within(dialog()).getByText("Se quitarán los 3 alimentos de Cena. No se puede deshacer.")
    ).toBeInTheDocument()
    expect(within(dialog()).getByRole("button", { name: "Borrar" })).toBeEnabled()
    expect(within(dialog()).getByRole("button", { name: "Cancelar" })).toBeEnabled()
  })

  // SDD: 026 REQ-006 AC-006.2
  it("con 1 alimento el texto va en singular", () => {
    renderDialog(1)

    expect(
      within(dialog()).getByText("Se quitará el alimento de Cena. No se puede deshacer.")
    ).toBeInTheDocument()
  })

  // SDD: 026 REQ-006 AC-006.2
  it("al abrirse no hace ninguna petición", () => {
    renderDialog()

    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: 026 REQ-006 AC-006.4
  it("«Cancelar» cierra sin hacer ninguna petición", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Cancelar" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: 026 REQ-006 AC-006.4
  it("Escape cierra sin hacer ninguna petición", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: 026 REQ-006 AC-006.3
  it("«Borrar» pide borrar esa comida, vuelve a leer el diario del día y cierra", async () => {
    const user = userEvent.setup()
    const { onClose, queryClient } = renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteMock).toHaveBeenCalledWith(7)
    expect(queryClient.getQueryState(["diary", DATE])?.isInvalidated).toBe(true)
  })

  // SDD: 026 REQ-006 AC-006.5
  it.each([
    ["un error del servidor", () => new ApiError(500, "boom")],
    ["un error de red", () => new TypeError("Failed to fetch")],
  ])("ante %s muestra el aviso y sigue abierto", async (_name, makeError) => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValue(makeError())
    const { onClose } = renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(FAILED)
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog()).getByRole("button", { name: "Borrar" })).toBeEnabled()
  })

  // SDD: 026 REQ-006 AC-006.5
  it("tras un fallo se puede volver a intentar y, si funciona, cierra sin aviso", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    const { onClose } = renderDialog()
    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))
    await within(dialog()).findByRole("alert")

    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(deleteMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 026 REQ-006 AC-006.6
  it("si el servidor responde 404 no muestra error, cierra y vuelve a leer el diario", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValue(new ApiError(404, "No encontramos esa comida."))
    const { onClose, queryClient } = renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText(FAILED)).not.toBeInTheDocument()
    expect(queryClient.getQueryState(["diary", DATE])?.isInvalidated).toBe(true)
  })

  // SDD: 026 REQ-006 AC-006.7
  it("mientras borra, «Borrar» está deshabilitado y no se envía una segunda petición", async () => {
    const user = userEvent.setup()
    const pending = deferred<void>()
    deleteMock.mockReturnValue(pending.promise)
    const { onClose } = renderDialog()

    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))
    await waitFor(() => expect(within(dialog()).getByRole("button", { name: "Borrar" })).toBeDisabled())
    await user.click(within(dialog()).getByRole("button", { name: "Borrar" }))

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    pending.resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  // SDD: 026 NFR-001 AC-N001.3
  it("es un diálogo con rol alertdialog, nombre igual al título y el foco dentro", async () => {
    renderDialog()

    const root = dialog()

    expect(root).toHaveAccessibleName("¿Borrar Cena?")
    await waitFor(() => expect(root).toContainElement(document.activeElement as HTMLElement))
  })
})
