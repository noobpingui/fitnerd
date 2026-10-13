// Test de la ruta /onboarding (feature 006): solo la ve quien lo tiene pendiente.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import { OnboardingRoute } from "@/app/OnboardingRoute"
import { getProfile } from "@/features/profile/api"
import { makePendingResponse, makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)

function renderRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/home" element={<div>Pantalla Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("OnboardingRoute", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
  })

  // SDD: REQ-007 AC-007.1
  it("redirige a /home a quien ya completó el onboarding", async () => {
    getProfileMock.mockResolvedValue(makeProfileResponse())
    renderRoute()

    expect(await screen.findByText("Pantalla Home")).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.2
  it("muestra la primera pregunta a quien lo tiene pendiente", async () => {
    getProfileMock.mockResolvedValue(makePendingResponse())
    renderRoute()

    expect(
      await screen.findByRole("heading", { name: "¿Cuál es tu género?" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Pantalla Home")).not.toBeInTheDocument()
  })
})
