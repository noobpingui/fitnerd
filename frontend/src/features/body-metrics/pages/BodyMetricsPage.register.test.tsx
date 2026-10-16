// Test de PÁGINA del registro de mediciones con fecha desde Métricas (spec
// 016): botón, textos, orden del historial, recálculo de indicadores y
// propagación al perfil y al home sin recargar. La red se simula en api.ts
// (vi.mock). El análisis de IA se sustituye por un stub y el gráfico por otro
// que pinta las fechas recibidas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import { createBodyMetric, listBodyMetrics } from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { HomePage } from "@/features/home/pages/HomePage"
import { getProfile } from "@/features/profile/api"
import { ProfilePage } from "@/features/profile/pages/ProfilePage"
import type { BodyMetric } from "@/features/body-metrics/types"
import { BodyMetricsPage } from "./BodyMetricsPage"
import { makePendingResponse, makeProfileResponse } from "@/test/profileFixtures"

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
vi.mock("@/features/auth/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))
vi.mock("@/features/body-metrics/components/TrendChart", () => ({
  TrendChart: ({ metrics }: { metrics: { recorded_at: string }[] }) => (
    <ul aria-label="Puntos del gráfico">
      {metrics.map((m) => (
        <li key={m.recorded_at}>{m.recorded_at}</li>
      ))}
    </ul>
  ),
}))
vi.mock("@/features/body-metrics/components/ProgressAnalysis", () => ({
  ProgressAnalysis: () => <div>Análisis</div>,
}))

const getProfileMock = vi.mocked(getProfile)
const listMock = vi.mocked(listBodyMetrics)
const createMock = vi.mocked(createBodyMetric)
const getCurrentUserMock = vi.mocked(getCurrentUser)

type User = ReturnType<typeof userEvent.setup>

function metric(
  recorded_at: string,
  weight: number | null,
  fat: number | null = null
): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: fat,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

function renderPage(extra?: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/body-metrics"]}>
        {extra}
        <Routes>
          <Route path="/body-metrics" element={<BodyMetricsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const links = (
  <nav>
    <Link to="/profile">Ir a Perfil</Link>
    <Link to="/home">Ir a Home</Link>
  </nav>
)

function kpi(label: string) {
  const labelNode = screen.getByText(label, { selector: "span" })
  return within(labelNode.parentElement as HTMLElement)
}

const stat = kpi

const openButton = () => screen.getByRole("button", { name: "Registrar medición" })

// Abre el diálogo, rellena la fecha y los valores, guarda y espera a que se
// cierre.
async function register(
  user: User,
  values: { date: string; weight?: string; fat?: string }
) {
  await user.click(await screen.findByRole("button", { name: "Registrar medición" }))
  const dialog = await screen.findByRole("dialog", { name: "Registrar medición" })
  fireEvent.change(within(dialog).getByLabelText("Fecha"), {
    target: { value: values.date },
  })
  if (values.weight) {
    await user.type(within(dialog).getByLabelText("Peso (kg)"), values.weight)
  }
  if (values.fat) {
    await user.type(within(dialog).getByLabelText("% Grasa corporal"), values.fat)
  }
  await user.click(within(dialog).getByRole("button", { name: "Guardar" }))
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  )
}

beforeEach(() => {
  // Lunes 12 de octubre de 2026; solo se falsea Date.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  getProfileMock.mockReset()
  listMock.mockReset()
  createMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockResolvedValue({
    email: "ana@example.com",
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  getProfileMock.mockResolvedValue(
    makeProfileResponse({}, { weight_unit: "kg", weight: 80, height_cm: 175, goal: "lose" })
  )
  createMock.mockResolvedValue(metric("2026-10-05", 80))
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BodyMetricsPage - botón y textos del registro", () => {
  // SDD: 016 REQ-001 AC-001.1
  it("con mediciones muestra el botón 'Registrar medición'", async () => {
    listMock.mockResolvedValue([metric("2026-10-11", 80)])
    renderPage()

    expect(
      await screen.findByRole("button", { name: "Registrar medición" })
    ).toBeInTheDocument()
  })

  // SDD: 016 REQ-001 AC-001.2
  it("sin mediciones muestra el estado vacío y el botón", async () => {
    listMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText("Aún no tienes mediciones")).toBeInTheDocument()
    expect(openButton()).toBeInTheDocument()
  })

  // SDD: 016 REQ-001 AC-001.7
  it("sin perfil el campo de peso del diálogo se llama 'Peso (kg)'", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse())
    listMock.mockResolvedValue([])
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Registrar medición" }))

    expect(await screen.findByLabelText("Peso (kg)")).toBeInTheDocument()
  })

  // SDD: 016 REQ-001 AC-001.5
  it("cancelar cierra el diálogo, no envía nada y el historial no cambia", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([metric("2026-10-11", 80)])
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Registrar medición" }))
    const dialog = await screen.findByRole("dialog", { name: "Registrar medición" })
    await user.type(within(dialog).getByLabelText("Peso (kg)"), "75")

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(createMock).not.toHaveBeenCalled()
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1)
  })

  // SDD: 016 REQ-010 AC-010.1
  it("muestra el subtítulo nuevo con mediciones", async () => {
    listMock.mockResolvedValue([metric("2026-10-11", 80)])
    renderPage()

    expect(
      await screen.findByText(
        "Tu progreso a partir de las mediciones que registras aquí o en tu perfil."
      )
    ).toBeInTheDocument()
  })

  // SDD: 016 REQ-010 AC-010.2
  it("el estado vacío tiene el texto nuevo, el enlace al perfil y el botón", async () => {
    listMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText("Aún no tienes mediciones")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Registra tu peso y, si lo conoces, tu composición corporal aquí o desde tu perfil. Aquí verás cómo evolucionan."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ir a mi perfil" })).toBeInTheDocument()
    expect(openButton()).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - tras registrar con fecha pasada", () => {
  // SDD: 016 REQ-003 AC-003.4
  it("cierra el formulario y el historial queda ordenado por fecha", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 80)
    const m05 = metric("2026-10-05", 79)
    const m01 = metric("2026-10-01", 81)
    listMock.mockResolvedValueOnce([m11, m01]).mockResolvedValue([m11, m05, m01])
    renderPage()

    await register(user, { date: "2026-10-05", weight: "79" })

    await waitFor(() => expect(screen.getAllByRole("row").slice(1)).toHaveLength(3))
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent(formatDate("2026-10-11"))
    expect(rows[1]).toHaveTextContent(formatDate("2026-10-05"))
    expect(rows[2]).toHaveTextContent(formatDate("2026-10-01"))
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 016 REQ-003 AC-003.9
  it("desde el estado vacío, desaparece y se muestran indicadores e historial", async () => {
    const user = userEvent.setup()
    listMock
      .mockResolvedValueOnce([])
      .mockResolvedValue([metric("2026-10-05", 80)])
    renderPage()
    await screen.findByText("Aún no tienes mediciones")

    await register(user, { date: "2026-10-05", weight: "80" })

    await waitFor(() =>
      expect(screen.queryByText("Aún no tienes mediciones")).not.toBeInTheDocument()
    )
    expect(await screen.findByRole("heading", { name: "Historial" })).toBeInTheDocument()
    expect(kpi("Peso").getByText("80 kg")).toBeInTheDocument()
  })

  // SDD: 016 REQ-007 AC-007.1
  it("la tarjeta 'Ritmo' pasa de 'Faltan registros' a mostrar un ritmo", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 80)
    const m01 = metric("2026-10-01", 81)
    const m06 = metric("2026-10-06", 80.5)
    listMock
      .mockResolvedValueOnce([m11])
      .mockResolvedValueOnce([m01, m11])
      .mockResolvedValue([m01, m06, m11])
    renderPage()
    expect(
      await screen.findByText("Faltan registros para calcularlo")
    ).toBeInTheDocument()

    await register(user, { date: "2026-10-01", weight: "81" })
    await register(user, { date: "2026-10-06", weight: "80.5" })

    await waitFor(() =>
      expect(
        screen.queryByText("Faltan registros para calcularlo")
      ).not.toBeInTheDocument()
    )
    expect(kpi("Ritmo").getByText(/kg\/sem/)).toBeInTheDocument()
  })

  // SDD: 016 REQ-007 AC-007.3
  it("la racha pasa de '1 semana' a '3 semanas'", async () => {
    const user = userEvent.setup()
    const m12 = metric("2026-10-12", 80)
    const m28 = metric("2026-09-28", 81)
    const m07 = metric("2026-10-07", 80.5)
    listMock.mockResolvedValueOnce([m28, m12]).mockResolvedValue([m28, m07, m12])
    renderPage()
    await screen.findByRole("heading", { name: "Constancia" })
    expect(stat("Racha").getByText("1 semana")).toBeInTheDocument()

    await register(user, { date: "2026-10-07", weight: "80.5" })

    await waitFor(() =>
      expect(stat("Racha").getByText("3 semanas")).toBeInTheDocument()
    )
  })

  // SDD: 016 REQ-007 AC-007.4
  it("'Último registro' no cambia y 'Últimos 30 días' suma uno", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 78)
    const m05 = metric("2026-10-05", 80)
    listMock.mockResolvedValueOnce([m11]).mockResolvedValue([m05, m11])
    renderPage()
    await screen.findByRole("heading", { name: "Constancia" })
    expect(stat("Últimos 30 días").getByText("1 registro")).toBeInTheDocument()

    await register(user, { date: "2026-10-05", weight: "80" })

    await waitFor(() =>
      expect(stat("Últimos 30 días").getByText("2 registros")).toBeInTheDocument()
    )
    expect(
      stat("Último registro").getByText(formatDate("2026-10-11"))
    ).toBeInTheDocument()
  })

  // SDD: 016 REQ-007 AC-007.5
  it("el KPI 'Peso' sigue mostrando el peso de la medición más reciente", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 78)
    const m05 = metric("2026-10-05", 80)
    listMock.mockResolvedValueOnce([m11]).mockResolvedValue([m05, m11])
    renderPage()
    await screen.findByRole("heading", { name: "Constancia" })

    await register(user, { date: "2026-10-05", weight: "80" })

    await waitFor(() =>
      expect(stat("Últimos 30 días").getByText("2 registros")).toBeInTheDocument()
    )
    expect(kpi("Peso").getByText("78 kg")).toBeInTheDocument()
  })

  // SDD: 016 REQ-007 AC-007.6
  it("la composición corporal dice 'Según tu medición del' con la fecha de la grasa registrada", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 78)
    const m05 = metric("2026-10-05", null, 20)
    listMock.mockResolvedValueOnce([m11]).mockResolvedValue([m05, m11])
    renderPage()
    await screen.findByRole("heading", { name: "Composición corporal" })

    await register(user, { date: "2026-10-05", fat: "20" })

    expect(
      await screen.findByText(`Según tu medición del ${formatDate("2026-10-05")}.`)
    ).toBeInTheDocument()
  })

  // SDD: 016 REQ-007 AC-007.7
  it("el gráfico incluye un punto en la fecha registrada", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 78)
    const m05 = metric("2026-10-05", 80)
    listMock.mockResolvedValueOnce([m11]).mockResolvedValue([m05, m11])
    renderPage()
    const chart = await screen.findByRole("list", { name: "Puntos del gráfico" })
    expect(within(chart).queryByText("2026-10-05")).not.toBeInTheDocument()

    await register(user, { date: "2026-10-05", weight: "80" })

    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Puntos del gráfico" })).getByText(
          "2026-10-05"
        )
      ).toBeInTheDocument()
    )
  })
})

describe("BodyMetricsPage - otras pantallas tras registrar (REQ-008)", () => {
  // SDD: 016 REQ-008 AC-008.1
  it("el campo 'Peso' del perfil muestra 77 sin recargar", async () => {
    const user = userEvent.setup()
    const m01 = metric("2026-10-01", 78)
    const m05 = metric("2026-10-05", 77)
    listMock.mockResolvedValueOnce([m01]).mockResolvedValue([m01, m05])
    getProfileMock
      .mockResolvedValueOnce(makeProfileResponse({}, { weight: 78, goal: "lose" }))
      .mockResolvedValue(makeProfileResponse({}, { weight: 77, goal: "lose" }))
    renderPage(links)
    await screen.findByRole("heading", { name: "Constancia" })

    await register(user, { date: "2026-10-05", weight: "77" })
    await user.click(screen.getByRole("link", { name: "Ir a Perfil" }))

    await screen.findByLabelText("Fecha de nacimiento")
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[]
    // cm, peso, grasa, músculo
    expect(inputs[1]).toHaveValue(77)
  })

  // SDD: 016 REQ-008 AC-008.2
  it("el home muestra 'Peso actual' con 77 kg sin recargar", async () => {
    const user = userEvent.setup()
    const m01 = metric("2026-10-01", 78)
    const m05 = metric("2026-10-05", 77)
    listMock.mockResolvedValueOnce([m01]).mockResolvedValue([m01, m05])
    getProfileMock
      .mockResolvedValueOnce(makeProfileResponse({}, { weight: 78, goal: "lose" }))
      .mockResolvedValue(makeProfileResponse({}, { weight: 77, goal: "lose" }))
    renderPage(links)
    await screen.findByRole("heading", { name: "Constancia" })

    await register(user, { date: "2026-10-05", weight: "77" })
    await user.click(screen.getByRole("link", { name: "Ir a Home" }))

    const label = await screen.findByText("Peso actual")
    await waitFor(() => expect(label.parentElement).toHaveTextContent("77 kg"))
  })

  // SDD: 016 REQ-008 AC-008.4
  it("registrar una fecha anterior a la última medición deja el perfil en 78", async () => {
    const user = userEvent.setup()
    const m11 = metric("2026-10-11", 78)
    const m05 = metric("2026-10-05", 80)
    listMock.mockResolvedValueOnce([m11]).mockResolvedValue([m05, m11])
    getProfileMock.mockResolvedValue(
      makeProfileResponse({}, { weight: 78, goal: "lose" })
    )
    renderPage(links)
    await screen.findByRole("heading", { name: "Constancia" })

    await register(user, { date: "2026-10-05", weight: "80" })
    await user.click(screen.getByRole("link", { name: "Ir a Perfil" }))

    await screen.findByLabelText("Fecha de nacimiento")
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[]
    expect(inputs[1]).toHaveValue(78)
  })
})
