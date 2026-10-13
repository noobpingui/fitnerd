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
import { analyzeBodyMetrics, listBodyMetrics } from "@/features/body-metrics/api"
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
