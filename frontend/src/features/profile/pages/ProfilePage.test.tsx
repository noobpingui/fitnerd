// Test de PÁGINA del perfil (feature 006): el formulario de datos físicos
// lee y guarda en el servidor. La red se simula en los api.ts (vi.mock).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

// ---------------------------------------------------------------------------
// Spec 015: formulario Datos físicos con react-hook-form y zod. "Hoy" fijo:
// 11-10-2026. Con perfil en cm y kg los campos numéricos son
// [altura, peso, grasa, músculo]; con ft/lb, [ft, in, peso, grasa, músculo].
// ---------------------------------------------------------------------------

const FUTURE_MESSAGE = "La fecha de nacimiento no puede ser futura"
const RANGE_MESSAGE = "Debes tener entre 14 y 100 años"
const REQUIRED_MESSAGE = "Indica tu fecha de nacimiento"
const discardButton = () => screen.queryByRole("button", { name: "Descartar" })
const setValue = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } })

function setupMocks() {
  getProfileMock.mockReset()
  saveMock.mockReset()
  listMetricsMock.mockReset()
  createMetricMock.mockReset()
  getCurrentUserMock.mockReset()
  listMetricsMock.mockResolvedValue([])
  getCurrentUserMock.mockResolvedValue({
    email: "ana@example.com",
  } as Awaited<ReturnType<typeof getCurrentUser>>)
  createMetricMock.mockResolvedValue({
    id: "m1",
    weight: 80,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at: "2026-10-11",
  })
  localStorage.clear()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
}

describe("ProfilePage - reglas de validación (spec 015)", () => {
  beforeEach(() => {
    setupMocks()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 015 REQ-001 AC-001.1
  it.each(["2012-10-11", "1925-10-12"])(
    "la fecha %s (límite de edad) no muestra aviso y 'Guardar cambios' queda habilitado",
    async (value) => {
      renderPage()

      setValue(await dobInput(), value)

      expect(screen.queryByText(FUTURE_MESSAGE)).not.toBeInTheDocument()
      expect(screen.queryByText(RANGE_MESSAGE)).not.toBeInTheDocument()
      expect(saveButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-001 AC-001.2
  it("una fecha futura (2026-10-12) muestra el aviso y deshabilita 'Guardar cambios'", async () => {
    renderPage()

    setValue(await dobInput(), "2026-10-12")

    expect(screen.getByText(FUTURE_MESSAGE)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 015 REQ-001 AC-001.3
  it.each(["2012-10-12", "1925-10-11"])(
    "la fecha %s (13 o 101 años) muestra el aviso de rango y deshabilita 'Guardar cambios'",
    async (value) => {
      renderPage()

      setValue(await dobInput(), value)

      expect(screen.getByText(RANGE_MESSAGE)).toBeInTheDocument()
      expect(saveButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-002 AC-002.1
  it("al vaciar la fecha muestra 'Indica tu fecha de nacimiento', marca el campo y deshabilita guardar", async () => {
    renderPage()

    setValue(await dobInput(), "")

    expect(screen.getByText(REQUIRED_MESSAGE)).toBeInTheDocument()
    expect(screen.getByLabelText("Fecha de nacimiento")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 015 REQ-002 AC-002.2
  it("al introducir una fecha válida tras vaciarla, el mensaje desaparece y guardar se habilita", async () => {
    renderPage()
    const input = await dobInput()
    setValue(input, "")
    expect(screen.getByText(REQUIRED_MESSAGE)).toBeInTheDocument()

    setValue(input, "1999-01-15")

    expect(screen.queryByText(REQUIRED_MESSAGE)).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  // SDD: 015 REQ-003 AC-003.1
  it.each(["100", "250"])(
    "una altura de %s cm no muestra mensaje y guardar queda habilitado",
    async (cm) => {
      renderPage()
      await dobInput()

      setValue(spinbuttons()[0], cm)

      expect(screen.queryByText(/^Entre \d+ y \d+ cm$/)).not.toBeInTheDocument()
      expect(saveButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-003 AC-003.2
  it.each(["99", "251", ""])(
    "una altura de '%s' cm muestra 'Entre 100 y 250 cm', marca el campo y deshabilita guardar",
    async (cm) => {
      renderPage()
      await dobInput()

      setValue(spinbuttons()[0], cm)

      expect(screen.getByText("Entre 100 y 250 cm")).toBeInTheDocument()
      expect(spinbuttons()[0]).toHaveAttribute("aria-invalid", "true")
      expect(saveButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-003 AC-003.3
  it("5 ft con las pulgadas vacías es una altura válida", async () => {
    getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
    renderPage()
    await dobInput()

    setValue(spinbuttons()[1], "")

    expect(screen.queryByText("Entre 3 y 8 ft")).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  // SDD: 015 REQ-003 AC-003.4
  it.each([
    ["2", "9"],
    ["9", "9"],
    ["5", "12"],
  ])(
    "%s ft con %s in muestra 'Entre 3 y 8 ft' y deshabilita guardar",
    async (ft, inches) => {
      getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
      renderPage()
      await dobInput()

      setValue(spinbuttons()[0], ft)
      setValue(spinbuttons()[1], inches)

      expect(screen.getByText("Entre 3 y 8 ft")).toBeInTheDocument()
      expect(spinbuttons()[0]).toHaveAttribute("aria-invalid", "true")
      expect(spinbuttons()[1]).toHaveAttribute("aria-invalid", "true")
      expect(saveButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-003 AC-003.5
  it.each([
    ["5.5", "9"],
    ["5", "2.5"],
  ])(
    "%s ft con %s in (decimales) muestra 'Entre 3 y 8 ft' y deshabilita guardar",
    async (ft, inches) => {
      getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
      renderPage()
      await dobInput()

      setValue(spinbuttons()[0], ft)
      setValue(spinbuttons()[1], inches)

      expect(screen.getByText("Entre 3 y 8 ft")).toBeInTheDocument()
      expect(saveButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-004 AC-004.1
  it.each(["30", "300"])(
    "un peso de %s kg no muestra mensaje y guardar queda habilitado",
    async (kg) => {
      renderPage()
      await dobInput()

      setValue(spinbuttons()[1], kg)

      expect(screen.queryByText("Entre 30 y 300 kg")).not.toBeInTheDocument()
      expect(saveButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-004 AC-004.2
  it.each(["29.9", "300.1", ""])(
    "un peso de '%s' kg muestra 'Entre 30 y 300 kg', marca el campo y deshabilita guardar",
    async (kg) => {
      renderPage()
      await dobInput()

      setValue(spinbuttons()[1], kg)

      expect(screen.getByText("Entre 30 y 300 kg")).toBeInTheDocument()
      expect(spinbuttons()[1]).toHaveAttribute("aria-invalid", "true")
      expect(saveButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-004 AC-004.3
  it.each(["66", "660"])(
    "un peso de %s lb no muestra mensaje",
    async (lb) => {
      getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
      renderPage()
      await dobInput()

      setValue(spinbuttons()[2], lb)

      expect(screen.queryByText("Entre 66 y 660 lb")).not.toBeInTheDocument()
      expect(saveButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-004 AC-004.3
  it.each(["65.9", "660.1"])(
    "un peso de %s lb muestra 'Entre 66 y 660 lb' y deshabilita guardar",
    async (lb) => {
      getProfileMock.mockResolvedValue(FT_LB_RESPONSE)
      renderPage()
      await dobInput()

      setValue(spinbuttons()[2], lb)

      expect(screen.getByText("Entre 66 y 660 lb")).toBeInTheDocument()
      expect(saveButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-005 AC-005.1
  it("grasa y músculo vacíos o en sus límites no muestran mensaje", async () => {
    renderPage()
    await dobInput()

    expect(screen.queryByText(/^Entre \d+ y \d+ %$/)).not.toBeInTheDocument()
    for (const [fat, muscle] of [
      ["3", "10"],
      ["60", "70"],
    ]) {
      setValue(spinbuttons()[2], fat)
      setValue(spinbuttons()[3], muscle)
      expect(screen.queryByText(/^Entre \d+ y \d+ %$/)).not.toBeInTheDocument()
      expect(saveButton()).toBeEnabled()
    }
  })

  // SDD: 015 REQ-005 AC-005.2
  it("61 en grasa corporal muestra 'Entre 3 y 60 %' y deshabilita guardar", async () => {
    renderPage()
    await dobInput()

    setValue(screen.getByLabelText("% Grasa corporal (opcional)"), "61")

    expect(screen.getByText("Entre 3 y 60 %")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 015 REQ-005 AC-005.3
  it("9 en masa muscular muestra 'Entre 10 y 70 %' y deshabilita guardar", async () => {
    renderPage()
    await dobInput()

    setValue(screen.getByLabelText("% Masa muscular (opcional)"), "9")

    expect(screen.getByText("Entre 10 y 70 %")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 015 REQ-006 AC-006.3
  it("72 kg se convierte a 158.7 lb al elegir 'lb'", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse({ date_of_birth: "1998-04-03" }, { weight: 72 })
    )
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await user.click(screen.getByRole("button", { name: "lb" }))

    expect(spinbuttons()[1]).toHaveValue(158.7)
  })

  // SDD: 015 REQ-006 AC-006.1
  it("175 cm se convierte a 5 ft 9 in al elegir 'ft / in'", async () => {
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await user.click(screen.getByRole("button", { name: "ft / in" }))

    expect(spinbuttons().slice(0, 2).map((i) => i.value)).toEqual(["5", "9"])
  })

  // SDD: 015 REQ-010 AC-010.1
  it("un perfil sin fecha de nacimiento muestra el aviso desde la carga", async () => {
    getProfileMock.mockResolvedValue(makeProfileResponse({ date_of_birth: null }))
    renderPage()

    await dobInput()

    expect(screen.getByText(REQUIRED_MESSAGE)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 015 REQ-010 AC-010.2
  it("al escribir 500 en el peso el aviso se ve sin pulsar guardar", async () => {
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await typeInto(user, spinbuttons()[1], "500")

    expect(screen.getByText("Entre 30 y 300 kg")).toBeInTheDocument()
  })
})

describe("ProfilePage - guardado del formulario (spec 015)", () => {
  beforeEach(() => {
    setupMocks()
    getProfileMock.mockResolvedValue(CM_KG_RESPONSE)
    saveMock.mockResolvedValue(CM_KG_RESPONSE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 015 REQ-009 AC-009.1
  it("recién cargado, 'Guardar cambios' está deshabilitado y 'Descartar' no aparece", async () => {
    renderPage()
    await dobInput()

    expect(saveButton()).toBeDisabled()
    expect(discardButton()).not.toBeInTheDocument()
  })

  // SDD: 015 REQ-009 AC-009.2
  it("'Descartar' restaura los valores cargados y desaparece junto con la habilitación de guardar", async () => {
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await changeGoalTo(user, "Aumentar peso")
    await typeInto(user, spinbuttons()[1], "80")
    expect(discardButton()).toBeInTheDocument()
    expect(saveButton()).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Descartar" }))

    expect(spinbuttons()[1]).toHaveValue(72.5)
    expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Mantener peso")
    expect(discardButton()).not.toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 015 REQ-009 AC-009.3
  it("cambiar solo la unidad del peso envía weight_unit lb y no registra medición", async () => {
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await user.click(screen.getByRole("button", { name: "lb" }))
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock.mock.calls[0][0]).toMatchObject({ weight_unit: "lb" })
    expect(createMetricMock).not.toHaveBeenCalled()
  })

  // SDD: 015 REQ-009 AC-009.4
  it("cambiar solo el músculo a 40 con grasa 20 guardada registra la medición sin body_fat_percentage", async () => {
    const user = userEvent.setup()
    listMetricsMock.mockResolvedValue([
      {
        id: "m0",
        weight: 72.5,
        body_fat_percentage: 20,
        muscle_mass_percentage: null,
        notes: null,
        recorded_at: "2026-10-01",
      },
    ])
    renderPage()
    await dobInput()
    await waitFor(() => expect(spinbuttons()[2]).toHaveValue(20))

    await typeInto(user, spinbuttons()[3], "40")
    await user.click(saveButton())

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()
    expect(createMetricMock).toHaveBeenCalledTimes(1)
    const body = createMetricMock.mock.calls[0][0]
    expect(body).toMatchObject({ muscle_mass_percentage: 40 })
    expect(body).not.toHaveProperty("body_fat_percentage")
  })

  // SDD: 015 REQ-009 AC-009.5
  it("'Cambios guardados' desaparece a los 3 segundos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await dobInput()

    await changeGoalTo(user, "Aumentar peso")
    await user.click(saveButton())
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() =>
      expect(screen.queryByText("Cambios guardados")).not.toBeInTheDocument()
    )
  })

  // SDD: 015 REQ-009 AC-009.5
  it("'Cambios guardados' desaparece al modificar cualquier campo antes de los 3 segundos", async () => {
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await changeGoalTo(user, "Aumentar peso")
    await user.click(saveButton())
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument()

    setValue(spinbuttons()[1], "73")

    expect(screen.queryByText("Cambios guardados")).not.toBeInTheDocument()
  })

  // SDD: 015 REQ-009 AC-009.6
  it("tras guardar el peso 80, cambiarlo a 79.5 registra una segunda medición con 79.5", async () => {
    const user = userEvent.setup()
    renderPage()
    await dobInput()

    await typeInto(user, spinbuttons()[1], "80")
    await user.click(saveButton())
    await screen.findByText("Cambios guardados")
    await typeInto(user, spinbuttons()[1], "79.5")
    await user.click(saveButton())

    await waitFor(() => expect(createMetricMock).toHaveBeenCalledTimes(2))
    expect(createMetricMock.mock.calls[0][0]).toMatchObject({ weight: 80 })
    expect(createMetricMock.mock.calls[1][0]).toMatchObject({ weight: 79.5 })
  })
})
