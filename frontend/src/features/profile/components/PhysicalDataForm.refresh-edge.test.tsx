// Casos límite de «Datos físicos» con el aviso de relectura visible (spec 020,
// REQ-002, plan §3.4): (F1) un guardado sin medición no quita el aviso sin
// releer y (F2) «Reintentar» solo relee y no descarta lo editado sin guardar.
// Misma preparación que PhysicalDataForm.refresh.test.tsx. «Hoy» es el lunes
// 12 de octubre de 2026.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import { createBodyMetric, listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile, saveProfile } from "@/features/profile/api"
import { ApiError } from "@/lib/apiClient"
import { ProfilePage } from "@/features/profile/pages/ProfilePage"
import { makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))
vi.mock("@/features/body-metrics/api", () => ({
  listBodyMetrics: vi.fn(),
  createBodyMetric: vi.fn(),
  updateBodyMetric: vi.fn(),
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
const saveMock = vi.mocked(saveProfile)
const listMetricsMock = vi.mocked(listBodyMetrics)
const createMetricMock = vi.mocked(createBodyMetric)
const getCurrentUserMock = vi.mocked(getCurrentUser)

type User = ReturnType<typeof userEvent.setup>

const NOTICE =
  "Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla."
const PROFILE_80 = makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 80 })
const PROFILE_79 = makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 79 })

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dobInput = () => screen.findByLabelText("Fecha de nacimiento")
const saveButton = () => screen.getByRole("button", { name: /Guardar cambios|Guardando/ })
const spinbuttons = () => screen.getAllByRole("spinbutton") as HTMLInputElement[]
const retryButton = () => screen.getByRole("button", { name: "Reintentar" })
const notice = () => screen.queryByText(NOTICE)

async function typeInto(user: User, input: HTMLElement, text: string) {
  await user.clear(input)
  await user.type(input, text)
}

// Cambia el peso a 79 y guarda; devuelve cuando ya se ve el aviso de relectura.
async function saveWeight79(user: User) {
  await dobInput()
  await typeInto(user, spinbuttons()[1], "79")
  await user.click(saveButton())
  await screen.findByText(NOTICE)
}

// Perfil y mediciones se leen bien la primera vez; las relecturas de mediciones fallan.
function listFailsAfterFirst() {
  listMetricsMock
    .mockResolvedValueOnce([])
    .mockRejectedValue(new ApiError(500, "Error del servidor"))
}

beforeEach(() => {
  getProfileMock.mockReset()
  saveMock.mockReset()
  listMetricsMock.mockReset()
  createMetricMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockResolvedValue({
    email: "ana@example.com",
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
  getProfileMock.mockResolvedValue(PROFILE_80)
  saveMock.mockResolvedValue(PROFILE_79)
  createMetricMock.mockResolvedValue({
    id: "today",
    weight: 79,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at: "2026-10-12",
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PhysicalDataForm - casos límite con el aviso de relectura (REQ-002)", () => {
  // SDD: 020 REQ-002 AC-002.5
  it("guardar solo la meta con el aviso visible no quita el aviso ni 'Reintentar' porque no se ha releído", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)
    saveMock.mockResolvedValue(
      makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 79, goal: "gain" })
    )

    await user.click(screen.getAllByRole("combobox")[1])
    await user.click(await screen.findByRole("option", { name: "Aumentar peso" }))
    await user.click(saveButton())

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(saveButton()).toBeDisabled())
    expect(notice()).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
    expect(createMetricMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 020 REQ-002 AC-002.6
  it("'Reintentar' solo relee y conserva lo editado sin guardar después del aviso", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)
    await typeInto(user, spinbuttons()[1], "75")
    listMetricsMock.mockReset()
    listMetricsMock.mockResolvedValue([])
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(PROFILE_79)

    await user.click(retryButton())

    await waitFor(() => expect(notice()).not.toBeInTheDocument())
    expect(spinbuttons()[1]).toHaveValue(75)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(createMetricMock).toHaveBeenCalledTimes(1)
  })
})
