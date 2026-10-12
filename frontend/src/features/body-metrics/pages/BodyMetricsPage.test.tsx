// Test de PÁGINA de Métricas (feature 006): la unidad de peso y la meta
// salen del perfil del servidor. La red se simula en api.ts (vi.mock); el
// gráfico y el análisis de IA se sustituyen por stubs.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile } from "@/features/profile/api"
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

// Bajada constante de 0,5 kg por semana (en kg, como los guarda el backend):
// 0,64 % del peso por semana.
const METRICS = [
  metric("2026-09-20", 80),
  metric("2026-09-27", 79.5),
  metric("2026-10-04", 79),
  metric("2026-10-11", 78.5),
]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BodyMetricsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("BodyMetricsPage - perfil del servidor", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    listMock.mockReset()
    listMock.mockResolvedValue(METRICS)
  })

  // SDD: REQ-012 AC-012.3
  it("muestra los pesos en lb si el perfil usa lb", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse({}, { weight_unit: "lb", weight: 173, goal: "lose_slow" })
    )
    renderPage()

    // 78,5 kg = 173,1 lb; el ritmo de -0,5 kg/sem = -1,1 lb/sem.
    expect(await screen.findByText(/173[.,]1 lb/)).toBeInTheDocument()
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
    expect(screen.getByText(/78[.,]5 kg/)).toBeInTheDocument()
  })
})
