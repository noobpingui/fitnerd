// Test de PÁGINA de extremo a extremo de la sincronización del peso del perfil
// (spec 020, REQ-004 y NFR-002): se registra una medición desde Métricas y se
// comprueba el peso que muestran el perfil y el home. La red se simula en
// api.ts con un servidor de prueba con estado (`fakeMetricsServer`) que aplica
// la regla del servidor (spec 016, REQ-006): el peso mostrado depende de las
// mediciones registradas durante la propia prueba, no de una respuesta fijada.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import { createBodyMetric, listBodyMetrics } from "@/features/body-metrics/api"
import { HomePage } from "@/features/home/pages/HomePage"
import { getProfile, saveProfile } from "@/features/profile/api"
import { ProfilePage } from "@/features/profile/pages/ProfilePage"
import type { BodyMetric } from "@/features/body-metrics/types"
import { BodyMetricsPage } from "./BodyMetricsPage"
import { createFakeMetricsServer } from "@/test/fakeMetricsServer"
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
const saveProfileMock = vi.mocked(saveProfile)
const listMock = vi.mocked(listBodyMetrics)
const createMock = vi.mocked(createBodyMetric)
const getCurrentUserMock = vi.mocked(getCurrentUser)

type User = ReturnType<typeof userEvent.setup>
type ServerState = Parameters<typeof createFakeMetricsServer>[0]

function metric(recorded_at: string, weight: number): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

// Conecta los mocks de red al servidor de prueba con estado.
function connectServer(state: ServerState) {
  const server = createFakeMetricsServer(state)
  listMock.mockImplementation(server.listBodyMetrics)
  createMock.mockImplementation(server.createBodyMetric)
  getProfileMock.mockImplementation(server.getProfile)
  saveProfileMock.mockImplementation(server.saveProfile)
  return server
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/body-metrics"]}>
        <nav>
          <Link to="/profile">Ir a Perfil</Link>
          <Link to="/home">Ir a Home</Link>
        </nav>
        <Routes>
          <Route path="/body-metrics" element={<BodyMetricsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Abre el diálogo, registra y espera a que se cierre.
async function register(user: User, date: string, weight: string, unit: "kg" | "lb") {
  const open = await screen.findByRole("button", { name: "Registrar medición" })
  await waitFor(() => expect(open).toBeEnabled())
  await user.click(open)
  const dialog = await screen.findByRole("dialog", { name: "Registrar medición" })
  fireEvent.change(within(dialog).getByLabelText("Fecha"), { target: { value: date } })
  await user.type(within(dialog).getByLabelText(`Peso (${unit})`), weight)
  await user.click(within(dialog).getByRole("button", { name: "Guardar" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
}

async function goToProfile(user: User) {
  await user.click(screen.getByRole("link", { name: "Ir a Perfil" }))
  await screen.findByLabelText("Fecha de nacimiento")
  return screen.getAllByRole("spinbutton") as HTMLInputElement[]
}

beforeEach(() => {
  // Lunes 12 de octubre de 2026; solo se falsea Date.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  getProfileMock.mockReset()
  saveProfileMock.mockReset()
  listMock.mockReset()
  createMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockResolvedValue({
    email: "ana@example.com",
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Sincronización del peso del perfil con el servidor de prueba con estado (REQ-004)", () => {
  // SDD: 020 REQ-004 AC-004.1
  it("registrar una medición más reciente (77) deja 77 en el campo 'Peso' del perfil", async () => {
    const user = userEvent.setup()
    connectServer({
      profile: makeProfileResponse({}, { weight_unit: "kg", weight: 78, goal: "lose" }),
      metrics: [metric("2026-10-01", 78)],
    })
    renderApp()

    await register(user, "2026-10-05", "77", "kg")
    const inputs = await goToProfile(user)

    expect(inputs[1]).toHaveValue(77)
  })

  // SDD: 020 REQ-004 AC-004.1
  it("registrar una medición más reciente (77) deja 'Peso actual' en '77 kg' en el home", async () => {
    const user = userEvent.setup()
    connectServer({
      profile: makeProfileResponse({}, { weight_unit: "kg", weight: 78, goal: "lose" }),
      metrics: [metric("2026-10-01", 78)],
    })
    renderApp()

    await register(user, "2026-10-05", "77", "kg")
    await user.click(screen.getByRole("link", { name: "Ir a Home" }))

    const label = await screen.findByText("Peso actual")
    await waitFor(() => expect(label.parentElement).toHaveTextContent("77 kg"))
  })

  // SDD: 020 REQ-004 AC-004.2
  it("registrar una fecha anterior a la última medición (80) deja el campo 'Peso' en 78", async () => {
    const user = userEvent.setup()
    connectServer({
      profile: makeProfileResponse({}, { weight_unit: "kg", weight: 78, goal: "lose" }),
      metrics: [metric("2026-10-11", 78)],
    })
    renderApp()

    await register(user, "2026-10-05", "80", "kg")
    const inputs = await goToProfile(user)

    expect(inputs[1]).toHaveValue(78)
  })

  // SDD: 020 REQ-004 AC-004.3
  it("con el perfil en lb, registrar 162 lb deja 162 en 'Peso' y la unidad lb", async () => {
    const user = userEvent.setup()
    // 78 kg son 172,0 lb: el perfil ya estaba sincronizado con la única medición.
    connectServer({
      profile: makeProfileResponse(
        {},
        { weight_unit: "lb", weight: 172, height_cm: 175, goal: "lose" }
      ),
      metrics: [metric("2026-10-01", 78)],
    })
    renderApp()

    await register(user, "2026-10-05", "162", "lb")
    const inputs = await goToProfile(user)

    expect(inputs[1]).toHaveValue(162)
    expect(screen.getByRole("button", { name: "lb" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  // SDD: 020 NFR-002 AC-004.1
  it("el peso mostrado sale de las mediciones guardadas: otro valor registrado da otro peso", async () => {
    const user = userEvent.setup()
    connectServer({
      profile: makeProfileResponse({}, { weight_unit: "kg", weight: 78, goal: "lose" }),
      metrics: [metric("2026-10-01", 78)],
    })
    renderApp()

    await register(user, "2026-10-05", "75.5", "kg")
    const inputs = await goToProfile(user)

    expect(inputs[1]).toHaveValue(75.5)
  })
})
