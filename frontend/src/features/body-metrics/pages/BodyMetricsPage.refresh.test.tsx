// Test de PÁGINA de Métricas (spec 020): aviso con «Reintentar» si falla la
// relectura tras registrar una medición (REQ-001) y despliegue del Historial
// hasta la medición recién registrada (REQ-003). La red se simula en api.ts
// (vi.mock); el análisis de IA y el gráfico se sustituyen por stubs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import { createBodyMetric, listBodyMetrics } from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { getProfile } from "@/features/profile/api"
import { ApiError } from "@/lib/apiClient"
import type { BodyMetric } from "@/features/body-metrics/types"
import { BodyMetricsPage } from "./BodyMetricsPage"
import { makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))
vi.mock("@/features/body-metrics/api", () => ({
  listBodyMetrics: vi.fn(),
  createBodyMetric: vi.fn(),
  updateBodyMetric: vi.fn(),
  deleteBodyMetric: vi.fn(),
  analyzeBodyMetrics: vi.fn(),
}))
vi.mock("@/features/body-metrics/components/TrendChart", () => ({
  TrendChart: () => <div>Gráfico</div>,
}))
vi.mock("@/features/body-metrics/components/ProgressAnalysis", () => ({
  ProgressAnalysis: () => <div>Análisis</div>,
}))

const getProfileMock = vi.mocked(getProfile)
const listMock = vi.mocked(listBodyMetrics)
const createMock = vi.mocked(createBodyMetric)

type User = ReturnType<typeof userEvent.setup>

const METRICS_NOTICE =
  "Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla."
const SAVE_FAILED = "No se pudo guardar la medición. Inténtalo de nuevo."

function metric(recorded_at: string, weight: number | null = 80): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

// n mediciones, una por día hacia atrás desde `start` (YYYY-MM-DD, UTC).
function dailyMetrics(n: number, start: string): BodyMetric[] {
  const [y, m, d] = start.split("-").map(Number)
  return Array.from({ length: n }, (_, i) =>
    metric(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10))
  )
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/body-metrics"]}>
        <Routes>
          <Route path="/body-metrics" element={<BodyMetricsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const bodyRows = () => screen.getAllByRole("row").slice(1)
const showMore = () => screen.queryByRole("button", { name: "Mostrar más" })
const notice = () => screen.queryByText(METRICS_NOTICE)
const retryButton = () => screen.getByRole("button", { name: "Reintentar" })

async function findEnabledOpenButton() {
  const button = await screen.findByRole("button", { name: "Registrar medición" })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

// Abre el diálogo, rellena fecha y peso y pulsa Guardar (sin esperar el cierre).
async function fillAndSave(user: User, date: string, weight = "80") {
  await user.click(await findEnabledOpenButton())
  const dialog = await screen.findByRole("dialog", { name: "Registrar medición" })
  fireEvent.change(within(dialog).getByLabelText("Fecha"), { target: { value: date } })
  await user.type(within(dialog).getByLabelText("Peso (kg)"), weight)
  await user.click(within(dialog).getByRole("button", { name: "Guardar" }))
}

async function register(user: User, date: string, weight = "80") {
  await fillAndSave(user, date, weight)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
}

beforeEach(() => {
  // Lunes 12 de octubre de 2026; solo se falsea Date.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  getProfileMock.mockReset()
  listMock.mockReset()
  createMock.mockReset()
  getProfileMock.mockResolvedValue(
    makeProfileResponse({}, { weight_unit: "kg", weight: 80, height_cm: 175, goal: "lose" })
  )
  createMock.mockResolvedValue(metric("2026-10-05"))
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BodyMetricsPage - relectura fallida tras registrar (REQ-001)", () => {
  const m11 = metric("2026-10-11", 80)
  const m05 = metric("2026-10-05", 80)
  const m01 = metric("2026-10-01", 81)

  // La lectura inicial va bien y las siguientes fallan.
  function listFailsAfterFirst() {
    listMock
      .mockResolvedValueOnce([m11, m01])
      .mockRejectedValue(new ApiError(500, "Error del servidor"))
  }

  // SDD: 020 REQ-001 AC-001.1
  it("si la relectura de mediciones falla, cierra el diálogo y muestra el aviso con 'Reintentar'", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()

    await register(user, "2026-10-05")

    expect(await screen.findByText(METRICS_NOTICE)).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument()
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 020 REQ-001 AC-001.2
  it("sigue mostrando el Historial, los indicadores y el botón 'Registrar medición'", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()

    await register(user, "2026-10-05")
    await screen.findByText(METRICS_NOTICE)

    expect(screen.getByRole("heading", { name: "Historial" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Constancia" })).toBeInTheDocument()
    const rows = bodyRows()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(formatDate("2026-10-11"))
    expect(rows[1]).toHaveTextContent(formatDate("2026-10-01"))
    expect(screen.getByRole("button", { name: "Registrar medición" })).toBeEnabled()
    expect(screen.queryByText(/^Error \(/)).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-001 AC-001.3
  it("'Reintentar' con el servidor ya sano quita el aviso y muestra las tres filas", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await register(user, "2026-10-05")
    await screen.findByText(METRICS_NOTICE)
    listMock.mockReset()
    listMock.mockResolvedValue([m11, m05, m01])

    await user.click(retryButton())

    await waitFor(() => expect(notice()).not.toBeInTheDocument())
    await waitFor(() => expect(bodyRows()).toHaveLength(3))
    const rows = bodyRows()
    expect(rows[0]).toHaveTextContent(formatDate("2026-10-11"))
    expect(rows[1]).toHaveTextContent(formatDate("2026-10-05"))
    expect(rows[2]).toHaveTextContent(formatDate("2026-10-01"))
    // Reintentar solo relee: no vuelve a registrar.
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 020 REQ-001 AC-001.4
  it("'Reintentar' con el servidor aún fallando deja el aviso y los datos anteriores", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await register(user, "2026-10-05")
    await screen.findByText(METRICS_NOTICE)
    const callsBefore = listMock.mock.calls.length

    await user.click(retryButton())

    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore))
    await waitFor(() => expect(retryButton()).toBeEnabled())
    expect(notice()).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Registrar medición" })).toBeEnabled()
  })

  // SDD: 020 REQ-001 AC-001.5
  it("si falla la relectura del perfil (y la de mediciones va bien) también se ve el aviso", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValueOnce([m11, m01]).mockResolvedValue([m11, m05, m01])
    getProfileMock
      .mockResolvedValueOnce(
        makeProfileResponse({}, { weight_unit: "kg", weight: 80, height_cm: 175, goal: "lose" })
      )
      .mockRejectedValue(new ApiError(500, "Error del servidor"))
    renderPage()

    await register(user, "2026-10-05")

    expect(await screen.findByText(METRICS_NOTICE)).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
  })

  // SDD: 020 REQ-001 AC-001.6
  it("el aviso tiene el rol alert y el botón se encuentra por su nombre", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()

    await register(user, "2026-10-05")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(METRICS_NOTICE)
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })

  // SDD: 020 REQ-001 AC-001.7
  it("si las relecturas van bien, no se ve el aviso", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValueOnce([m11, m01]).mockResolvedValue([m11, m05, m01])
    renderPage()

    await register(user, "2026-10-05")

    await waitFor(() => expect(bodyRows()).toHaveLength(3))
    expect(notice()).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-001 AC-001.8
  it("el aviso sigue visible tras 60 segundos", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await register(user, "2026-10-05")
    await screen.findByText(METRICS_NOTICE)

    // A partir de aquí también los temporizadores son falsos.
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    })
    vi.setSystemTime(new Date(2026, 9, 12, 12))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(notice()).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
  })

  // SDD: 020 REQ-001 AC-001.9
  it("el aviso está después del botón 'Registrar medición' y antes del Historial", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await register(user, "2026-10-05")

    const alert = await screen.findByRole("alert")

    const button = screen.getByRole("button", { name: "Registrar medición" })
    const history = screen.getByRole("heading", { name: "Historial" })
    expect(
      button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      alert.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe("BodyMetricsPage - Historial hasta la medición registrada (REQ-003)", () => {
  // SDD: 020 REQ-003 AC-003.1
  it("una fecha antigua oculta tras 'Mostrar más' queda visible: 26 filas y la última es la nueva", async () => {
    const user = userEvent.setup()
    const initial = dailyMetrics(25, "2026-10-11") // hasta 2026-09-17
    const added = metric("2026-09-01", 80)
    listMock.mockResolvedValueOnce(initial).mockResolvedValue([...initial, added])
    renderPage()
    await screen.findByRole("heading", { name: "Historial" })
    expect(bodyRows()).toHaveLength(10)

    await register(user, "2026-09-01")

    await waitFor(() => expect(bodyRows()).toHaveLength(26))
    expect(bodyRows()[25]).toHaveTextContent(formatDate("2026-09-01"))
    expect(showMore()).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-003 AC-003.2
  it("despliega solo los bloques necesarios: 20 filas, con la del 2026-09-25 incluida", async () => {
    const user = userEvent.setup()
    const initial = dailyMetrics(35, "2026-10-11") // hasta 2026-09-07
    const updated = initial.map((m) =>
      m.recorded_at === "2026-09-25" ? { ...m, weight: 79 } : m
    )
    listMock.mockResolvedValueOnce(initial).mockResolvedValue(updated)
    renderPage()
    await screen.findByRole("heading", { name: "Historial" })

    await register(user, "2026-09-25", "79")

    await waitFor(() => expect(bodyRows()).toHaveLength(20))
    expect(
      bodyRows().some((row) => row.textContent?.includes(formatDate("2026-09-25")))
    ).toBe(true)
    expect(showMore()).toBeInTheDocument()
  })

  // SDD: 020 REQ-003 AC-003.3
  it("si la fila nueva ya es visible (la primera), se quedan 10 filas y 'Mostrar más'", async () => {
    const user = userEvent.setup()
    const initial = dailyMetrics(25, "2026-10-11")
    listMock
      .mockResolvedValueOnce(initial)
      .mockResolvedValue([metric("2026-10-12", 80), ...initial])
    renderPage()
    await screen.findByRole("heading", { name: "Historial" })

    await register(user, "2026-10-12")

    await waitFor(() =>
      expect(bodyRows()[0]).toHaveTextContent(formatDate("2026-10-12"))
    )
    expect(bodyRows()).toHaveLength(10)
    expect(showMore()).toBeInTheDocument()
  })

  // SDD: 020 REQ-003 AC-003.4
  it("con el Historial ya desplegado (25 filas) no se pliega: quedan 26", async () => {
    const user = userEvent.setup()
    const initial = dailyMetrics(25, "2026-10-11")
    listMock
      .mockResolvedValueOnce(initial)
      .mockResolvedValue([metric("2026-10-12", 80), ...initial])
    renderPage()
    await screen.findByRole("heading", { name: "Historial" })
    await user.click(showMore() as HTMLElement)
    await user.click(showMore() as HTMLElement)
    expect(bodyRows()).toHaveLength(25)

    await register(user, "2026-10-12")

    await waitFor(() => expect(bodyRows()).toHaveLength(26))
  })

  // SDD: 020 REQ-003 AC-003.5
  it("si el registro falla, el Historial sigue con 10 filas", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue(dailyMetrics(25, "2026-10-11"))
    createMock.mockRejectedValue(new ApiError(500, "Error del servidor"))
    renderPage()
    await screen.findByRole("heading", { name: "Historial" })

    await fillAndSave(user, "2026-09-01")

    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument()
    const rows = screen.getAllByRole("row", { hidden: true }).slice(1)
    expect(rows).toHaveLength(10)
  })
})
