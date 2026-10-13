// Test del control de acceso por onboarding (feature 006). La red se
// simula en api.ts de profile (vi.mock).
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import { OnboardingGuard } from "@/app/OnboardingGuard"
import { getProfile } from "@/features/profile/api"
import { makePendingResponse, makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)

function renderGuard(path = "/macros") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/onboarding" element={<div>Pantalla onboarding</div>} />
          <Route element={<OnboardingGuard />}>
            <Route path="/macros" element={<div>Pantalla Macros</div>} />
            <Route path="/home" element={<div>Pantalla Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("OnboardingGuard", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    localStorage.clear()
  })

  // SDD: REQ-006 AC-006.1
  it("redirige a /onboarding si el servidor dice que el onboarding está pendiente", async () => {
    // Con datos locales completos, solo una decisión basada en el servidor
    // puede redirigir (evita un falso verde con el guard antiguo).
    localStorage.setItem(
      "fitnerd_onboarding_mock",
      JSON.stringify({ gender: "male", age: "30", weight: "70", goal: "maintain" })
    )
    getProfileMock.mockResolvedValue(makePendingResponse())
    renderGuard("/home")

    expect(await screen.findByText("Pantalla onboarding")).toBeInTheDocument()
    expect(screen.queryByText("Pantalla Home")).not.toBeInTheDocument()
    expect(getProfileMock).toHaveBeenCalled()
  })

  // SDD: REQ-006 AC-006.2
  it("muestra la pantalla si el onboarding está completado", async () => {
    getProfileMock.mockResolvedValue(makeProfileResponse())
    renderGuard("/macros")

    expect(await screen.findByText("Pantalla Macros")).toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.3
  it("mientras carga el perfil muestra un indicador y no redirige ni muestra la pantalla", () => {
    getProfileMock.mockReturnValue(new Promise(() => {}))
    renderGuard("/macros")

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByText("Pantalla Macros")).not.toBeInTheDocument()
    expect(screen.queryByText("Pantalla onboarding")).not.toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.4
  it("si falla la lectura muestra el error con Reintentar y no redirige", async () => {
    getProfileMock.mockRejectedValue(new Error("sin red"))
    renderGuard("/macros")

    expect(await screen.findByText("No se pudo cargar tu perfil.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
    expect(screen.queryByText("Pantalla onboarding")).not.toBeInTheDocument()
    expect(screen.queryByText("Pantalla Macros")).not.toBeInTheDocument()
  })

  // SDD: REQ-006 AC-006.5
  it("al pulsar Reintentar y responder bien, muestra la pantalla que se había abierto", async () => {
    const user = userEvent.setup()
    getProfileMock
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValueOnce(makeProfileResponse())
    renderGuard("/macros")

    await user.click(await screen.findByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Pantalla Macros")).toBeInTheDocument()
    expect(screen.queryByText("No se pudo cargar tu perfil.")).not.toBeInTheDocument()
  })

  // SDD: REQ-013 AC-013.1
  it("ignora los datos simulados del navegador y manda a /onboarding si el servidor dice pendiente", async () => {
    localStorage.setItem(
      "fitnerd_onboarding_mock",
      JSON.stringify({ gender: "male", age: "30", weight: "70", goal: "maintain" })
    )
    getProfileMock.mockResolvedValue(makePendingResponse())
    renderGuard("/home")

    expect(await screen.findByText("Pantalla onboarding")).toBeInTheDocument()
    expect(screen.queryByText("Pantalla Home")).not.toBeInTheDocument()
  })
})
