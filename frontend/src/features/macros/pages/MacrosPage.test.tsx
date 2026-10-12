// Test de PÁGINA de Macros (feature 006): las cifras salen del perfil del
// servidor y la edad, de la fecha de nacimiento. La red se simula en api.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { getProfile } from "@/features/profile/api"
import { MacrosPage } from "./MacrosPage"
import { makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)

// Hombre, 72,5 kg, 175 cm, actividad moderada, mantener, nacido el
// 12-10-1998: 27 años el 11-10-2026 (2322 kcal) y 28 el 12-10-2026 (2315).
const response = makeProfileResponse({ date_of_birth: "1998-10-12" })

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MacrosPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("MacrosPage - perfil del servidor", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(response)
    vi.useFakeTimers({ toFake: ["Date"] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-012 AC-012.2
  it("muestra el objetivo diario y los gramos de cada macronutriente", async () => {
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
    renderPage()

    expect(await screen.findByText("Objetivo diario")).toBeInTheDocument()
    expect(screen.getByText("Objetivo diario").parentElement).toHaveTextContent(
      /2\.?322/
    )
    expect(screen.getByText("145 g")).toBeInTheDocument()
    expect(screen.getByText("65 g")).toBeInTheDocument()
    expect(screen.getByText("290 g")).toBeInTheDocument()
  })

  // SDD: REQ-012 AC-012.4
  it("el día antes del cumpleaños calcula con 27 años", async () => {
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
    renderPage()

    await screen.findByText("Objetivo diario")

    expect(screen.getByText("Objetivo diario").parentElement).toHaveTextContent(
      /2\.?322/
    )
  })

  // SDD: REQ-012 AC-012.4
  it("el día del cumpleaños calcula con 28 años sin que el usuario edite nada", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    renderPage()

    await screen.findByText("Objetivo diario")

    expect(screen.getByText("Objetivo diario").parentElement).toHaveTextContent(
      /2\.?315/
    )
  })
})
