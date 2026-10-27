// Carga bajo demanda del diálogo de la foto (spec 025, NFR-003): su código viaja
// con la pantalla «Diario» y no con la carga inicial. La red se simula en los
// api.ts.
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

// Registra si el módulo del diálogo de la foto llegó a evaluarse (a descargarse).
const photoDialogModule = vi.hoisted(() => ({ evaluated: false }))

vi.mock("@/features/diary/components/MealPhotoDialog", async (importOriginal) => {
  photoDialogModule.evaluated = true
  return await importOriginal<typeof import("@/features/diary/components/MealPhotoDialog")>()
})
vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
  analyzeMealPhoto: vi.fn(),
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

describe("AppRouter - carga bajo demanda del diálogo de la foto", () => {
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

  // SDD: 025 NFR-003 AC-N003.1
  it("el código del diálogo viaja con la pantalla «Diario»", async () => {
    window.history.pushState({}, "", "/diary")

    renderRouter()

    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(
      await screen.findAllByRole("button", { name: /^Cargar imagen en / })
    ).toHaveLength(4)
    expect(photoDialogModule.evaluated).toBe(true)
  })
})
