// Test de cambio de cuenta en el mismo navegador (feature 006, NFR-002): al
// cerrar sesión y entrar con otra cuenta sin recargar, no se ve nada de la
// anterior. Se monta el AppRouter real; la red se simula en los api.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouter } from "@/app/router"
import { getCurrentUser, login } from "@/features/auth/api"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile } from "@/features/profile/api"
import { getToken, setToken } from "@/lib/authToken"
import { makePendingResponse, makeProfileResponse } from "@/test/profileFixtures"

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
vi.mock("@/features/auth/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)
const loginMock = vi.mocked(login)
const getCurrentUserMock = vi.mocked(getCurrentUser)
const listMetricsMock = vi.mocked(listBodyMetrics)

describe("AppRouter - cambio de cuenta en el mismo navegador", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    getProfileMock.mockReset()
    loginMock.mockReset()
    getCurrentUserMock.mockReset()
    listMetricsMock.mockReset()
    listMetricsMock.mockResolvedValue([])
    getCurrentUserMock.mockResolvedValue({
      email: "a@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    // Cada cuenta recibe su propio perfil, según el token de la sesión.
    getProfileMock.mockImplementation(async () =>
      getToken() === "token-a"
        ? makeProfileResponse({ date_of_birth: "1990-06-15" })
        : makePendingResponse(null)
    )
    loginMock.mockResolvedValue({ token: "token-b" } as Awaited<
      ReturnType<typeof login>
    >)
    setToken("token-a")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  // SDD: NFR-002 AC-N002.1
  it("B entra con el onboarding pendiente y sin ver la fecha de nacimiento de A", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/profile")
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <AppRouter />
      </QueryClientProvider>
    )

    // La cuenta A ve su perfil con su fecha de nacimiento.
    expect(await screen.findByLabelText("Fecha de nacimiento")).toHaveValue(
      "1990-06-15"
    )

    // A cierra sesión; B inicia sesión sin recargar la página.
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }))
    await user.type(await screen.findByLabelText("Email"), "b@example.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    // B tiene el onboarding pendiente: va a /onboarding, no ve datos de A.
    expect(
      await screen.findByRole("heading", { name: "¿Cuál es tu género?" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/onboarding")

    await user.click(screen.getByText("Masculino"))
    expect(
      await screen.findByRole("heading", { name: "¿Cuál es tu fecha de nacimiento?" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Fecha de nacimiento")).toHaveValue("")
    expect(screen.queryByDisplayValue("1990-06-15")).not.toBeInTheDocument()
  })
})
