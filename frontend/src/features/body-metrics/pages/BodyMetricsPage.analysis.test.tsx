// Test de PÁGINA del cableado del análisis (spec 010): al pulsar el botón, la
// página envía a analyzeBodyMetrics el cuerpo armado con los indicadores y las
// calorías de Macros, o null si no hay perfil. A diferencia de
// BodyMetricsPage.test.tsx, aquí NO se sustituye ProgressAnalysis. La red se
// simula en api.ts (vi.mock) y el gráfico se sustituye por un stub.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import {
  analyzeBodyMetrics,
  listBodyMetrics,
  updateBodyMetric,
} from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { getProfile } from "@/features/profile/api"
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
vi.mock("@/features/body-metrics/components/TrendChart", () => ({
  TrendChart: () => <div>Gráfico</div>,
}))

const getProfileMock = vi.mocked(getProfile)
const listMock = vi.mocked(listBodyMetrics)
const analyzeMock = vi.mocked(analyzeBodyMetrics)
const updateMock = vi.mocked(updateBodyMetric)

// Primer argumento de la primera llamada (la firma real con `request` la crea
// el implementer; el cast evita depender de ella para compilar).
const firstArg = () => (analyzeMock.mock.calls as unknown[][])[0][0]

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

// Mediciones "más lento" de la spec 010: -0,2 kg/sem.
const SLOWER = [
  metric("2026-09-20", 80),
  metric("2026-09-27", 79.8),
  metric("2026-10-04", 79.6),
  metric("2026-10-11", 79.4),
]

const BASE_PROFILE = {
  gender: "male",
  height_unit: "cm",
  height_cm: 180,
  height_ft: null,
  height_in: null,
  weight_unit: "kg",
  weight: 79.4,
  activity_level: "high",
  goal: "lose",
} as const

const BUTTON = "Pídele al IA Coach que analice tu progreso"

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

// Reloj fijo: lunes 12 de octubre de 2026. Solo se falsea Date, para que
// waitFor y userEvent sigan funcionando.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  getProfileMock.mockReset()
  listMock.mockReset()
  analyzeMock.mockReset()
  listMock.mockResolvedValue(SLOWER)
  analyzeMock.mockResolvedValue({
    analysis: "Análisis de prueba.",
    calorie_suggestion: null,
  } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BodyMetricsPage - análisis del coach", () => {
  // SDD: REQ-002 AC-002.1
  it("envía los indicadores y las calorías de Macros al pulsar el botón", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(
      makeProfileResponse({ date_of_birth: "1996-10-12" }, BASE_PROFILE)
    )
    renderPage()
    // El estado de ritmo solo aparece cuando el perfil (la meta) ya cargó.
    await screen.findByText("Más lento que tu meta")

    await user.click(screen.getByRole("button", { name: BUTTON }))

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
    expect(firstArg()).toMatchObject({
      today: "2026-10-12",
      indicators: {
        weight: "79,4 kg",
        weight_change_30d: "-0,6 kg",
        rate: "-0,2 kg/sem",
        pace_status: "too_slow",
      },
      latest_weight_kg: 79.4,
    })
  })

  // SDD: REQ-003 AC-003.1
  it("el cuerpo lleva el mantenimiento y el objetivo diario de Macros", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(
      makeProfileResponse({ date_of_birth: "1996-10-12" }, BASE_PROFILE)
    )
    renderPage()
    await screen.findByText("Más lento que tu meta")

    await user.click(screen.getByRole("button", { name: BUTTON }))

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
    expect(firstArg()).toMatchObject({
      calories: { maintenance_kcal: 2750, target_kcal: 2200 },
    })
  })

  // SDD: REQ-009 AC-009.4
  it("sin perfil envía null para que el servidor responda el 409", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse())
    renderPage()
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled())
    const button = await screen.findByRole("button", { name: BUTTON })
    // Deja que la respuesta del perfil (sin perfil) se aplique antes del clic.
    await new Promise((resolve) => setTimeout(resolve, 0))

    await user.click(button)

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
    expect(firstArg()).toBeNull()
  })
})

// --- Spec 011: ritmo poco realista ---

describe("BodyMetricsPage - análisis con ritmo poco realista", () => {
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
  const CORRECTED = [
    metric("2026-10-01", 80),
    metric("2026-10-06", 80),
    metric("2026-10-11", 79.5),
  ]

  function useProfile(weightUnit: "kg" | "lb" = "kg") {
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1996-10-12" },
        {
          ...BASE_PROFILE,
          weight_unit: weightUnit,
          weight: weightUnit === "kg" ? 98 : 216,
        }
      )
    )
  }

  // Texto completo del aviso (REQ-003).
  const warning = (rate: string, iso: string) =>
    `Tu ritmo de las últimas 4 semanas (${rate}) no es realista: puede que la medición del ${formatDate(iso)} esté mal. Revísala en el Historial y corrígela o bórrala para recibir una sugerencia de calorías.`
  const anyWarning = () =>
    screen.queryByText(/no es realista: puede que la medición del/)

  async function correctLastMeasurement(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("button", {
        name: `Corregir medición del ${formatDate("2026-10-11")}`,
      })
    )
    const weight = await screen.findByLabelText("Peso (kg)")
    await user.clear(weight)
    await user.type(weight, "79.5")
    await user.click(screen.getByRole("button", { name: "Guardar" }))
  }

  // SDD: 011 REQ-003 AC-003.1
  it("con el salto hacia arriba muestra el aviso con ritmo y fecha y el botón habilitado", async () => {
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()

    expect(
      await screen.findByText(warning("+12,6 kg/sem", "2026-10-11"))
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: BUTTON })).toBeEnabled()
  })

  // SDD: 011 REQ-003 AC-003.2
  it("con el perfil en lb el aviso lleva -27,8 lb/sem y la fecha del 2026-10-01", async () => {
    useProfile("lb")
    listMock.mockResolvedValue(JUMP_DOWN)
    renderPage()

    expect(
      await screen.findByText(warning("-27,8 lb/sem", "2026-10-01"))
    ).toBeInTheDocument()
  })

  // SDD: 011 REQ-003 AC-003.4
  it("con el límite del 2 % no hay aviso", async () => {
    useProfile()
    // Contraste: con el salto sí hay aviso (el caso nuevo).
    listMock.mockResolvedValue(JUMP_UP)
    const jump = renderPage()
    expect(
      await screen.findByText(/no es realista: puede que la medición del/)
    ).toBeInTheDocument()
    jump.unmount()

    listMock.mockResolvedValue(LIMIT)
    renderPage()
    await screen.findByText("Más lento que tu meta")

    expect(anyWarning()).not.toBeInTheDocument()
  })

  // SDD: 011 REQ-003 AC-003.5
  it("en un empate el aviso lleva la fecha del 2026-10-11", async () => {
    useProfile()
    listMock.mockResolvedValue(TIE)
    renderPage()

    const node = await screen.findByText(/no es realista: puede que la medición del/)
    expect(node.textContent).toContain(
      `la medición del ${formatDate("2026-10-11")} esté mal`
    )
  })

  // SDD: 011 REQ-003 AC-003.6
  it("una medición de hace más de 28 días no cambia la fecha del aviso", async () => {
    useProfile()
    listMock.mockResolvedValue([metric("2026-09-01", 120), ...JUMP_UP])
    renderPage()

    const node = await screen.findByText(/no es realista: puede que la medición del/)
    expect(node.textContent).toContain(
      `la medición del ${formatDate("2026-10-11")} esté mal`
    )
    expect(node.textContent).not.toContain(formatDate("2026-09-01"))
  })

  // SDD: 011 REQ-004 AC-004.1
  it("el clic envía 'unrealistic' y se ve el análisis sin bloque de ajuste ni error", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()
    await screen.findByText(warning("+12,6 kg/sem", "2026-10-11"))

    await user.click(screen.getByRole("button", { name: BUTTON }))

    expect(await screen.findByText("Análisis de prueba.")).toBeInTheDocument()
    expect(firstArg()).toMatchObject({
      indicators: { pace_status: "unrealistic", rate: "+12,6 kg/sem" },
      latest_weight_kg: 98,
    })
    expect(screen.queryByText("Ajuste de calorías sugerido")).not.toBeInTheDocument()
    expect(screen.queryByText(/Error \(/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Los datos del análisis no son válidos/)
    ).not.toBeInTheDocument()
    // El aviso sigue visible junto al análisis.
    expect(anyWarning()).toBeInTheDocument()
  })

  // SDD: 011 REQ-004 AC-004.4
  it("con el salto hacia abajo el clic también envía 'unrealistic'", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock.mockResolvedValue(JUMP_DOWN)
    renderPage()
    await screen.findByText(/no es realista: puede que la medición del/)

    await user.click(screen.getByRole("button", { name: BUTTON }))

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
    expect(firstArg()).toMatchObject({ indicators: { pace_status: "unrealistic" } })
    expect(screen.queryByText("Ajuste de calorías sugerido")).not.toBeInTheDocument()
  })

  // SDD: 011 REQ-007 AC-007.6
  it("la petición de la versión actual con el salto hacia arriba se genera sin error", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock.mockResolvedValue(JUMP_UP)
    renderPage()
    await screen.findByText(/no es realista: puede que la medición del/)

    await user.click(screen.getByRole("button", { name: BUTTON }))

    expect(await screen.findByText("Análisis de prueba.")).toBeInTheDocument()
    expect(analyzeMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 011 REQ-008 AC-008.1
  it("tras corregir la medición desaparece el aviso", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock.mockReset().mockResolvedValueOnce(JUMP_UP).mockResolvedValue(CORRECTED)
    updateMock.mockResolvedValue(metric("2026-10-11", 79.5))
    renderPage()
    await screen.findByText(/no es realista: puede que la medición del/)

    await correctLastMeasurement(user)

    await waitFor(() => expect(anyWarning()).not.toBeInTheDocument())
  })

  // SDD: 011 REQ-008 AC-008.3
  it("tras corregir, el clic envía un estado normal y se ve el ajuste que da el servidor", async () => {
    const user = userEvent.setup()
    useProfile()
    listMock.mockReset().mockResolvedValueOnce(JUMP_UP).mockResolvedValue(CORRECTED)
    updateMock.mockResolvedValue(metric("2026-10-11", 79.5))
    analyzeMock.mockResolvedValue({
      analysis: "Análisis de prueba.",
      calorie_suggestion: {
        kind: "adjust",
        target_kcal: 2200,
        suggested_kcal: 1750,
        adjustment_kcal: -450,
        floor_kcal: 1500,
      },
    } as never)
    renderPage()
    await screen.findByText(/no es realista: puede que la medición del/)
    await correctLastMeasurement(user)
    await waitFor(() => expect(anyWarning()).not.toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: BUTTON }))

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
    expect(firstArg()).toMatchObject({ indicators: { pace_status: "too_slow" } })
    expect(await screen.findByText("Ajuste de calorías sugerido")).toBeInTheDocument()
  })
})
