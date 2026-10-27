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
vi.mock("@/features/food-library/api", () => ({
  searchFoodLibrary: vi.fn(),
  getRecentFoods: vi.fn(async () => []),
  getFavoriteFoods: vi.fn(async () => []),
  setFoodFavorite: vi.fn(),
  deleteCustomFood: vi.fn(),
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

// Archivos de la pantalla «Alimentos» de la 021 que la 028 retira (REQ-020, Q7).
// Sus formato, esquema de la caja de búsqueda y mensajes de error se conservan: los usa el panel.
const retiredFoodsFiles = import.meta.glob([
  "/src/features/foods/pages/FoodsPage.tsx",
  "/src/features/foods/pages/FoodsPage.test.tsx",
  "/src/features/foods/components/FoodResultList.tsx",
  "/src/features/foods/components/FoodSearchForm.tsx",
  "/src/features/foods/hooks.ts",
  "/src/features/diary/components/ProposalSearchStep.tsx",
])

// Iteración 2 (REQ-020, F5): el código sin uso de la búsqueda de la 023 y de USDA.
const unusedSearchFiles = import.meta.glob([
  "/src/features/catalog/**",
  "/src/features/foods/api.ts",
  "/src/test/catalogFixtures.ts",
])

const proposalSources = import.meta.glob("/src/features/diary/proposal.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>
const foodsSchemasSources = import.meta.glob("/src/features/foods/schemas.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>
const foodsTypesSources = import.meta.glob("/src/features/foods/types.ts", {
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

  // SDD: 028 regression guard (comportamiento de la 023: /foods redirige a /diary; no puede fallar antes de implementar)
  // SDD: 023 REQ-011 AC-011.1
  // SDD: 028 REQ-020 AC-020.1
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

  // SDD: 028 REQ-020 AC-020.1
  it("el código de la pantalla «Alimentos» de la 021 ya no existe", () => {
    expect(Object.keys(retiredFoodsFiles)).toEqual([])
  })

  // SDD: 028 regression guard (comportamiento de la 023: /foods redirige a /diary; no puede fallar antes de implementar)
  // SDD: 028 REQ-020 AC-020.1
  it("/foods sigue llevando a /diary también cuando se abre con parámetros", async () => {
    window.history.pushState({}, "", "/foods?q=arroz")

    renderRouter()

    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/diary")
  })

  // SDD: 028 REQ-020 AC-020.1
  it("el código sin uso de la búsqueda de la 023 y de USDA ya no existe", () => {
    expect(Object.keys(unusedSearchFiles)).toEqual([])
    expect(proposalSources["/src/features/diary/proposal.ts"]).not.toMatch(/catalogEntry/)
    expect(foodsSchemasSources["/src/features/foods/schemas.ts"]).not.toMatch(
      /foodSearchResponseSchema/
    )
    expect(foodsTypesSources["/src/features/foods/types.ts"]).not.toMatch(/FoodSearchResponse/)
    // Contraste: lo que el panel sigue usando se conserva.
    expect(foodsSchemasSources["/src/features/foods/schemas.ts"]).toMatch(/foodSearchFormSchema/)
    expect(proposalSources["/src/features/diary/proposal.ts"]).toMatch(/libraryEntry/)
  })
})
