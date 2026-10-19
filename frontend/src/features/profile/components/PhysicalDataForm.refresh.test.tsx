// Test de «Datos físicos» (spec 020, REQ-002): aviso con «Reintentar» si, tras
// guardar un cambio de peso o composición, falla la relectura de mediciones o
// perfil. Se monta la página del perfil, como en ProfilePage.test.tsx. La red
// se simula en los api.ts (vi.mock). «Hoy» es el lunes 12 de octubre de 2026.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import { createBodyMetric, listBodyMetrics } from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
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
const METRIC_FAILED = "No se pudo guardar la medición. Inténtalo de nuevo."
const PROFILE_80 = makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 80 })
const PROFILE_79 = makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 79 })
const LATER = {
  id: "later",
  weight: 80,
  body_fat_percentage: null,
  muscle_mass_percentage: null,
  notes: null,
  recorded_at: "2026-10-13",
}
const WARNING = `Guardamos tu medición de hoy, pero tu peso del perfil es el de tu medición más reciente, del ${formatDate("2026-10-13")}. Puedes corregirla o borrarla en Métricas.`

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
const saved = () => screen.queryByText("Cambios guardados")

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
    ...LATER,
    id: "today",
    recorded_at: "2026-10-12",
    weight: 79,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PhysicalDataForm - relectura fallida tras guardar (REQ-002)", () => {
  // SDD: 020 REQ-002 AC-002.1
  it("si falla la relectura de mediciones muestra el aviso con 'Reintentar' y no 'Cambios guardados'", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()

    await saveWeight79(user)

    expect(notice()).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
    expect(saved()).not.toBeInTheDocument()
    expect(screen.queryByText(METRIC_FAILED)).not.toBeInTheDocument()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(createMetricMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 020 REQ-002 AC-002.2
  it("el formulario queda con 79, sin cambios pendientes y sin 'Descartar'", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()

    await saveWeight79(user)

    expect(spinbuttons()[1]).toHaveValue(79)
    expect(saveButton()).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-002 AC-002.3
  it("'Reintentar' con éxito y una medición del día 13 muestra el peso 80 y el aviso de la medición posterior", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)
    listMetricsMock.mockReset()
    listMetricsMock.mockResolvedValue([LATER])
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(PROFILE_80)

    await user.click(retryButton())

    expect(await screen.findByText(WARNING)).toBeInTheDocument()
    expect(notice()).not.toBeInTheDocument()
    expect(saved()).not.toBeInTheDocument()
    expect(spinbuttons()[1]).toHaveValue(80)
  })

  // SDD: 020 REQ-002 AC-002.4
  it("'Reintentar' con éxito y sin medición posterior muestra 'Cambios guardados'", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)
    listMetricsMock.mockReset()
    listMetricsMock.mockResolvedValue([])
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(PROFILE_79)

    await user.click(retryButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(notice()).not.toBeInTheDocument()
    expect(screen.queryByText(/Guardamos tu medición de hoy/)).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-002 AC-002.5
  it("'Reintentar' con el servidor aún fallando deja el aviso y no muestra 'Cambios guardados'", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)
    const callsBefore = listMetricsMock.mock.calls.length

    await user.click(retryButton())

    await waitFor(() =>
      expect(listMetricsMock.mock.calls.length).toBeGreaterThan(callsBefore)
    )
    await waitFor(() => expect(retryButton()).toBeEnabled())
    expect(notice()).toBeInTheDocument()
    expect(saved()).not.toBeInTheDocument()
  })

  // SDD: 020 REQ-002 AC-002.6
  it("'Reintentar' no envía ningún guardado de perfil ni registro de medición nuevos", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)
    listMetricsMock.mockReset()
    listMetricsMock.mockResolvedValue([])

    await user.click(retryButton())

    await screen.findByText("Cambios guardados")
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(createMetricMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 020 REQ-002 AC-002.7
  it("el aviso tiene el rol alert y el botón se encuentra por su nombre accesible", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()

    await saveWeight79(user)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(NOTICE)
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })

  // SDD: 020 REQ-002 AC-002.8
  it("si falla la relectura del perfil (y las mediciones van bien) también se ve el aviso", async () => {
    const user = userEvent.setup()
    listMetricsMock.mockResolvedValue([])
    getProfileMock
      .mockResolvedValueOnce(PROFILE_80)
      .mockRejectedValue(new ApiError(500, "Error del servidor"))
    renderPage()

    await saveWeight79(user)

    expect(retryButton()).toBeInTheDocument()
    expect(saved()).not.toBeInTheDocument()
    // El formulario sigue en pantalla: el fallo de la relectura no lo sustituye por el error de carga.
    expect(spinbuttons()[1]).toHaveValue(79)
  })

  // SDD: 020 REQ-002 AC-002.9
  it("un cambio solo de la meta guarda con 'Cambios guardados' y sin aviso de relectura", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    saveMock.mockResolvedValue(makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 80, goal: "gain" }))
    renderPage()
    await dobInput()

    await user.click(screen.getAllByRole("combobox")[1])
    await user.click(await screen.findByRole("option", { name: "Aumentar peso" }))
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(notice()).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument()
    expect(createMetricMock).not.toHaveBeenCalled()
  })

  // SDD: 020 REQ-002 AC-002.10
  it("el aviso sigue visible tras 60 segundos", async () => {
    const user = userEvent.setup()
    listFailsAfterFirst()
    renderPage()
    await saveWeight79(user)

    // A partir de aquí también los temporizadores son falsos.
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    })
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(notice()).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
  })
})
