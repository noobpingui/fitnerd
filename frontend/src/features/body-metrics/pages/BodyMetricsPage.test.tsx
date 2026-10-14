// Test de PÁGINA de Métricas (features 006 y 008): la unidad de peso y la meta
// salen del perfil del servidor, y el historial permite corregir y borrar
// mediciones. La red se simula en api.ts (vi.mock); el gráfico y el análisis
// de IA se sustituyen por stubs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
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
import { ApiError } from "@/lib/apiClient"
import type { ProfileResponse } from "@/features/profile/types"
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

// Como kpi, pero espera a que la página haya cargado y pintado la tarjeta.
async function kpiLoaded(label: string) {
  const labelNode = await screen.findByText(label, { selector: "span" })
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

// Reloj fijo (spec 009, plan §5.4): lunes 12 de octubre de 2026. Solo se
// falsea Date, para que waitFor y userEvent sigan funcionando.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

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

// ---------------------------------------------------------------------------
// Indicadores de progreso (spec 009)
// ---------------------------------------------------------------------------

// Un Stat (Composición, Constancia): se acota al contenedor de su etiqueta.
function stat(label: string) {
  const labelNode = screen.getByText(label, { selector: "span" })
  return within(labelNode.parentElement as HTMLElement)
}

// Texto exacto, tolerante al separador decimal y al signo menos del ICU.
function exact(text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replace(/,/g, "[.,]").replace(/-/g, "[-−]")}$`)
}

const STATUS_LABELS = [
  "En ritmo con tu meta",
  "Más lento que tu meta",
  "Más rápido que tu meta",
  "Fuera del rango de tu meta",
]

function profileWith(profile: Parameters<typeof makeProfileResponse>[1] = {}) {
  getProfileMock.mockResolvedValue(
    makeProfileResponse({}, { weight_unit: "kg", height_cm: 175, goal: "lose", ...profile })
  )
}

// Renderiza y espera a que la página y el perfil hayan llegado.
async function renderLoaded(metrics: BodyMetric[]) {
  listMock.mockResolvedValue(metrics)
  const view = renderPage()
  await screen.findByRole("heading", { name: "Constancia" })
  await waitFor(() => expect(getProfileMock).toHaveBeenCalled())
  // El mock resuelve en microtareas: se vacían dentro de act, sin temporizador real.
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
  return view
}

function expectNoStatus() {
  for (const label of STATUS_LABELS) {
    expect(screen.queryByText(label)).not.toBeInTheDocument()
  }
}

describe("BodyMetricsPage - indicadores (spec 009): KPI Peso", () => {
  beforeEach(() => profileWith())

  // SDD: REQ-001 AC-001.1
  it("muestra el último peso y el cambio frente a la referencia de 30 días", async () => {
    await renderLoaded([
      metric("2026-09-01", 82),
      metric("2026-09-10", 81),
      metric("2026-10-11", 78.5),
    ])

    expect(kpi("Peso").getByText(exact("78,5 kg"))).toBeInTheDocument()
    expect(kpi("Peso").getByText(exact("-2,5 kg en 30 días"))).toBeInTheDocument()
  })

  // SDD: REQ-001 AC-001.4
  it("con una sola medición no muestra texto de cambio", async () => {
    await renderLoaded([metric("2026-10-11", 78.5)])

    expect(kpi("Peso").getByText(exact("78,5 kg"))).toBeInTheDocument()
    expect(kpi("Peso").queryByText(/en 30 días/)).not.toBeInTheDocument()
  })

  // SDD: REQ-001 AC-001.5
  it("con perfil en lb muestra el peso y el cambio en lb", async () => {
    profileWith({ weight_unit: "lb", weight: 173 })
    await renderLoaded([metric("2026-09-11", 80), metric("2026-10-11", 78.5)])

    expect(kpi("Peso").getByText(exact("173,1 lb"))).toBeInTheDocument()
    expect(kpi("Peso").getByText(exact("-3,3 lb en 30 días"))).toBeInTheDocument()
  })

  // SDD: REQ-001 AC-001.6
  it("usa la última medición de peso, no la última medición", async () => {
    await renderLoaded([metric("2026-10-05", 79), metric("2026-10-11", null, 20)])

    expect(kpi("Peso").getByText(exact("79 kg"))).toBeInTheDocument()
  })

  // SDD: REQ-001 AC-001.7
  it("sin mediciones de peso muestra — y ningún cambio", async () => {
    await renderLoaded([metric("2026-10-11", null, 20)])

    expect(kpi("Peso").getByText("—")).toBeInTheDocument()
    expect(kpi("Peso").queryByText(/en 30 días/)).not.toBeInTheDocument()
  })

  // SDD: REQ-001 AC-001.8
  it("muestra un cambio de 0 cuando el peso no varió", async () => {
    await renderLoaded([metric("2026-09-10", 80), metric("2026-10-11", 80)])

    expect(kpi("Peso").getByText(exact("80 kg"))).toBeInTheDocument()
    expect(kpi("Peso").getByText(exact("0 kg en 30 días"))).toBeInTheDocument()
  })

  // SDD: REQ-001 AC-001.9
  it("sigue mostrando el cambio aunque la última medición sea antigua", async () => {
    await renderLoaded([
      metric("2026-08-17", 80),
      metric("2026-08-24", 79.5),
      metric("2026-08-31", 79),
      metric("2026-09-07", 78.5),
    ])

    expect(kpi("Peso").getByText(exact("78,5 kg"))).toBeInTheDocument()
    expect(kpi("Peso").getByText(exact("-1,5 kg en 30 días"))).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): KPI % Grasa", () => {
  beforeEach(() => profileWith())

  // SDD: REQ-002 AC-002.1
  it("muestra el % de grasa y su cambio en puntos", async () => {
    await renderLoaded([metric("2026-09-10", null, 22), metric("2026-10-11", null, 20)])

    expect(kpi("% Grasa").getByText(exact("20 %"))).toBeInTheDocument()
    expect(kpi("% Grasa").getByText(exact("-2 pts en 30 días"))).toBeInTheDocument()
  })

  // SDD: REQ-002 AC-002.3
  it("con una sola medición de grasa no muestra cambio", async () => {
    await renderLoaded([metric("2026-10-11", 80, 20)])

    expect(kpi("% Grasa").getByText(exact("20 %"))).toBeInTheDocument()
    expect(kpi("% Grasa").queryByText(/en 30 días/)).not.toBeInTheDocument()
  })

  // SDD: REQ-002 AC-002.4
  it("sin mediciones de grasa muestra — y ningún cambio", async () => {
    await renderLoaded([metric("2026-10-05", 80), metric("2026-10-11", 79)])

    expect(kpi("% Grasa").getByText("—")).toBeInTheDocument()
    expect(kpi("% Grasa").queryByText(/en 30 días/)).not.toBeInTheDocument()
  })

  // SDD: REQ-002 AC-002.5
  it("con perfil en lb el % de grasa no cambia de unidad", async () => {
    profileWith({ weight_unit: "lb", weight: 173 })
    await renderLoaded([metric("2026-09-10", null, 22), metric("2026-10-11", null, 20)])

    expect(kpi("% Grasa").getByText(exact("20 %"))).toBeInTheDocument()
    expect(kpi("% Grasa").getByText(exact("-2 pts en 30 días"))).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): KPI Ritmo", () => {
  beforeEach(() => profileWith())

  // SDD: REQ-003 AC-003.1
  it("muestra el ritmo semanal en kg", async () => {
    await renderLoaded(METRICS)

    expect(kpi("Ritmo").getByText(exact("-0,5 kg/sem"))).toBeInTheDocument()
  })

  // SDD: REQ-003 AC-003.2
  it("muestra el ritmo semanal en lb con perfil en lb", async () => {
    profileWith({ weight_unit: "lb", weight: 173 })
    await renderLoaded(METRICS)

    expect(kpi("Ritmo").getByText(exact("-1,1 lb/sem"))).toBeInTheDocument()
  })

  // SDD: REQ-003 AC-003.4
  it("con 3 mediciones que cubren 9 días pide más registros", async () => {
    await renderLoaded([
      metric("2026-10-02", 80),
      metric("2026-10-06", 79.5),
      metric("2026-10-11", 79),
    ])

    expect(kpi("Ritmo").getByText("—")).toBeInTheDocument()
    expect(kpi("Ritmo").getByText("Faltan registros para calcularlo")).toBeInTheDocument()
  })

  // SDD: REQ-003 AC-003.5
  it("con dos mediciones de peso pide más registros", async () => {
    await renderLoaded([metric("2026-09-20", 80), metric("2026-10-11", 78.5)])

    expect(kpi("Ritmo").getByText("—")).toBeInTheDocument()
    expect(kpi("Ritmo").getByText("Faltan registros para calcularlo")).toBeInTheDocument()
  })

  // SDD: REQ-003 AC-003.9
  it("las mediciones sin peso no cuentan para el ritmo", async () => {
    await renderLoaded([...METRICS, metric("2026-10-12", null, 20)])

    expect(kpi("Ritmo").getByText(exact("-0,5 kg/sem"))).toBeInTheDocument()
  })

  // SDD: REQ-003 AC-003.10
  it("con la última medición de peso de hace más de 28 días muestra Sin registros recientes", async () => {
    await renderLoaded([
      metric("2026-08-17", 80),
      metric("2026-08-24", 79.5),
      metric("2026-08-31", 79),
      metric("2026-09-07", 78.5),
    ])

    expect(kpi("Ritmo").getByText("—")).toBeInTheDocument()
    expect(kpi("Ritmo").getByText("Sin registros recientes")).toBeInTheDocument()
    expectNoStatus()
  })

  // SDD: REQ-003 AC-003.13
  it("Sin registros recientes tiene prioridad sobre Faltan registros", async () => {
    await renderLoaded([metric("2026-08-20", 80), metric("2026-09-07", 79)])

    expect(kpi("Ritmo").getByText("Sin registros recientes")).toBeInTheDocument()
    expect(screen.queryByText("Faltan registros para calcularlo")).not.toBeInTheDocument()
  })

  // SDD: REQ-003 AC-003.14
  it("una medición reciente sin peso no evita Sin registros recientes", async () => {
    await renderLoaded([
      metric("2026-08-17", 80),
      metric("2026-08-24", 79.5),
      metric("2026-08-31", 79),
      metric("2026-09-07", 78.5),
      metric("2026-10-11", null, 20),
    ])

    expect(kpi("Ritmo").getByText("—")).toBeInTheDocument()
    expect(kpi("Ritmo").getByText("Sin registros recientes")).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): ritmo frente a la meta", () => {
  // SDD: REQ-004 AC-004.1
  it("con meta lose el ritmo de -0,64 % semanal está en ritmo", async () => {
    profileWith({ goal: "lose" })
    await renderLoaded(METRICS)

    expect(kpi("Ritmo").getByText("En ritmo con tu meta")).toBeInTheDocument()
  })

  // SDD: REQ-004 AC-004.2
  it("con meta lose_slow el mismo ritmo es más rápido que la meta", async () => {
    profileWith({ goal: "lose_slow" })
    await renderLoaded(METRICS)

    expect(kpi("Ritmo").getByText("Más rápido que tu meta")).toBeInTheDocument()
  })

  // SDD: REQ-004 AC-004.3
  it("con meta gain el mismo ritmo es más lento que la meta", async () => {
    profileWith({ goal: "gain" })
    await renderLoaded(METRICS)

    expect(kpi("Ritmo").getByText("Más lento que tu meta")).toBeInTheDocument()
  })

  // SDD: REQ-004 AC-004.5
  it("con meta maintain y ritmo 0 está en ritmo", async () => {
    profileWith({ goal: "maintain" })
    await renderLoaded([
      metric("2026-09-20", 80),
      metric("2026-09-27", 80),
      metric("2026-10-04", 80),
      metric("2026-10-11", 80),
    ])

    expect(kpi("Ritmo").getByText("En ritmo con tu meta")).toBeInTheDocument()
  })

  // SDD: REQ-004 AC-004.10
  it("sin datos suficientes muestra Faltan registros y ningún estado de meta", async () => {
    profileWith({ goal: "lose" })
    await renderLoaded([
      metric("2026-10-02", 80),
      metric("2026-10-06", 79.5),
      metric("2026-10-11", 79),
    ])

    expect(kpi("Ritmo").getByText("Faltan registros para calcularlo")).toBeInTheDocument()
    expectNoStatus()
  })

  // SDD: REQ-004 AC-004.13
  it("con Sin registros recientes no hay ningún estado de meta", async () => {
    profileWith({ goal: "lose" })
    await renderLoaded([
      metric("2026-08-17", 80),
      metric("2026-08-24", 79.5),
      metric("2026-08-31", 79),
      metric("2026-09-07", 78.5),
    ])

    expect(kpi("Ritmo").getByText("Sin registros recientes")).toBeInTheDocument()
    expectNoStatus()
  })

  // SDD: REQ-004 AC-004.4
  it("con meta maintain un ritmo fuera de rango dice Fuera del rango de tu meta con el mismo aviso visual", async () => {
    profileWith({ goal: "lose_slow" })
    const first = await renderLoaded(METRICS)
    const tooFastTone = kpi("Ritmo")
      .getByText("Más rápido que tu meta")
      .getAttribute("data-tone")
    first.unmount()

    profileWith({ goal: "maintain" })
    await renderLoaded(METRICS)

    const off = kpi("Ritmo").getByText("Fuera del rango de tu meta")
    expect(off).toHaveAttribute("data-tone", "warn")
    expect(off.getAttribute("data-tone")).toBe(tooFastTone)
    expect(screen.queryByText("Más rápido que tu meta")).not.toBeInTheDocument()
    expect(screen.queryByText("Más lento que tu meta")).not.toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): composición corporal", () => {
  const FULL = metric("2026-10-05", 80, 20)
  const DESCRIPTION_EMPTY =
    "Registra tu % de grasa en el perfil para ver tu masa grasa y magra."

  beforeEach(() => profileWith())

  // SDD: REQ-006 AC-006.1
  it("muestra masa grasa, masa magra, FFMI y la fecha de la medición", async () => {
    await renderLoaded([FULL])

    expect(stat("Masa grasa").getByText(exact("16 kg"))).toBeInTheDocument()
    expect(stat("Masa magra").getByText(exact("64 kg"))).toBeInTheDocument()
    expect(stat("FFMI").getByText(exact("20,9"))).toBeInTheDocument()
    expect(
      screen.getByText(`Según tu medición del ${formatDate("2026-10-05")}.`)
    ).toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.2
  it("sigue usando la medición con peso y grasa aunque haya otra posterior solo con peso", async () => {
    await renderLoaded([FULL, metric("2026-10-11", 78.5)])

    expect(stat("Masa grasa").getByText(exact("16 kg"))).toBeInTheDocument()
    expect(stat("Masa magra").getByText(exact("64 kg"))).toBeInTheDocument()
    expect(stat("FFMI").getByText(exact("20,9"))).toBeInTheDocument()
    expect(
      screen.getByText(`Según tu medición del ${formatDate("2026-10-05")}.`)
    ).toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.3
  it("con perfil en lb muestra las masas en lb y el mismo FFMI", async () => {
    profileWith({ weight_unit: "lb", weight: 176 })
    await renderLoaded([FULL])

    expect(stat("Masa grasa").getByText(exact("35,3 lb"))).toBeInTheDocument()
    expect(stat("Masa magra").getByText(exact("141,1 lb"))).toBeInTheDocument()
    expect(stat("FFMI").getByText(exact("20,9"))).toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.4
  it("con altura de 5 ft 9 in el FFMI es 20,8", async () => {
    profileWith({ height_unit: "ft", height_cm: null, height_ft: 5, height_in: 9 })
    await renderLoaded([FULL])

    expect(stat("FFMI").getByText(exact("20,8"))).toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.5
  it("sin ninguna medición de grasa muestra — y pide registrar la grasa", async () => {
    await renderLoaded([metric("2026-10-05", 80), metric("2026-10-11", 79)])

    expect(stat("Masa grasa").getByText("—")).toBeInTheDocument()
    expect(stat("Masa magra").getByText("—")).toBeInTheDocument()
    expect(stat("FFMI").getByText("—")).toBeInTheDocument()
    expect(screen.getByText(DESCRIPTION_EMPTY)).toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.6
  it("no combina peso y grasa de mediciones distintas", async () => {
    await renderLoaded([metric("2026-10-11", null, 20), metric("2026-10-05", 80)])

    expect(stat("Masa grasa").getByText("—")).toBeInTheDocument()
    expect(stat("Masa magra").getByText("—")).toBeInTheDocument()
    expect(stat("FFMI").getByText("—")).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): IMC", () => {
  beforeEach(() => profileWith())

  // SDD: REQ-007 AC-007.1
  it("calcula el IMC con la última medición de peso y la altura del perfil", async () => {
    await renderLoaded([metric("2026-10-11", 78.5)])

    expect(stat("IMC").getByText(exact("25,6"))).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.2
  it("usa la última medición de peso y no la de la composición", async () => {
    await renderLoaded([metric("2026-10-05", 80, 20), metric("2026-10-11", 78.5)])

    expect(stat("IMC").getByText(exact("25,6"))).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.3
  it("con altura de 5 ft 9 in y 80 kg el IMC es 26", async () => {
    profileWith({ height_unit: "ft", height_cm: null, height_ft: 5, height_in: 9 })
    await renderLoaded([metric("2026-10-11", 80)])

    expect(stat("IMC").getByText(exact("26"))).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.4
  it("sin mediciones de peso el IMC es —", async () => {
    await renderLoaded([metric("2026-10-11", null, 20)])

    expect(stat("IMC").getByText("—")).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.5
  it("con perfil en lb el IMC no cambia", async () => {
    profileWith({ weight_unit: "lb", weight: 173 })
    await renderLoaded([metric("2026-10-11", 78.5)])

    expect(stat("IMC").getByText(exact("25,6"))).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): racha", () => {
  beforeEach(() => profileWith())

  // SDD: REQ-008 AC-008.1
  it("cuenta 3 semanas seguidas", async () => {
    await renderLoaded([
      metric("2026-10-12", 80),
      metric("2026-10-05", 80),
      metric("2026-09-28", 80),
    ])

    expect(stat("Racha").getByText("3 semanas")).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.2
  it("la semana actual sin mediciones no rompe la racha", async () => {
    await renderLoaded([metric("2026-10-09", 80), metric("2026-10-01", 80)])

    expect(stat("Racha").getByText("2 semanas")).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.3
  it("un hueco corta la racha y se escribe 1 semana en singular", async () => {
    await renderLoaded([metric("2026-10-12", 80), metric("2026-09-28", 80)])

    expect(stat("Racha").getByText("1 semana")).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.4
  it("sin mediciones esta semana ni la pasada la racha es 0 semanas", async () => {
    await renderLoaded([metric("2026-09-30", 80)])

    expect(stat("Racha").getByText("0 semanas")).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.5
  it("el domingo cuenta en la misma semana que el lunes", async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 12)) // domingo
    await renderLoaded([metric("2026-10-12", 80), metric("2026-10-05", 80)])

    expect(stat("Racha").getByText("2 semanas")).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.6
  it("varias mediciones en la misma semana cuentan una vez", async () => {
    await renderLoaded([
      metric("2026-10-06", 80),
      metric("2026-10-08", 80),
      metric("2026-10-11", 80),
    ])

    expect(stat("Racha").getByText("1 semana")).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): registros y último registro", () => {
  beforeEach(() => profileWith())

  // SDD: REQ-009 AC-009.1
  it("cuenta las mediciones desde 30 días antes de hoy, ambos días incluidos", async () => {
    await renderLoaded([
      metric("2026-09-11", 80),
      metric("2026-09-12", 80),
      metric("2026-10-12", 80),
    ])

    expect(stat("Últimos 30 días").getByText("2 registros")).toBeInTheDocument()
    expect(stat("Últimos 30 días").getByText("3 en total")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.2
  it("escribe 1 registro en singular", async () => {
    await renderLoaded([
      metric("2026-05-01", 80),
      metric("2026-05-08", 80),
      metric("2026-05-15", 80),
      metric("2026-05-22", 80),
      metric("2026-10-11", 80),
    ])

    expect(stat("Últimos 30 días").getByText("1 registro")).toBeInTheDocument()
    expect(stat("Últimos 30 días").queryByText("1 registros")).not.toBeInTheDocument()
    expect(stat("Últimos 30 días").getByText("5 en total")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.3
  it("con todas las mediciones antiguas muestra 0 registros", async () => {
    await renderLoaded([metric("2026-09-11", 80), metric("2026-08-01", 80)])

    expect(stat("Últimos 30 días").getByText("0 registros")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.4
  it("cuenta mediciones con cualquier valor y muestra la fecha de la última", async () => {
    await renderLoaded([metric("2026-10-05", 80), metric("2026-10-11", null, 20)])

    expect(stat("Últimos 30 días").getByText("2 registros")).toBeInTheDocument()
    expect(stat("Último registro").getByText(formatDate("2026-10-11"))).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.5
  it("con una sola medición muestra 1 registro, 1 en total y su fecha", async () => {
    await renderLoaded([metric("2026-10-11", 80)])

    expect(stat("Últimos 30 días").getByText("1 registro")).toBeInTheDocument()
    expect(stat("Últimos 30 días").getByText("1 en total")).toBeInTheDocument()
    expect(stat("Último registro").getByText(formatDate("2026-10-11"))).toBeInTheDocument()
  })
})

describe("BodyMetricsPage - indicadores (spec 009): perfil no disponible", () => {
  beforeEach(() => {
    getProfileMock.mockRejectedValue(new ApiError(500, "Error"))
  })

  // SDD: REQ-010 AC-010.1
  it("muestra los pesos en kg y — en IMC y FFMI", async () => {
    await renderLoaded([metric("2026-10-11", 80, 20)])

    expect(kpi("Peso").getByText(exact("80 kg"))).toBeInTheDocument()
    expect(stat("Masa grasa").getByText(exact("16 kg"))).toBeInTheDocument()
    expect(stat("Masa magra").getByText(exact("64 kg"))).toBeInTheDocument()
    for (const label of ["IMC", "FFMI"]) {
      expect(stat(label).getByText("—")).toBeInTheDocument()
      expect(stat(label).queryByText(/∞|NaN|^0$/)).not.toBeInTheDocument()
    }
  })

  // SDD: REQ-010 AC-010.2
  it("el ritmo se muestra en kg sin estado de meta", async () => {
    await renderLoaded(METRICS)

    expect(kpi("Ritmo").getByText(exact("-0,5 kg/sem"))).toBeInTheDocument()
    expectNoStatus()
  })

  // SDD: REQ-004 AC-004.11
  it("sin perfil el ritmo no lleva estado de meta ni Faltan registros", async () => {
    await renderLoaded(METRICS)

    expectNoStatus()
    expect(screen.queryByText("Faltan registros para calcularlo")).not.toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.3
  it("al llegar el perfil en lb los indicadores pasan a lb sin recargar", async () => {
    let resolveProfile!: (value: ProfileResponse) => void
    getProfileMock.mockReset()
    getProfileMock.mockReturnValue(
      new Promise<ProfileResponse>((resolve) => {
        resolveProfile = resolve
      })
    )
    listMock.mockResolvedValue([metric("2026-10-11", 78.5)])
    renderPage()

    await waitFor(() =>
      expect(kpi("Peso").getByText(exact("78,5 kg"))).toBeInTheDocument()
    )
    expect(stat("IMC").getByText("—")).toBeInTheDocument()

    await act(async () => {
      resolveProfile(
        makeProfileResponse({}, { weight_unit: "lb", weight: 173, height_cm: 175, goal: "lose" })
      )
    })

    await waitFor(() =>
      expect(kpi("Peso").getByText(exact("173,1 lb"))).toBeInTheDocument()
    )
    expect(stat("IMC").getByText(exact("25,6"))).toBeInTheDocument()
  })
})

// --- Spec 011: ritmo poco realista ---

describe("BodyMetricsPage - ritmo poco realista", () => {
  const JUMP_UP = [
    metric("2026-10-01", 80),
    metric("2026-10-06", 80),
    metric("2026-10-11", 98),
  ]
  const JUMP_DOWN = [
    metric("2026-10-01", 98),
    metric("2026-10-06", 80),
    metric("2026-10-11", 80),
  ]
  const LIMIT = [
    metric("2026-09-27", 96),
    metric("2026-10-04", 98),
    metric("2026-10-11", 100),
  ]
  const TIE = [
    metric("2026-09-27", 80),
    metric("2026-10-02", 80),
    metric("2026-10-07", 98),
    metric("2026-10-11", 98),
  ]
  const STALE = [
    metric("2026-08-20", 80),
    metric("2026-08-25", 80),
    metric("2026-08-30", 98),
  ]
  const GOAL_LABELS = [
    "En ritmo con tu meta",
    "Más lento que tu meta",
    "Más rápido que tu meta",
    "Fuera del rango de tu meta",
  ]

  function useProfile(weightUnit: "kg" | "lb" = "kg") {
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1996-10-12" },
        {
          gender: "male",
          height_unit: "cm",
          height_cm: 180,
          weight_unit: weightUnit,
          weight: weightUnit === "kg" ? 98 : 216,
          activity_level: "high",
          goal: "lose",
        }
      )
    )
  }

  const rowOf = (iso: string) =>
    screen
      .getAllByRole("row")
      .find(
        (row) =>
          row.querySelector("th, td")?.textContent?.trim() === formatDate(iso)
      ) as HTMLElement
  const marks = () => screen.queryAllByText("Revisa este peso")

  // SDD: REQ-002 AC-002.1
  it("la tarjeta Ritmo muestra el valor y 'Revisa tus mediciones' con tono de advertencia", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()

    const status = await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    expect(status.closest("[data-tone]")).toHaveAttribute("data-tone", "warn")
    expect(kpi("Ritmo").getByText("+12,6 kg/sem")).toBeInTheDocument()
    for (const label of GOAL_LABELS) {
      expect(kpi("Ritmo").queryByText(label)).not.toBeInTheDocument()
    }
  })

  // SDD: REQ-002 AC-002.2
  it("con el perfil en lb la tarjeta Ritmo muestra -27,8 lb/sem", async () => {
    useProfile("lb")
    listMock.mockResolvedValue(JUMP_DOWN)
    renderPage()

    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    await waitFor(() =>
      expect(kpi("Ritmo").getByText("-27,8 lb/sem")).toBeInTheDocument()
    )
  })

  // SDD: REQ-002 AC-002.3
  it("con el límite del 2 % la tarjeta Ritmo conserva el estado frente a la meta", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    const jump = renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")
    jump.unmount()

    listMock.mockResolvedValue(LIMIT)
    renderPage()

    expect(await (await kpiLoaded("Ritmo")).findByText("Más lento que tu meta")).toBeInTheDocument()
    expect(kpi("Ritmo").getByText("+2 kg/sem")).toBeInTheDocument()
    expect(screen.queryByText("Revisa tus mediciones")).not.toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.1
  it("marca la fila del 2026-10-11 en el salto hacia arriba y no las otras", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    const mark = within(rowOf("2026-10-11")).getByText("Revisa este peso")
    expect(mark.closest("[data-tone]")).toHaveAttribute("data-tone", "warn")
    expect(marks()).toHaveLength(1)
  })

  // SDD: REQ-009 AC-009.2
  it("marca la fila del 2026-10-01 en el salto hacia abajo", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_DOWN)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    expect(
      within(rowOf("2026-10-01")).getByText("Revisa este peso")
    ).toBeInTheDocument()
    expect(marks()).toHaveLength(1)
  })

  // SDD: REQ-009 AC-009.3
  it("en un empate marca solo la fila del 2026-10-11", async () => {
    useProfile()
    listMock.mockResolvedValue(TIE)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    expect(
      within(rowOf("2026-10-11")).getByText("Revisa este peso")
    ).toBeInTheDocument()
    expect(marks()).toHaveLength(1)
  })

  // SDD: REQ-009 AC-009.4
  it("una medición de hace más de 28 días no se marca", async () => {
    useProfile()
    listMock.mockResolvedValue([metric("2026-09-01", 120), ...JUMP_UP])
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    expect(
      within(rowOf("2026-10-11")).getByText("Revisa este peso")
    ).toBeInTheDocument()
    expect(
      within(rowOf("2026-09-01")).queryByText("Revisa este peso")
    ).not.toBeInTheDocument()
    expect(marks()).toHaveLength(1)
  })

  // SDD: REQ-009 AC-009.5
  it("una medición sin peso no se marca y la del 2026-10-11 sí", async () => {
    useProfile()
    listMock.mockResolvedValue([...JUMP_UP, metric("2026-10-09", null, 20)])
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    expect(
      within(rowOf("2026-10-09")).queryByText("Revisa este peso")
    ).not.toBeInTheDocument()
    expect(
      within(rowOf("2026-10-11")).getByText("Revisa este peso")
    ).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.6
  it("con el límite del 2 % ninguna fila lleva la marca", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    // Contraste: con el salto la marca sí aparece (el caso nuevo).
    const jump = renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")
    expect(marks()).toHaveLength(1)
    jump.unmount()
    listMock.mockResolvedValue(LIMIT)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Más lento que tu meta")

    expect(marks()).toHaveLength(0)
  })

  // SDD: REQ-009 AC-009.7
  it("sin registros recientes ninguna fila lleva la marca", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    // Contraste: con el salto la marca sí aparece (el caso nuevo).
    const jump = renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")
    expect(marks()).toHaveLength(1)
    jump.unmount()
    listMock.mockResolvedValue(STALE)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Sin registros recientes")

    expect(marks()).toHaveLength(0)
    expect(screen.queryByText("Revisa tus mediciones")).not.toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.8
  it("con el perfil en lb también se marca la fila del 2026-10-11", async () => {
    useProfile("lb")
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    expect(
      within(rowOf("2026-10-11")).getByText("Revisa este peso")
    ).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.9
  it("la fila marcada conserva los botones de corregir y borrar", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    const row = rowOf("2026-10-11")
    expect(
      within(row).getByRole("button", { name: editName("2026-10-11") })
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: deleteName("2026-10-11") })
    ).toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.1
  it("al corregir la medición a 79,5 kg desaparecen el estado y la marca", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock
      .mockReset()
      .mockResolvedValueOnce(JUMP_UP)
      .mockResolvedValue([...JUMP_UP.slice(0, 2), metric("2026-10-11", 79.5)])
    updateMock.mockResolvedValue(metric("2026-10-11", 79.5))
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    await user.click(await screen.findByRole("button", { name: editName("2026-10-11") }))
    const weight = await screen.findByLabelText("Peso (kg)")
    await user.clear(weight)
    await user.type(weight, "79.5")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() =>
      expect(screen.queryByText("Revisa tus mediciones")).not.toBeInTheDocument()
    )
    expect(marks()).toHaveLength(0)
  })

  // SDD: REQ-008 AC-008.2
  it("al borrar la medición errónea el Ritmo vuelve a 'Faltan registros' y sin marca", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock
      .mockReset()
      .mockResolvedValueOnce(JUMP_UP)
      .mockResolvedValue(JUMP_UP.slice(0, 2))
    deleteMock.mockResolvedValue(undefined)
    renderPage()
    await (await kpiLoaded("Ritmo")).findByText("Revisa tus mediciones")

    await deleteMetric(user, "2026-10-11")

    expect(
      await (await kpiLoaded("Ritmo")).findByText("Faltan registros para calcularlo")
    ).toBeInTheDocument()
    expect(kpi("Ritmo").getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("Revisa tus mediciones")).not.toBeInTheDocument()
    expect(marks()).toHaveLength(0)
  })
})
