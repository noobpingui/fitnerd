// Test de PÁGINA del perfil (feature 006): el formulario de datos físicos
// lee y guarda en el servidor. La red se simula en los api.ts (vi.mock).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import { createBodyMetric, listBodyMetrics } from "@/features/body-metrics/api"
import { getProfile, saveProfile } from "@/features/profile/api"
import { HomePage } from "@/features/home/pages/HomePage"
import { MacrosPage } from "@/features/macros/pages/MacrosPage"
import { ProfilePage } from "./ProfilePage"
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

// Perfil del servidor de las pruebas: ft/in y lb, para comprobar las unidades.
const FT_LB_RESPONSE = makeProfileResponse(
  { date_of_birth: "1998-04-03" },
  {
    gender: "female",
    height_unit: "ft",
    height_cm: null,
    height_ft: 5,
    height_in: 9,
    weight_unit: "lb",
    weight: 160,
    activity_level: "high",
    goal: "lose_slow",
  }
)
// Perfil en cm y kg (hombre, moderado, mantener).
const CM_KG_RESPONSE = makeProfileResponse({ date_of_birth: "1998-04-03" })

function renderPage(extra?: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/profile"]}>
        {extra}
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/macros" element={<MacrosPage />} />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dobInput = () => screen.findByLabelText("Fecha de nacimiento")
const saveButton = () => screen.getByRole("button", { name: /Guardar cambios|Guardando/ })
const spinbuttons = () => screen.getAllByRole("spinbutton") as HTMLInputElement[]

async function changeGoalTo(user: User, label: string) {
  await user.click(screen.getAllByRole("combobox")[1])
  await user.click(await screen.findByRole("option", { name: label }))
}

async function typeInto(user: User, input: HTMLElement, text: string) {
  await user.clear(input)
  await user.type(input, text)
}

describe("ProfilePage - datos del servidor", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    listMetricsMock.mockReset()
    createMetricMock.mockReset()
    getCurrentUserMock.mockReset()
    listMetricsMock.mockResolvedValue([])
    getCurrentUserMock.mockResolvedValue({
      email: "ana@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    localStorage.clear()
    // jsdom no implementa estas APIs, que el Select de Radix necesita.
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  // SDD: REQ-010 AC-010.1
  it("precarga el formulario con el perfil y la fecha de nacimiento del servidor", async () => {
    getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
    renderPage()

    expect(await dobInput()).toHaveValue("1998-04-03")
    expect(spinbuttons().map((i) => i.value)).toEqual(["5", "9", "160", "", ""])
    expect(screen.getByRole("button", { name: "Femenino" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "ft / in" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "lb" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    const [activity, goal] = screen.getAllByRole("combobox")
    expect(activity).toHaveTextContent("Alto")
    expect(goal).toHaveTextContent("Perder peso lentamente")
  })

  // SDD: REQ-010 AC-010.2
  it("muestra solo los datos de este usuario aunque otro haya guardado otros en el mismo navegador", async () => {
    getProfileMock.mockResolvedValueOnce(FT_LB_RESPONSE)
    const first = renderPage()
    expect(await dobInput()).toHaveValue("1998-04-03")
    first.unmount()

    getProfileMock.mockResolvedValueOnce(
      makeProfileResponse(
        { date_of_birth: "1985-02-03" },
        { weight: 90, goal: "gain", height_cm: 190 }
      )
    )
    renderPage()

    expect(await dobInput()).toHaveValue("1985-02-03")
    expect(spinbuttons().map((i) => i.value)).toEqual(["190", "90", "", ""])
    expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Aumentar peso")
  })

  // SDD: REQ-010 AC-010.3
  it("no tiene ningún campo de edad numérico", async () => {
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    renderPage()
    await dobInput()

    expect(screen.queryByLabelText("Edad")).not.toBeInTheDocument()
    expect(screen.queryByText("Edad")).not.toBeInTheDocument()
  })

  // SDD: REQ-011 AC-011.1
  it("al cambiar solo la meta envía el perfil completo y no registra ninguna medición", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(makeProfileResponse({}, { goal: "gain" }))
    renderPage()
    await dobInput()

    await changeGoalTo(user, "Aumentar peso")
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock.mock.calls[0][0]).toEqual({
      date_of_birth: "1998-04-03",
      gender: "male",
      height_unit: "cm",
      height_cm: 175,
      height_ft: null,
      height_in: null,
      weight_unit: "kg",
      weight: 72.5,
      activity_level: "moderate",
      goal: "gain",
    })
    expect(createMetricMock).not.toHaveBeenCalled()
  })

  // SDD: REQ-011 AC-011.2
  it("al cambiar el peso envía el perfil y registra una medición de hoy con ese peso en kg", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
    saveMock.mockResolvedValue(FT_LB_RESPONSE)
    createMetricMock.mockResolvedValue({
      id: "m1",
      weight: 74.8,
      body_fat_percentage: null,
      muscle_mass_percentage: null,
      notes: null,
      recorded_at: "2026-10-11",
    })
    renderPage()
    await dobInput()

    // Peso en lb: tercer campo numérico (ft, in, peso, grasa, músculo).
    await typeInto(user, spinbuttons()[2], "165")
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(saveMock.mock.calls[0][0]).toMatchObject({
      weight_unit: "lb",
      weight: 165,
      height_unit: "ft",
      height_ft: 5,
      height_in: 9,
    })
    expect(createMetricMock).toHaveBeenCalledTimes(1)
    // 165 lb = 74,84 kg -> 74,8 (un decimal).
    expect(createMetricMock.mock.calls[0][0]).toMatchObject({ weight: 74.8 })
  })

  // SDD: REQ-011 AC-011.3
  it("al cambiar solo la fecha de nacimiento envía la fecha nueva y no registra medición", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(makeProfileResponse({ date_of_birth: "1999-01-15" }))
    renderPage()

    fireEvent.change(await dobInput(), { target: { value: "1999-01-15" } })
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(saveMock.mock.calls[0][0]).toMatchObject({ date_of_birth: "1999-01-15" })
    expect(createMetricMock).not.toHaveBeenCalled()
  })

  // SDD: REQ-011 AC-011.4
  it("una fecha futura muestra el aviso debajo del campo y deshabilita 'Guardar cambios'", async () => {
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    renderPage()

    fireEvent.change(await dobInput(), { target: { value: "2999-01-01" } })

    expect(
      screen.getByText("La fecha de nacimiento no puede ser futura")
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: REQ-011 AC-011.4
  it("una fecha con menos de 14 años muestra el aviso de rango y deshabilita 'Guardar cambios'", async () => {
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    renderPage()

    fireEvent.change(await dobInput(), { target: { value: "2020-01-01" } })

    expect(screen.getByText("Debes tener entre 14 y 100 años")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 006 REQ-011 AC-011.5
  it("si falla el guardado del perfil muestra el error y conserva lo escrito", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockRejectedValue(new Error("fallo"))
    renderPage()

    fireEvent.change(await dobInput(), { target: { value: "1999-01-15" } })
    await user.click(saveButton())

    expect(
      await screen.findByText(
        "No se pudieron guardar los cambios. Inténtalo de nuevo."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("Cambios guardados")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Fecha de nacimiento")).toHaveValue("1999-01-15")
  })

  // SDD: 006 REQ-011 AC-011.6
  it("si el perfil se guarda pero falla la medición, muestra su error y no 'Cambios guardados'", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(CM_KG_RESPONSE)
    createMetricMock.mockRejectedValue(new Error("fallo"))
    renderPage()
    await dobInput()

    await typeInto(user, spinbuttons()[1], "75")
    await user.click(saveButton())

    expect(
      await screen.findByText("No se pudo guardar la medición. Inténtalo de nuevo.")
    ).toBeInTheDocument()
    expect(screen.queryByText("Cambios guardados")).not.toBeInTheDocument()
  })
})

describe("ProfilePage - las cifras de otras pantallas se actualizan sin recargar", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    listMetricsMock.mockReset()
    listMetricsMock.mockResolvedValue([])
    getCurrentUserMock.mockReset()
    getCurrentUserMock.mockResolvedValue({
      email: "ana@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 006 REQ-011 AC-011.7
  it("tras guardar, /macros y /home muestran las cifras nuevas con una sola lectura del perfil", async () => {
    // Hombre, 28 años el 11-10-2026, 175 cm, 72,5 kg, moderado:
    // mantener = 2315 kcal; aumentar peso (x1,2) = 2778 kcal.
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(makeProfileResponse({}, { goal: "gain" }))
    renderPage(
      <nav>
        <Link to="/macros">Ir a Macros</Link>
        <Link to="/home">Ir a Home</Link>
      </nav>
    )
    await dobInput()

    await changeGoalTo(user, "Aumentar peso")
    await user.click(saveButton())
    await screen.findByText("Cambios guardados")

    await user.click(screen.getByRole("link", { name: "Ir a Macros" }))
    const target = await screen.findByText("Objetivo diario")
    expect(target.parentElement).toHaveTextContent(/2\.?778/)

    await user.click(screen.getByRole("link", { name: "Ir a Home" }))
    expect(await screen.findByText("Meta: Aumentar peso")).toBeInTheDocument()
    expect(screen.getByText(/2\.?778/)).toBeInTheDocument()
    expect(getProfileMock).toHaveBeenCalledTimes(1)
  })
})

describe("ProfilePage - medición del día del usuario (spec 008)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    listMetricsMock.mockReset()
    createMetricMock.mockReset()
    getCurrentUserMock.mockReset()
    listMetricsMock.mockResolvedValue([])
    getCurrentUserMock.mockResolvedValue({
      email: "ana@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
    // 20:00 locales del 12-10-2026: en husos negativos (Costa Rica, UTC-6) la
    // fecha UTC ya sería la del 13, así que distingue "hoy del dispositivo".
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 12, 20, 0))
    createMetricMock.mockResolvedValue({
      id: "m1",
      weight: 80,
      body_fat_percentage: null,
      muscle_mass_percentage: null,
      notes: null,
      recorded_at: "2026-10-12",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-007 AC-007.1
  it("registra la medición con la fecha actual del dispositivo", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(CM_KG_RESPONSE)
    renderPage()
    await dobInput()

    await typeInto(user, spinbuttons()[1], "80")
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(createMetricMock).toHaveBeenCalledTimes(1)
    expect(createMetricMock.mock.calls[0][0]).toMatchObject({
      weight: 80,
      recorded_at: "2026-10-12",
    })
  })

  // SDD: REQ-007 AC-007.2
  it("un segundo guardado el mismo día envía otra medición con la fecha de hoy y el peso nuevo", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(CM_KG_RESPONSE)
    renderPage()
    await dobInput()

    await typeInto(user, spinbuttons()[1], "80")
    await user.click(saveButton())
    await screen.findByText("Cambios guardados")
    await typeInto(user, spinbuttons()[1], "79.5")
    await user.click(saveButton())

    await waitFor(() => expect(createMetricMock).toHaveBeenCalledTimes(2))
    expect(createMetricMock.mock.calls[0][0]).toMatchObject({
      weight: 80,
      recorded_at: "2026-10-12",
    })
    expect(createMetricMock.mock.calls[1][0]).toMatchObject({
      weight: 79.5,
      recorded_at: "2026-10-12",
    })
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.3
  it("la descripción de 'Datos físicos' explica que se guarda la medición de hoy", async () => {
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    renderPage()
    await dobInput()

    expect(
      screen.getByText(
        "Se usan para calcular tus calorías y macros. Cada cambio de peso o composición se guarda como la medición de hoy en tu progreso; si ya hay una de hoy, se actualiza."
      )
    ).toBeInTheDocument()
  })
})
