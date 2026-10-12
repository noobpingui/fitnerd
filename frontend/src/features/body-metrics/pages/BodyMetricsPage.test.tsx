// Test de PÁGINA de Métricas (features 006 y 008): la unidad de peso y la meta
// salen del perfil del servidor, y el historial permite corregir y borrar
// mediciones. La red se simula en api.ts (vi.mock); el gráfico y el análisis
// de IA se sustituyen por stubs.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import {
  deleteBodyMetric,
  listBodyMetrics,
  updateBodyMetric,
} from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { HomePage } from "@/features/home/pages/HomePage"
import { getProfile } from "@/features/profile/api"
import { ProfilePage } from "@/features/profile/pages/ProfilePage"
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
vi.mock("@/features/auth/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))
vi.mock("@/features/body-metrics/components/TrendChart", () => ({
  TrendChart: () => <div>Gráfico</div>,
}))
vi.mock("@/features/body-metrics/components/ProgressAnalysis", () => ({
  ProgressAnalysis: () => <div>Análisis</div>,
}))

const getProfileMock = vi.mocked(getProfile)
const listMock = vi.mocked(listBodyMetrics)
const updateMock = vi.mocked(updateBodyMetric)
const deleteMock = vi.mocked(deleteBodyMetric)
const getCurrentUserMock = vi.mocked(getCurrentUser)

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

// Bajada constante de 0,5 kg por semana (en kg, como los guarda el backend):
// 0,64 % del peso por semana.
const METRICS = [
  metric("2026-09-20", 80),
  metric("2026-09-27", 79.5),
  metric("2026-10-04", 79),
  metric("2026-10-11", 78.5),
]

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

// La tarjeta de un KPI (Peso, Ritmo, % Grasa): se acota a ella porque desde
// la spec 008 el mismo texto también aparece en las filas del historial.
function kpi(label: string) {
  const labelNode = screen.getByText(label, { selector: "span" })
  return within(labelNode.parentElement as HTMLElement)
}

const editName = (iso: string) => `Corregir medición del ${formatDate(iso)}`
const deleteName = (iso: string) => `Borrar medición del ${formatDate(iso)}`

async function deleteMetric(user: ReturnType<typeof userEvent.setup>, iso: string) {
  await user.click(await screen.findByRole("button", { name: deleteName(iso) }))
  const dialog = await screen.findByRole("dialog")
  await user.click(within(dialog).getByRole("button", { name: "Borrar" }))
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  )
}

beforeEach(() => {
  getProfileMock.mockReset()
  listMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockResolvedValue({
    email: "ana@example.com",
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  listMock.mockResolvedValue(METRICS)
})

describe("BodyMetricsPage - perfil del servidor", () => {
  // SDD: REQ-012 AC-012.3
  it("muestra los pesos en lb si el perfil usa lb", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse({}, { weight_unit: "lb", weight: 173, goal: "lose_slow" })
    )
    renderPage()

    // 78,5 kg = 173,1 lb; el ritmo de -0,5 kg/sem = -1,1 lb/sem. Desde la
    // spec 008 el peso también sale en el historial, así que se acota a la
    // tarjeta del KPI "Peso" (el valor esperado no cambia).
    await waitFor(() =>
      expect(kpi("Peso").getByText(/173[.,]1 lb/)).toBeInTheDocument()
    )
    expect(screen.getByText(/1[.,]1 lb\/sem/)).toBeInTheDocument()
  })

  // SDD: REQ-012 AC-012.3
  it("compara el ritmo con la meta del perfil", async () => {
    // -0,64 %/sem: dentro del rango de "perder peso" (-1,0 a -0,5) pero más
    // rápido que el de "perder peso lentamente" (-0,5 a -0,25).
    getProfileMock.mockResolvedValue(
      makeProfileResponse({}, { weight_unit: "lb", weight: 173, goal: "lose_slow" })
    )
    renderPage()

    expect(await screen.findByText("Más rápido que tu meta")).toBeInTheDocument()
  })

  // SDD: REQ-012 AC-012.3
  it("con otra meta en el perfil, el mismo ritmo está en objetivo", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse({}, { weight_unit: "kg", weight: 78.5, goal: "lose" })
    )
    renderPage()

    expect(await screen.findByText("En ritmo con tu meta")).toBeInTheDocument()
    // Acotado al KPI "Peso" por la misma razón que arriba.
    expect(kpi("Peso").getByText(/78[.,]5 kg/)).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - historial", () => {
  beforeEach(() => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse({}, { weight_unit: "kg", weight: 78.5, goal: "lose" })
    )
  })

  // SDD: REQ-008 AC-008.6
  it("sin mediciones muestra el estado vacío y no la sección Historial", async () => {
    listMock.mockResolvedValue([])
    const { unmount } = renderPage()

    expect(await screen.findByText("Aún no tienes mediciones")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Historial" })
    ).not.toBeInTheDocument()

    // Contraste: con mediciones la sección sí aparece.
    unmount()
    listMock.mockResolvedValue(METRICS)
    renderPage()
    expect(await screen.findByRole("heading", { name: "Historial" })).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.7
  it("la sección Historial va después de 'Análisis del coach' y antes de 'Constancia'", async () => {
    renderPage()

    await screen.findByRole("heading", { name: "Historial" })
    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)

    const coach = titles.indexOf("Análisis del coach")
    const history = titles.indexOf("Historial")
    const consistency = titles.indexOf("Constancia")
    expect(coach).toBeGreaterThanOrEqual(0)
    expect(history).toBeGreaterThan(coach)
    expect(consistency).toBeGreaterThan(history)
  })

  // SDD: REQ-010 AC-010.6
  it("al borrar la única medición vuelve al estado vacío", async () => {
    const user = userEvent.setup()
    listMock
      .mockReset()
      .mockResolvedValueOnce([metric("2026-10-11", 78.5)])
      .mockResolvedValue([])
    deleteMock.mockResolvedValue(undefined)
    renderPage()

    await deleteMetric(user, "2026-10-11")

    expect(await screen.findByText("Aún no tienes mediciones")).toBeInTheDocument()
  })

  // SDD: REQ-011 AC-011.1
  it("al corregir la última medición a 78, el KPI 'Peso' muestra 78 kg sin recargar", async () => {
    const user = userEvent.setup()
    listMock
      .mockReset()
      .mockResolvedValueOnce(METRICS)
      .mockResolvedValue([...METRICS.slice(0, 3), metric("2026-10-11", 78)])
    updateMock.mockResolvedValue(metric("2026-10-11", 78))
    renderPage()
    await waitFor(() =>
      expect(kpi("Peso").getByText(/78[.,]5 kg/)).toBeInTheDocument()
    )

    await user.click(await screen.findByRole("button", { name: editName("2026-10-11") }))
    const weight = await screen.findByLabelText("Peso (kg)")
    await user.clear(weight)
    await user.type(weight, "78")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(kpi("Peso").getByText("78 kg")).toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith("2026-10-11", {
      weight: 78,
      body_fat_percentage: null,
      muscle_mass_percentage: null,
    })
  })
})

describe("BodyMetricsPage - las demás pantallas reflejan los cambios sin recargar", () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  const links = (
    <nav>
      <Link to="/profile">Ir a Perfil</Link>
      <Link to="/home">Ir a Home</Link>
    </nav>
  )

  // Caso de AC-005.3: mediciones del 5 (80 kg) y del 11 (78,5 kg), perfil en
  // kg con 78,5; el servidor, al borrar la del 11, deja el perfil en 80.
  function arrangeDeleteOfLatest() {
    const older = metric("2026-10-05", 80, 22)
    const latest = metric("2026-10-11", 78.5, 20)
    listMock.mockResolvedValueOnce([older, latest]).mockResolvedValue([older])
    getProfileMock
      .mockResolvedValueOnce(makeProfileResponse({}, { weight: 78.5, goal: "lose" }))
      .mockResolvedValue(makeProfileResponse({}, { weight: 80, goal: "lose" }))
    deleteMock.mockResolvedValue(undefined)
  }

  // SDD: REQ-011 AC-011.2
  it("tras borrar la última medición, el campo 'Peso' del perfil muestra 80 y el perfil se volvió a pedir", async () => {
    const user = userEvent.setup()
    arrangeDeleteOfLatest()
    renderPage(links)
    await screen.findByRole("button", { name: deleteName("2026-10-11") })
    const profileCallsBefore = getProfileMock.mock.calls.length

    await deleteMetric(user, "2026-10-11")
    await user.click(screen.getByRole("link", { name: "Ir a Perfil" }))

    await screen.findByLabelText("Fecha de nacimiento")
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[]
    // cm, peso, grasa, músculo
    expect(inputs[1]).toHaveValue(80)
    expect(getProfileMock.mock.calls.length).toBeGreaterThan(profileCallsBefore)
  })

  // SDD: REQ-011 AC-011.3
  it("tras borrar la última medición, el home muestra 'Peso actual' con 80 kg", async () => {
    const user = userEvent.setup()
    arrangeDeleteOfLatest()
    renderPage(links)

    await deleteMetric(user, "2026-10-11")
    await user.click(screen.getByRole("link", { name: "Ir a Home" }))

    const label = await screen.findByText("Peso actual")
    await waitFor(() =>
      expect(label.parentElement).toHaveTextContent("80 kg")
    )
  })

  // SDD: REQ-011 AC-011.4
  it("tras borrar la última medición con grasa, el perfil muestra la grasa anterior (22)", async () => {
    const user = userEvent.setup()
    arrangeDeleteOfLatest()
    renderPage(links)

    await deleteMetric(user, "2026-10-11")
    await user.click(screen.getByRole("link", { name: "Ir a Perfil" }))

    const fat = await screen.findByLabelText(/% Grasa corporal/)
    expect(fat).toHaveValue(22)
  })
})
