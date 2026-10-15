// Las rutas de recuperacion de contraseña son PUBLICAS: se abren sin sesion
// y no deben redirigir al login.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouter } from "@/app/router"
import { getCurrentUser } from "@/features/auth/api"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile } from "@/features/profile/api"
import { setToken } from "@/lib/authToken"
import { makeProfileResponse } from "@/test/profileFixtures"

// Spec 012: la red se simula en los api.ts, como en accountSwitch.test.tsx.
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
vi.mock("@/features/coach/api", () => ({
  askCoach: vi.fn(),
  sendCoachFeedback: vi.fn(),
}))
vi.mock("@/features/feedback/api", () => ({
  createFeedback: vi.fn(),
}))

describe("AppRouter - rutas de recuperacion de contraseña", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  function renderRouter() {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <AppRouter />
      </QueryClientProvider>
    )
  }

  // SDD: REQ-001 AC-001.2
  it("/forgot-password muestra el formulario sin sesion y sin redirigir al login", async () => {
    window.history.pushState({}, "", "/forgot-password")

    renderRouter()

    expect(await screen.findByLabelText("Email")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Enviar enlace" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/forgot-password")
  })

  // SDD: REQ-001 AC-001.2
  it("/reset-password?token=abc es accesible sin sesion y sin redirigir al login", async () => {
    window.history.pushState({}, "", "/reset-password?token=abc")

    renderRouter()

    expect(await screen.findByLabelText("Nueva contraseña")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/reset-password")
  })
})

describe("AppRouter - secciones retiradas y secciones activas (spec 012)", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    vi.mocked(getProfile).mockReset()
    vi.mocked(getProfile).mockResolvedValue(makeProfileResponse())
    vi.mocked(listBodyMetrics).mockReset()
    vi.mocked(listBodyMetrics).mockResolvedValue([])
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(getCurrentUser).mockResolvedValue({
      email: "a@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    // jsdom no implementa scrollIntoView, que la página del coach usa.
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  function renderRouter() {
    return render(
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
  }

  // SDD: 012 REQ-004 AC-004.1
  it.each(["/categories", "/categories/r1", "/categories/r1/c1", "/favorites"])(
    "con sesion, %s redirige a /home sin mostrar catalogo, favoritos ni plan semanal",
    async (path) => {
      setToken("token")
      window.history.pushState({}, "", path)

      renderRouter()

      expect(
        await screen.findByRole("heading", { level: 1, name: "Hola de nuevo" })
      ).toBeInTheDocument()
      expect(window.location.pathname).toBe("/home")
      expect(screen.queryByText(/Catálogo/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Favoritos/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Plan semanal/)).not.toBeInTheDocument()
    }
  )

  // SDD: 012 REQ-004 AC-004.2
  it("sin sesion, /favorites termina en /login", async () => {
    window.history.pushState({}, "", "/favorites")

    renderRouter()

    await waitFor(() => expect(window.location.pathname).toBe("/login"))
  })

  // SDD: 012 REQ-008 AC-008.1 AC-008.2
  it.each([
    ["/macros", "Macros"],
    ["/body-metrics", "Métricas"],
    ["/coach", "AI Coach"],
    ["/store", "Visita las diferentes tiendas"],
    ["/profile", "Mi perfil"],
  ])("con sesion, %s se mantiene y muestra su pantalla", async (path, heading) => {
    setToken("token")
    window.history.pushState({}, "", path)

    renderRouter()

    expect(
      await screen.findByRole("heading", { level: 1, name: heading })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
  })
})
