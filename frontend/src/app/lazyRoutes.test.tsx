// Test del router con las pantallas cargadas bajo demanda (spec 017): cada
// ruta termina mostrando su pantalla, sin redirigir. La red se simula en los
// api.ts, como en router.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouter } from "@/app/router"
import { getCurrentUser } from "@/features/auth/api"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile } from "@/features/profile/api"
import { setToken } from "@/lib/authToken"
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
vi.mock("@/features/coach/api", () => ({
  askCoach: vi.fn(),
  sendCoachFeedback: vi.fn(),
}))
vi.mock("@/features/feedback/api", () => ({
  createFeedback: vi.fn(),
}))

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

describe("AppRouter - pantallas bajo demanda sin sesión", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  // Debe ser el primer test del archivo: React.lazy guarda el módulo ya
  // descargado, así que solo la primera visita a una pantalla pasa por la carga.
  // SDD: 017 REQ-002 AC-002.1 · REQ-002 AC-002.2
  it("la primera visita a una pantalla muestra 'Cargando…' mientras se descarga y luego el texto legal", async () => {
    window.history.pushState({}, "", "/privacy")

    renderRouter()

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…")
    expect(await screen.findByText("Política de privacidad")).toBeInTheDocument()
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument()
  })

  // SDD: 017 REQ-002 AC-002.2
  it.each([
    ["/login", "Email"],
    ["/register", "Nombre"],
    ["/forgot-password", "Email"],
    ["/reset-password?token=abc", "Nueva contraseña"],
  ])("%s termina mostrando su formulario sin redirigir", async (url, label) => {
    window.history.pushState({}, "", url)

    renderRouter()

    expect(await screen.findByLabelText(label)).toBeInTheDocument()
    expect(window.location.pathname).toBe(url.split("?")[0])
  })

  // SDD: 017 REQ-002 AC-002.2
  it.each([
    ["/privacy", "Política de privacidad"],
    ["/terms", "Términos de servicio"],
  ])("%s termina mostrando su texto legal sin redirigir", async (path, title) => {
    window.history.pushState({}, "", path)

    renderRouter()

    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
  })
})

describe("AppRouter - pantallas bajo demanda con sesión", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    vi.mocked(getProfile).mockReset()
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

  // SDD: 017 REQ-002 AC-002.3
  it.each([
    ["/home", "Hola de nuevo"],
    ["/macros", "Macros"],
    ["/body-metrics", "Métricas"],
    ["/coach", "AI Coach"],
    ["/store", "Visita las diferentes tiendas"],
    ["/profile", "Mi perfil"],
  ])(
    "con el onboarding completado, %s muestra su pantalla dentro de la navegación",
    async (path, heading) => {
      vi.mocked(getProfile).mockResolvedValue(makeProfileResponse())
      setToken("token")
      window.history.pushState({}, "", path)

      renderRouter()

      expect(
        await screen.findByRole("heading", { level: 1, name: heading })
      ).toBeInTheDocument()
      expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0)
      expect(window.location.pathname).toBe(path)
    }
  )

  // SDD: 017 REQ-002 AC-002.4
  it("con el onboarding pendiente, /onboarding muestra la primera pregunta", async () => {
    vi.mocked(getProfile).mockResolvedValue(makePendingResponse())
    setToken("token")
    window.history.pushState({}, "", "/onboarding")

    renderRouter()

    expect(
      await screen.findByRole("heading", { level: 1, name: "¿Cuál es tu género?" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/onboarding")
  })
})
