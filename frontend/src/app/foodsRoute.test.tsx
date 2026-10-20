// Ruta /foods bajo demanda (spec 021, NFR-001): la pantalla «Alimentos» no se
// descarga hasta visitar /foods, que muestra «Cargando…» y después la pantalla
// dentro de la navegación. La red se simula en los api.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouter } from "@/app/router"
import { getCurrentUser } from "@/features/auth/api"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile } from "@/features/profile/api"
import { setToken } from "@/lib/authToken"
import { makeProfileResponse } from "@/test/profileFixtures"

// Registra si el módulo de la pantalla llegó a evaluarse (es decir, a descargarse).
const foodsPageModule = vi.hoisted(() => ({ evaluated: false }))

vi.mock("@/features/foods/pages/FoodsPage", async (importOriginal) => {
  foodsPageModule.evaluated = true
  return await importOriginal<typeof import("@/features/foods/pages/FoodsPage")>()
})
vi.mock("@/features/foods/api", () => ({
  searchFoods: vi.fn(),
}))
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

const routerSources = import.meta.glob("/src/app/router.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

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

describe("AppRouter - ruta /foods", () => {
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
    setToken("token")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  // Debe ir antes que la visita a /foods: la carga bajo demanda se guarda en la
  // primera visita y después ya no se puede comprobar que no se descargó.
  // SDD: 021 NFR-001 AC-N001.1
  it("visitar /home no descarga el código de la pantalla «Alimentos»", async () => {
    window.history.pushState({}, "", "/home")
    // Precondición: la ruta /foods existe (sin ella el test pasaría sin implementar nada).
    expect(routerSources["/src/app/router.tsx"]).toMatch(/path="\/foods"/)

    renderRouter()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo" })
    ).toBeInTheDocument()
    expect(foodsPageModule.evaluated).toBe(false)
  })

  // SDD: 021 NFR-001 AC-N001.1
  it("la primera visita a /foods muestra «Cargando…» y luego la pantalla dentro de la navegación", async () => {
    window.history.pushState({}, "", "/foods")

    renderRouter()

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Alimentos" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0)
    expect(window.location.pathname).toBe("/foods")
    expect(foodsPageModule.evaluated).toBe(true)
  })

  // SDD: 021 REQ-012 AC-012.1
  it("con el onboarding pendiente, /foods no se muestra", async () => {
    const { makePendingResponse } = await import("@/test/profileFixtures")
    vi.mocked(getProfile).mockResolvedValue(makePendingResponse())
    // Precondición: la ruta /foods existe (sin ella el test pasaría sin implementar nada).
    expect(routerSources["/src/app/router.tsx"]).toMatch(/path="\/foods"/)
    window.history.pushState({}, "", "/foods")

    renderRouter()

    expect(
      await screen.findByRole("heading", { level: 1, name: "¿Cuál es tu género?" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1, name: "Alimentos" })).not.toBeInTheDocument()
  })

  // SDD: 021 NFR-001 AC-N001.1
  it("router.tsx declara FoodsPage con lazyNamed y sin import estático", () => {
    const source = routerSources["/src/app/router.tsx"]

    expect(source).toMatch(
      /lazyNamed\(\s*\(\)\s*=>\s*import\(\s*"@\/features\/foods\/pages\/FoodsPage"\s*\)/
    )
    expect(source).not.toMatch(/^import[^\n]*FoodsPage/m)
    expect(source).toMatch(/path="\/foods"/)
  })
})
