// Ruta /foods (spec 023, REQ-011): la pantalla «Alimentos» de la 021 deja de
// usarse y /foods redirige a /diary. La red se simula en los api.ts.
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

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
}))
vi.mock("@/features/catalog/api", () => ({
  searchCatalog: vi.fn(),
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

describe("AppRouter - ruta /foods", () => {
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

  // SDD: 023 REQ-011 AC-011.1
  it("abrir /foods termina en /diary y muestra la pantalla «Diario», no «Alimentos»", async () => {
    window.history.pushState({}, "", "/foods")

    renderRouter()

    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/diary")
    expect(screen.queryByRole("heading", { level: 1, name: "Alimentos" })).not.toBeInTheDocument()
  })

  // SDD: 023 REQ-011 AC-011.1
  it("con el onboarding pendiente, /foods muestra el onboarding y no el diario", async () => {
    const { makePendingResponse } = await import("@/test/profileFixtures")
    vi.mocked(getProfile).mockResolvedValue(makePendingResponse())
    window.history.pushState({}, "", "/foods")

    renderRouter()

    expect(
      await screen.findByRole("heading", { level: 1, name: "¿Cuál es tu género?" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1, name: "Diario" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1, name: "Alimentos" })).not.toBeInTheDocument()
  })

  // SDD: 023 REQ-011 AC-011.1
  it("router.tsx ya no importa FoodsPage y conserva la ruta /foods como redirección", () => {
    const source = routerSources["/src/app/router.tsx"]

    expect(source).toMatch(/path="\/foods"/)
    expect(source).not.toMatch(/FoodsPage/)
    expect(source).not.toMatch(/features\/foods\/pages/)
  })
})
