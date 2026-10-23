// Rutas /diary y /foods (spec 022, NFR-001 y REQ-015): la pantalla «Diario» se
// carga bajo demanda y `/foods` redirige a `/diary` desde la 023. La red se
// simula en los api.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouter } from "@/app/router"
import { getCurrentUser } from "@/features/auth/api"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { getDiary } from "@/features/diary/api"
import { getProfile } from "@/features/profile/api"
import { setToken } from "@/lib/authToken"
import { makeDiary } from "@/test/diaryFixtures"
import { makeProfileResponse } from "@/test/profileFixtures"

// Registra si el módulo de la pantalla llegó a evaluarse (es decir, a descargarse).
const diaryPageModule = vi.hoisted(() => ({ evaluated: false }))

vi.mock("@/features/diary/pages/DiaryPage", async (importOriginal) => {
  diaryPageModule.evaluated = true
  return await importOriginal<typeof import("@/features/diary/pages/DiaryPage")>()
})
vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
}))
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

describe("AppRouter - rutas /diary y /foods", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    vi.mocked(getProfile).mockReset()
    vi.mocked(getProfile).mockResolvedValue(makeProfileResponse())
    vi.mocked(listBodyMetrics).mockReset()
    vi.mocked(listBodyMetrics).mockResolvedValue([])
    vi.mocked(getDiary).mockReset()
    vi.mocked(getDiary).mockResolvedValue(makeDiary())
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(getCurrentUser).mockResolvedValue({
      email: "a@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    setToken("token")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  // Debe ir antes que la visita a /diary: la carga bajo demanda se guarda en la
  // primera visita y después ya no se puede comprobar que no se descargó.
  // SDD: 022 NFR-001 AC-N001.1
  it("visitar /home no descarga el código de la pantalla «Diario»", async () => {
    window.history.pushState({}, "", "/home")
    // Precondición: la ruta /diary existe (sin ella el test pasaría sin implementar nada).
    expect(routerSources["/src/app/router.tsx"]).toMatch(/path="\/diary"/)

    renderRouter()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo" })
    ).toBeInTheDocument()
    expect(diaryPageModule.evaluated).toBe(false)
  })

  // SDD: 022 NFR-001 AC-N001.1
  it("la primera visita a /diary muestra «Cargando…» y luego la pantalla dentro de la navegación", async () => {
    window.history.pushState({}, "", "/diary")

    renderRouter()

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…")
    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0)
    expect(window.location.pathname).toBe("/diary")
    expect(diaryPageModule.evaluated).toBe(true)
  })

  // SDD: 022 REQ-015 AC-015.3
  it("en /diary la entrada «Diario» de la barra aparece como activa", async () => {
    window.history.pushState({}, "", "/diary")

    renderRouter()

    await screen.findByRole("heading", { level: 1, name: "Diario" })
    const active = screen
      .getAllByRole("link", { name: "Diario" })
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(active.length).toBeGreaterThan(0)
  })

  // SDD: 023 REQ-011 AC-011.1
  it("/foods ya no muestra «Alimentos»: termina en /diary con «Diario» activo", async () => {
    window.history.pushState({}, "", "/foods")

    renderRouter()

    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/diary")
    expect(screen.queryByRole("heading", { level: 1, name: "Alimentos" })).not.toBeInTheDocument()
  })

  // SDD: 022 NFR-001 AC-N001.1
  it("router.tsx declara DiaryPage con lazyNamed y sin import estático", () => {
    const source = routerSources["/src/app/router.tsx"]

    expect(source).toMatch(
      /lazyNamed\(\s*\(\)\s*=>\s*import\(\s*"@\/features\/diary\/pages\/DiaryPage"\s*\)/
    )
    expect(source).not.toMatch(/^import[^\n]*DiaryPage/m)
    expect(source).toMatch(/path="\/diary"/)
  })
})
