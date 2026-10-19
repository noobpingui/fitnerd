// Test del historial de mediciones de Métricas (spec 008): lista, paginación,
// corrección en línea y borrado con confirmación. La red se simula en api.ts
// (vi.mock); un arnés con useBodyMetrics hace de página para que la lista se
// recargue tras guardar o borrar, como en la app real.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  deleteBodyMetric,
  listBodyMetrics,
  updateBodyMetric,
} from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { useBodyMetrics } from "@/features/body-metrics/hooks"
import type { RevealRequest } from "@/features/body-metrics/historyReveal"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { WeightUnit } from "@/features/onboarding/types"
import { KG_PER_LB } from "@/features/onboarding/units"
import { MetricsHistory } from "./MetricsHistory"

vi.mock("@/features/body-metrics/api", () => ({
  listBodyMetrics: vi.fn(),
  createBodyMetric: vi.fn(),
  updateBodyMetric: vi.fn(),
  deleteBodyMetric: vi.fn(),
  analyzeBodyMetrics: vi.fn(),
}))
vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const listMock = vi.mocked(listBodyMetrics)
const updateMock = vi.mocked(updateBodyMetric)
const deleteMock = vi.mocked(deleteBodyMetric)

type User = ReturnType<typeof userEvent.setup>

function metric(
  recorded_at: string,
  weight: number | null,
  fat: number | null = null,
  muscle: number | null = null
): BodyMetric {
  return {
    id: `id-${recorded_at}`,
    weight,
    body_fat_percentage: fat,
    muscle_mass_percentage: muscle,
    notes: null,
    recorded_at,
  }
}

const OLDER = metric("2026-10-05", 80, 20)
const NEWER = metric("2026-10-11", 78.5)

function Harness({ weightUnit }: { weightUnit: WeightUnit }) {
  const { data } = useBodyMetrics()
  if (!data) return null
  const toDisplayWeight = (kg: number) =>
    weightUnit === "lb" ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg
  return (
    <MetricsHistory
      metrics={data}
      weightUnit={weightUnit}
      toDisplayWeight={toDisplayWeight}
    />
  )
}

function renderHistory(weightUnit: WeightUnit = "kg") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness weightUnit={weightUnit} />
    </QueryClientProvider>
  )
}

const editName = (iso: string) => `Corregir medición del ${formatDate(iso)}`
const deleteName = (iso: string) => `Borrar medición del ${formatDate(iso)}`
const editButtons = () =>
  screen.queryAllByRole("button", { name: /^Corregir medición del/ })
const showMore = () => screen.queryByRole("button", { name: "Mostrar más" })

// n mediciones de peso, una por día hacia atrás desde el 2026-10-12.
function manyMetrics(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(Date.UTC(2026, 9, 12 - i))
    return metric(day.toISOString().slice(0, 10), 80 - i * 0.1)
  })
}

beforeEach(() => {
  listMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
})

describe("MetricsHistory - lista", () => {
  // SDD: REQ-008 AC-008.1
  it("muestra primero la más reciente, con '—' donde falta el valor", async () => {
    listMock.mockResolvedValue([OLDER, NEWER])
    renderHistory("kg")

    await screen.findByRole("button", { name: editName("2026-10-11") })
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows).toHaveLength(2)

    expect(rows[0]).toHaveTextContent(formatDate("2026-10-11"))
    expect(within(rows[0]).getByText(/^78[.,]5 kg$/)).toBeInTheDocument()
    expect(within(rows[0]).getAllByText("—")).toHaveLength(2)

    expect(rows[1]).toHaveTextContent(formatDate("2026-10-05"))
    expect(within(rows[1]).getByText("80 kg")).toBeInTheDocument()
    expect(within(rows[1]).getByText("20 %")).toBeInTheDocument()
    expect(within(rows[1]).getAllByText("—")).toHaveLength(1)
  })

  // SDD: REQ-008 AC-008.1
  it("tiene las cabeceras Fecha, Peso, % Grasa y % Músculo", async () => {
    listMock.mockResolvedValue([OLDER, NEWER])
    renderHistory()

    await screen.findByRole("button", { name: editName("2026-10-11") })

    for (const name of ["Fecha", "Peso", "% Grasa", "% Músculo"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument()
    }
  })

  // SDD: REQ-008 AC-008.2
  it("muestra los pesos en lb si el perfil usa lb", async () => {
    listMock.mockResolvedValue([OLDER, NEWER])
    renderHistory("lb")

    await screen.findByRole("button", { name: editName("2026-10-11") })
    const rows = screen.getAllByRole("row").slice(1)

    expect(within(rows[0]).getByText(/^173[.,]1 lb$/)).toBeInTheDocument()
    expect(within(rows[1]).getByText(/^176[.,]4 lb$/)).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.3
  it("con 23 mediciones muestra 10, luego 20 y luego 23 sin el botón", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue(manyMetrics(23))
    renderHistory()

    await waitFor(() => expect(editButtons()).toHaveLength(10))
    expect(showMore()).toBeInTheDocument()

    await user.click(showMore()!)
    expect(editButtons()).toHaveLength(20)
    expect(showMore()).toBeInTheDocument()

    await user.click(showMore()!)
    expect(editButtons()).toHaveLength(23)
    expect(showMore()).not.toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.4
  it("con 10 mediciones o menos las muestra todas y no hay 'Mostrar más'", async () => {
    listMock.mockResolvedValue(manyMetrics(10))
    renderHistory()

    await waitFor(() => expect(editButtons()).toHaveLength(10))
    expect(showMore()).not.toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.5
  it("cada fila tiene botones accesibles para corregir y borrar con la fecha", async () => {
    listMock.mockResolvedValue([OLDER, NEWER])
    renderHistory()

    expect(
      await screen.findByRole("button", { name: editName("2026-10-11") })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: deleteName("2026-10-11") })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: editName("2026-10-05") })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: deleteName("2026-10-05") })
    ).toBeInTheDocument()
  })
})

describe("MetricsHistory - corregir", () => {
  async function openEditor(user: User, iso = "2026-10-05") {
    await user.click(await screen.findByRole("button", { name: editName(iso) }))
  }

  async function typeInto(user: User, label: string, text: string) {
    const input = screen.getByLabelText(label)
    await user.clear(input)
    if (text) await user.type(input, text)
  }

  // SDD: REQ-009 AC-009.1
  it("al pulsar Corregir muestra el formulario con los valores de la medición", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory("kg")

    await openEditor(user)

    expect(screen.getByLabelText("Peso (kg)")).toHaveValue(80)
    expect(screen.getByLabelText("% Grasa corporal")).toHaveValue(20)
    expect(screen.getByLabelText("% Masa muscular")).toHaveValue(null)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.2
  it("guarda la corrección con el payload exacto, cierra el formulario y la fila muestra el peso nuevo", async () => {
    const user = userEvent.setup()
    listMock
      .mockResolvedValueOnce([OLDER])
      .mockResolvedValue([metric("2026-10-05", 79, 20)])
    updateMock.mockResolvedValue(metric("2026-10-05", 79, 20))
    renderHistory("kg")
    await openEditor(user)

    await typeInto(user, "Peso (kg)", "79")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Guardar" })
      ).not.toBeInTheDocument()
    )
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith("id-2026-10-05", {
      weight: 79,
      body_fat_percentage: 20,
      muscle_mass_percentage: null,
    })
    expect(await screen.findByText("79 kg")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.3
  it("con un perfil en lb, cambiar solo la grasa envía el peso original en kg", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([NEWER])
    updateMock.mockResolvedValue(NEWER)
    renderHistory("lb")
    await openEditor(user, "2026-10-11")
    expect(screen.getByLabelText("Peso (lb)")).toHaveValue(173.1)

    await typeInto(user, "% Grasa corporal", "25")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith("id-2026-10-11", {
      weight: 78.5,
      body_fat_percentage: 25,
      muscle_mass_percentage: null,
    })
  })

  // SDD: REQ-009 AC-009.4
  it("con un perfil en lb, escribir 160 envía el peso en kg con un decimal", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([NEWER])
    updateMock.mockResolvedValue(NEWER)
    renderHistory("lb")
    await openEditor(user, "2026-10-11")

    await typeInto(user, "Peso (lb)", "160")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock.mock.calls[0][1]).toMatchObject({ weight: 72.6 })
  })

  // SDD: REQ-009 AC-009.5
  it("con los tres campos vacíos muestra 'Registra al menos un valor' y deshabilita Guardar", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory()
    await openEditor(user)

    await typeInto(user, "Peso (kg)", "")
    await typeInto(user, "% Grasa corporal", "")

    expect(
      await screen.findByText("Registra al menos un valor")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.6
  it("un peso fuera de rango muestra 'Entre 30 y 300 kg' y deshabilita Guardar", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory("kg")
    await openEditor(user)

    await typeInto(user, "Peso (kg)", "301")

    expect(await screen.findByText("Entre 30 y 300 kg")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.6
  it("un peso fuera de rango en lb muestra 'Entre 66 y 660 lb'", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory("lb")
    await openEditor(user)

    await typeInto(user, "Peso (lb)", "661")

    expect(await screen.findByText("Entre 66 y 660 lb")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.6
  it("una grasa fuera de 3–60 muestra 'Entre 3 y 60 %'", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory()
    await openEditor(user)

    await typeInto(user, "% Grasa corporal", "61")

    expect(await screen.findByText("Entre 3 y 60 %")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.6
  it("una masa muscular fuera de 10–70 muestra 'Entre 10 y 70 %'", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory()
    await openEditor(user)

    await typeInto(user, "% Masa muscular", "9")

    expect(await screen.findByText("Entre 10 y 70 %")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.7
  it("mientras guarda, el botón está deshabilitado y dice 'Guardando…'", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    updateMock.mockReturnValue(new Promise(() => {}))
    renderHistory()
    await openEditor(user)

    await typeInto(user, "Peso (kg)", "79")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    const saving = await screen.findByRole("button", { name: "Guardando…" })
    expect(saving).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.8
  it("si falla, el formulario sigue abierto con lo escrito y muestra el error", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    updateMock.mockRejectedValue(new Error("fallo"))
    renderHistory()
    await openEditor(user)

    await typeInto(user, "Peso (kg)", "79")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    expect(
      await screen.findByText(
        "No se pudo guardar la medición. Inténtalo de nuevo."
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Peso (kg)")).toHaveValue(79)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.9
  it("Cancelar cierra el formulario sin enviar nada y la fila conserva sus valores", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER])
    renderHistory()
    await openEditor(user)

    await typeInto(user, "Peso (kg)", "79")
    await user.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(
      screen.queryByRole("button", { name: "Guardar" })
    ).not.toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
    expect(screen.getByText("80 kg")).toBeInTheDocument()
  })
})

describe("MetricsHistory - borrar", () => {
  async function openDialog(user: User, iso = "2026-10-11") {
    await user.click(await screen.findByRole("button", { name: deleteName(iso) }))
    return screen.findByRole("dialog")
  }

  // SDD: REQ-010 AC-010.1
  it("pide confirmación con el título, el texto y los botones Borrar y Cancelar", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER, NEWER])
    renderHistory()

    const dialog = await openDialog(user)

    expect(
      within(dialog).getByText(
        `¿Borrar la medición del ${formatDate("2026-10-11")}?`
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("Esta acción no se puede deshacer.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Borrar" })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" })
    ).toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  // SDD: REQ-010 AC-010.2
  it("Cancelar cierra el diálogo sin enviar nada y la fila sigue", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER, NEWER])
    renderHistory()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(deleteMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: editName("2026-10-11") })
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.3
  it("al confirmar con éxito cierra el diálogo y la fila desaparece", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValueOnce([OLDER, NEWER]).mockResolvedValue([OLDER])
    deleteMock.mockResolvedValue(undefined)
    renderHistory()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole("button", { name: "Borrar" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteMock.mock.calls[0][0]).toBe("id-2026-10-11")
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: editName("2026-10-11") })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("button", { name: editName("2026-10-05") })
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.4
  it("si el borrado falla muestra el error y la fila sigue en el historial", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER, NEWER])
    deleteMock.mockRejectedValue(new Error("fallo"))
    renderHistory()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole("button", { name: "Borrar" }))

    expect(
      await screen.findByText(
        "No se pudo borrar la medición. Inténtalo de nuevo."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: editName("2026-10-11") })
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.5
  it("mientras borra, 'Borrar' está deshabilitado y un segundo clic no envía otro borrado", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OLDER, NEWER])
    deleteMock.mockReturnValue(new Promise(() => {}))
    renderHistory()
    const dialog = await openDialog(user)

    const confirm = within(dialog).getByRole("button", { name: "Borrar" })
    await user.click(confirm)
    await waitFor(() => expect(confirm).toBeDisabled())
    await user.click(confirm)

    expect(deleteMock).toHaveBeenCalledTimes(1)
  })
})

// --- Spec 011: medición sospechosa ---

// La prop `suspiciousDate` la crea el implementer (plan §3.4); se tipa aquí
// para que el archivo compile antes de que exista.
const HistoryWithMark = MetricsHistory as unknown as (props: {
  metrics: BodyMetric[]
  weightUnit: WeightUnit
  toDisplayWeight: (kg: number) => number
  suspiciousDate?: string | null
}) => React.JSX.Element

const JUMP_UP = [
  metric("2026-10-01", 80),
  metric("2026-10-06", 80),
  metric("2026-10-11", 98),
]

function renderMarked(
  metrics: BodyMetric[],
  suspiciousDate: string | null,
  weightUnit: WeightUnit = "kg"
) {
  const toDisplayWeight = (kg: number) =>
    weightUnit === "lb" ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <HistoryWithMark
        metrics={metrics}
        weightUnit={weightUnit}
        toDisplayWeight={toDisplayWeight}
        suspiciousDate={suspiciousDate}
      />
    </QueryClientProvider>
  )
}

function rowOf(iso: string) {
  return screen
    .getAllByRole("row")
    .find(
      (row) =>
        row.querySelector("th, td")?.textContent?.trim() === formatDate(iso)
    ) as HTMLElement
}

describe("MetricsHistory - medición sospechosa", () => {
  // SDD: 011 REQ-009 AC-009.1
  it("marca con 'Revisa este peso' solo la fila de la fecha sospechosa", () => {
    renderMarked(JUMP_UP, "2026-10-11")

    const mark = within(rowOf("2026-10-11")).getByText("Revisa este peso")
    expect(mark.closest('[data-tone="warn"]')).not.toBeNull()
    expect(
      within(rowOf("2026-10-01")).queryByText("Revisa este peso")
    ).not.toBeInTheDocument()
    expect(
      within(rowOf("2026-10-06")).queryByText("Revisa este peso")
    ).not.toBeInTheDocument()
    expect(screen.getAllByText("Revisa este peso")).toHaveLength(1)
  })

  // SDD: 011 REQ-009 AC-009.5
  it("una fila sin peso no lleva la marca aunque sea la fecha sospechosa", () => {
    // Control positivo: con peso en la fila sospechosa la marca sí aparece.
    const first = renderMarked(JUMP_UP, "2026-10-11")
    expect(screen.getAllByText("Revisa este peso")).toHaveLength(1)
    first.unmount()

    renderMarked([...JUMP_UP, metric("2026-10-09", null, 20)], "2026-10-09")

    expect(screen.queryByText("Revisa este peso")).not.toBeInTheDocument()
  })

  // SDD: 011 REQ-009 AC-009.8
  it("con el peso en lb la fila sospechosa también lleva la marca", () => {
    renderMarked(JUMP_UP, "2026-10-11", "lb")

    expect(
      within(rowOf("2026-10-11")).getByText("Revisa este peso")
    ).toBeInTheDocument()
  })

  // SDD: 011 REQ-009 AC-009.9
  it("la fila marcada conserva los botones de corregir y borrar", () => {
    renderMarked(JUMP_UP, "2026-10-11")

    const row = rowOf("2026-10-11")
    // Control positivo: la fila es la marcada.
    expect(within(row).getByText("Revisa este peso")).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: editName("2026-10-11") })
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: deleteName("2026-10-11") })
    ).toBeInTheDocument()
  })

  // SDD: 011 REQ-009 AC-009.6
  it("sin fecha sospechosa ninguna fila lleva la marca", () => {
    // Control positivo: la misma lista con fecha sospechosa sí lleva la marca.
    const first = renderMarked(JUMP_UP, "2026-10-11")
    expect(screen.getAllByText("Revisa este peso")).toHaveLength(1)
    first.unmount()

    renderMarked(JUMP_UP, null)

    expect(screen.queryByText("Revisa este peso")).not.toBeInTheDocument()
  })
})

// --- Spec 013: el aviso de error de borrado desaparece cuando deja de aplicar ---

const DELETE_FAILED = "No se pudo borrar la medición. Inténtalo de nuevo."

// Sin arnés: la lista que recibe el Historial la controla el test, para poder
// mantener la misma referencia o cambiarla con `rerender`.
function renderStatic(metrics: BodyMetric[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const toDisplayWeight = (kg: number) => kg
  const ui = (list: BodyMetric[]) => (
    <QueryClientProvider client={queryClient}>
      <MetricsHistory
        metrics={list}
        weightUnit="kg"
        toDisplayWeight={toDisplayWeight}
      />
    </QueryClientProvider>
  )
  const view = render(ui(metrics))
  return { rerenderWith: (list: BodyMetric[]) => view.rerender(ui(list)) }
}

// Provoca un borrado fallido de la medición `iso` y espera el aviso.
async function failDelete(user: User, iso: string) {
  deleteMock.mockRejectedValue(new Error("fallo"))
  await user.click(await screen.findByRole("button", { name: deleteName(iso) }))
  const dialog = await screen.findByRole("dialog")
  await user.click(within(dialog).getByRole("button", { name: "Borrar" }))
  expect(await screen.findByText(DELETE_FAILED)).toBeInTheDocument()
}

describe("MetricsHistory - aviso de borrado fallido (spec 013)", () => {
  // SDD: 013 REQ-005 AC-005.1
  it("al pulsar Corregir en otra fila el aviso deja de verse", async () => {
    const user = userEvent.setup()
    renderStatic([OLDER, NEWER])
    await failDelete(user, "2026-10-11")

    await user.click(screen.getByRole("button", { name: editName("2026-10-05") }))

    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
  })

  // SDD: 013 REQ-005 AC-005.2
  it("si la lista gana una medición nueva el aviso deja de verse", async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderStatic([OLDER, NEWER])
    await failDelete(user, "2026-10-11")

    rerenderWith([OLDER, NEWER, metric("2026-10-12", 77)])

    expect(
      await screen.findByRole("button", {
      name: editName("2026-10-12"),
      hidden: true,
    })
    ).toBeInTheDocument()
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
  })

  // SDD: 013 REQ-005 AC-005.2
  it("si la medición que no se pudo borrar ya no está en la lista el aviso deja de verse", async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderStatic([OLDER, NEWER])
    await failDelete(user, "2026-10-11")

    rerenderWith([OLDER])

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: editName("2026-10-11") })
      ).not.toBeInTheDocument()
    )
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
  })

  // SDD: 013 REQ-005 AC-005.3
  it("al pulsar Borrar en otra fila el aviso deja de verse y se abre el diálogo", async () => {
    const user = userEvent.setup()
    renderStatic([OLDER, NEWER])
    await failDelete(user, "2026-10-11")

    await user.click(screen.getByRole("button", { name: deleteName("2026-10-05") }))

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText(
        `¿Borrar la medición del ${formatDate("2026-10-05")}?`
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
  })

  // SDD: 013 REQ-005 AC-005.4
  it("al pulsar Mostrar más con la misma lista el aviso sigue visible", async () => {
    const user = userEvent.setup()
    renderStatic(manyMetrics(15))
    await failDelete(user, "2026-10-12")
    expect(editButtons()).toHaveLength(10)

    await user.click(showMore()!)

    expect(editButtons()).toHaveLength(15)
    expect(screen.getByText(DELETE_FAILED)).toBeInTheDocument()
  })

  // SDD: 013 NFR-001
  it("si la lista cambia mientras el borrado está en curso y falla, el aviso se ve", async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderStatic([OLDER, NEWER])
    let rejectDelete: (e: Error) => void = () => {}
    deleteMock.mockReturnValue(
      new Promise<void>((_, reject) => {
        rejectDelete = reject
      })
    )
    await user.click(
      await screen.findByRole("button", { name: deleteName("2026-10-11") })
    )
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Borrar" }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))

    // La lista cambia (p. ej. refetch) con la petición todavía en curso.
    rerenderWith([OLDER, NEWER, metric("2026-10-12", 77)])
    await screen.findByRole("button", {
      name: editName("2026-10-12"),
      hidden: true,
    })
    rejectDelete(new Error("fallo"))

    expect(await screen.findByText(DELETE_FAILED)).toBeInTheDocument()
  })
})

// --------------------------------------------------------------------------
// Spec 020, REQ-003: el Historial se despliega hasta la fecha pedida (`reveal`)
// --------------------------------------------------------------------------

// Como renderStatic, pero el test controla también la petición `reveal`.
function renderRevealing(metrics: BodyMetric[], reveal: RevealRequest | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const ui = (list: BodyMetric[], request: RevealRequest | null) => (
    <QueryClientProvider client={queryClient}>
      <MetricsHistory
        metrics={list}
        weightUnit="kg"
        toDisplayWeight={(kg) => kg}
        reveal={request}
      />
    </QueryClientProvider>
  )
  const view = render(ui(metrics, reveal))
  return {
    rerenderWith: (list: BodyMetric[], request: RevealRequest | null) =>
      view.rerender(ui(list, request)),
  }
}

const bodyRows = () => screen.getAllByRole("row").slice(1)

describe("MetricsHistory - reveal (spec 020)", () => {
  // SDD: 020 REQ-003 AC-003.1
  it("despliega de 10 en 10 hasta que la fecha pedida es visible", async () => {
    // manyMetrics(26) llega hasta el 2026-09-17; la fila 26 es la última.
    const list = manyMetrics(26)
    const target = list[25].recorded_at
    renderRevealing(list, { date: target, seq: 1 })

    await waitFor(() => expect(bodyRows()).toHaveLength(26))
    expect(bodyRows()[25]).toHaveTextContent(formatDate(target))
    expect(showMore()).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-003 AC-003.1
  it("una petición cuya fecha aún no está en la lista queda pendiente y se atiende cuando llega", async () => {
    const list = manyMetrics(25)
    const arrived = [...list, metric("2026-08-01", 77)]
    const { rerenderWith } = renderRevealing(list, { date: "2026-08-01", seq: 1 })
    await screen.findAllByRole("row")

    // La fecha no está: sigue en 10 filas, con 'Mostrar más'.
    expect(bodyRows()).toHaveLength(10)
    expect(showMore()).toBeInTheDocument()

    rerenderWith(arrived, { date: "2026-08-01", seq: 1 })

    await waitFor(() => expect(bodyRows()).toHaveLength(26))
    expect(showMore()).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-003 AC-003.3
  it("sin petición, o con la fecha ya visible, deja 10 filas", async () => {
    const list = manyMetrics(25)
    const { rerenderWith } = renderRevealing(list, null)
    await screen.findAllByRole("row")
    expect(bodyRows()).toHaveLength(10)

    rerenderWith(list, { date: list[0].recorded_at, seq: 1 })

    await waitFor(() => expect(bodyRows()).toHaveLength(10))
    expect(showMore()).toBeInTheDocument()
  })

  // SDD: 020 REQ-003 AC-003.4
  it("no pliega el Historial que el usuario ya desplegó con 'Mostrar más'", async () => {
    const user = userEvent.setup()
    const list = manyMetrics(25)
    const { rerenderWith } = renderRevealing(list, null)
    await screen.findAllByRole("row")
    await user.click(showMore() as HTMLElement)
    await user.click(showMore() as HTMLElement)
    expect(bodyRows()).toHaveLength(25)

    rerenderWith(list, { date: list[0].recorded_at, seq: 1 })

    await waitFor(() => expect(bodyRows()).toHaveLength(25))
  })

  // SDD: 020 REQ-003 AC-003.2
  it("una petición ya atendida no se repite; otra con la misma fecha y distinto seq sí", async () => {
    // 35 mediciones: el 2026-09-27 es la fila 16, así que pide 20 filas.
    const list = manyMetrics(35)
    const target = list[15].recorded_at
    const { rerenderWith } = renderRevealing(list, { date: target, seq: 1 })
    await waitFor(() => expect(bodyRows()).toHaveLength(20))

    // Llegan 10 mediciones más recientes: la fecha baja a la fila 26.
    const newer = Array.from({ length: 10 }, (_, i) =>
      metric(`2026-10-${String(13 + i).padStart(2, "0")}`, 79)
    )
    const longer = [...newer, ...list]

    // Mismo seq: ya se atendió, no se vuelve a desplegar.
    rerenderWith(longer, { date: target, seq: 1 })
    await waitFor(() => expect(bodyRows()).toHaveLength(20))

    // Mismo fecha, otro seq: es una petición nueva y despliega hasta 30.
    rerenderWith(longer, { date: target, seq: 2 })
    await waitFor(() => expect(bodyRows()).toHaveLength(30))
    expect(showMore()).toBeInTheDocument()
  })
})
