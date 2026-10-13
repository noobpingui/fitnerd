// Test de PÁGINA del home (feature 006): se calcula con el perfil del
// servidor. La red se simula en api.ts de profile (vi.mock).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { getProfile } from "@/features/profile/api"
import { HomePage } from "./HomePage"
import { makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("HomePage - perfil del servidor", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-012 AC-012.1
  it("muestra la meta, el peso en lb y el objetivo calórico del perfil", async () => {
    // Hombre, 27 años (nació el 12-10-1998), 175 cm, 160 lb (72,57 kg),
    // actividad moderada, perder peso (x0,8):
    // (725,75 + 1093,75 - 135 + 5) * 1,375 * 0,8 = 1858 kcal.
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1998-10-12" },
        { weight_unit: "lb", weight: 160, goal: "lose", activity_level: "moderate" }
      )
    )
    renderPage()

    expect(await screen.findByText("Meta: Perder peso")).toBeInTheDocument()
    expect(screen.getByText("Peso actual")).toBeInTheDocument()
    expect(screen.getByText("160 lb")).toBeInTheDocument()
    expect(screen.getByText(/1\.?858/)).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.4
  it("muestra 3379 kcal y los gramos con el tope de proteína a 120 kg", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1996-01-01" },
        { height_cm: 180, weight: 120, activity_level: "high", goal: "maintain" }
      )
    )
    renderPage()

    const card = (await screen.findByText("Objetivo de hoy")).closest("a")
    expect(card).toHaveTextContent(/3\.?379/)
    expect(card).toHaveTextContent("459 g")
    expect(card).toHaveTextContent("175 g")
    expect(card).toHaveTextContent("94 g")
  })

  // SDD: REQ-009 AC-009.5
  it("muestra 1200 kcal cuando se aplica el suelo calórico", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1976-01-01" },
        {
          gender: "female",
          height_cm: 160,
          weight: 60,
          activity_level: "low",
          goal: "lose",
        }
      )
    )
    renderPage()

    const card = (await screen.findByText("Objetivo de hoy")).closest("a")
    expect(card).toHaveTextContent(/1\.?200/)
  })
})
