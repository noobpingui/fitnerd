// Test de PÁGINA del onboarding (feature 006): el perfil se guarda en el
// servidor, con fecha de nacimiento en lugar de edad. La red se simula en
// api.ts de profile (vi.mock). Se monta la ruta real (OnboardingRoute) y el
// guard para comprobar también la llegada a /home.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router"
import { OnboardingGuard } from "@/app/OnboardingGuard"
import { OnboardingRoute } from "@/app/OnboardingRoute"
import { getProfile, saveProfile } from "@/features/profile/api"
import { makePendingResponse, makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)
const saveMock = vi.mocked(saveProfile)

type User = ReturnType<typeof userEvent.setup>

const DOB_TITLE = "¿Cuál es tu fecha de nacimiento?"

function renderOnboarding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route element={<OnboardingGuard />}>
            <Route path="/home" element={<div>Pantalla Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const heading = (name: string) => screen.findByRole("heading", { name })
const next = (user: User) =>
  user.click(screen.getByRole("button", { name: "Siguiente" }))

// Responde el género y espera a la pregunta de la fecha de nacimiento.
async function toDateStep(user: User) {
  await user.click(await screen.findByText("Masculino"))
  await heading(DOB_TITLE)
}

// Desde la pregunta de la fecha hasta la meta (cm y kg), sin pulsar Comenzar.
async function fromDateToGoal(
  user: User,
  opts: { dob?: string; feetAndPounds?: boolean } = {}
) {
  if (opts.dob !== undefined) {
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: opts.dob },
    })
  }
  await next(user)

  await heading("¿Cuánto mides?")
  if (opts.feetAndPounds) {
    await user.click(screen.getByRole("button", { name: "ft / in" }))
    await user.type(screen.getByPlaceholderText("5"), "5")
    await user.type(screen.getByPlaceholderText("9"), "9")
  } else {
    await user.type(screen.getByPlaceholderText("Ej. 175"), "175")
  }
  await next(user)

  await heading("¿Cuánto pesas?")
  if (opts.feetAndPounds) {
    await user.click(screen.getByRole("button", { name: "lb" }))
    await user.type(screen.getByPlaceholderText("Ej. 160"), "160")
  } else {
    await user.type(screen.getByPlaceholderText("Ej. 72"), "72")
  }
  await next(user)

  await heading("¿Cuál es tu nivel de actividad física?")
  await user.click(screen.getByText(opts.feetAndPounds ? "Alto" : "Moderado"))

  await heading("¿Cuál es tu meta?")
  await user.click(
    screen.getByText(opts.feetAndPounds ? "Perder peso lentamente" : "Mantener peso")
  )
}

const start = (user: User) =>
  user.click(screen.getByRole("button", { name: "Comenzar" }))

describe("OnboardingPage - guardar el perfil en el servidor", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
  })

  // SDD: REQ-008 AC-008.1
  it("envía el perfil con las unidades elegidas, la fecha de nacimiento y sin age", async () => {
    const user = userEvent.setup()
    saveMock.mockResolvedValue(makeProfileResponse())
    renderOnboarding()

    await toDateStep(user)
    await fromDateToGoal(user, { feetAndPounds: true })
    await start(user)

    await screen.findByText("Pantalla Home")
    expect(saveMock).toHaveBeenCalledTimes(1)
    const payload = saveMock.mock.calls[0][0]
    expect(payload).toEqual({
      date_of_birth: "1996-03-01",
      gender: "male",
      height_unit: "ft",
      height_cm: null,
      height_ft: 5,
      height_in: 9,
      weight_unit: "lb",
      weight: 160,
      activity_level: "high",
      goal: "lose_slow",
    })
    expect(payload).not.toHaveProperty("age")
  })

  // SDD: REQ-008 AC-008.2
  it("al guardar con éxito llega a /home sin volver a /onboarding", async () => {
    const user = userEvent.setup()
    saveMock.mockResolvedValue(makeProfileResponse())
    renderOnboarding()

    await toDateStep(user)
    await fromDateToGoal(user)
    await start(user)

    expect(await screen.findByText("Pantalla Home")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "¿Cuál es tu género?" })
    ).not.toBeInTheDocument()
  })

  // SDD: REQ-008 AC-008.3
  it("mientras guarda el botón está deshabilitado con 'Guardando…' y un segundo clic no envía otro guardado", async () => {
    const user = userEvent.setup()
    saveMock.mockReturnValue(new Promise(() => {}))
    renderOnboarding()

    await toDateStep(user)
    await fromDateToGoal(user)
    await start(user)

    const button = await screen.findByRole("button", { name: "Guardando…" })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  // SDD: REQ-008 AC-008.4
  it("si el guardado falla muestra el error, conserva las respuestas y deja reintentar", async () => {
    const user = userEvent.setup()
    saveMock.mockRejectedValue(new Error("fallo"))
    renderOnboarding()

    await toDateStep(user)
    await fromDateToGoal(user)
    await start(user)

    expect(
      await screen.findByText("No se pudo guardar tu perfil. Inténtalo de nuevo.")
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "¿Cuál es tu meta?" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Mantener peso/ })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeEnabled()
    expect(screen.queryByText("Pantalla Home")).not.toBeInTheDocument()
  })
})

describe("OnboardingPage - pregunta de la fecha de nacimiento", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
  })

  // SDD: REQ-009 AC-009.1
  it("con fecha en la cuenta muestra la pregunta prerrellenada y 'Siguiente' habilitado", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1995-05-20"))
    renderOnboarding()

    await toDateStep(user)

    expect(screen.getByLabelText("Fecha de nacimiento")).toHaveValue("1995-05-20")
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled()
  })

  // SDD: REQ-009 AC-009.2
  it("sin fecha en la cuenta el campo está vacío y 'Siguiente' deshabilitado hasta introducir una válida", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse(null))
    renderOnboarding()

    await toDateStep(user)

    expect(screen.getByLabelText("Fecha de nacimiento")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "1996-03-01" },
    })

    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled()
  })

  // SDD: REQ-009 AC-009.3
  it("una fecha futura muestra el aviso y deshabilita 'Siguiente'", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse(null))
    renderOnboarding()
    await toDateStep(user)

    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "2999-01-01" },
    })

    expect(
      screen.getByText("La fecha de nacimiento no puede ser futura")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.4
  it("una fecha con menos de 14 años muestra el aviso de rango y deshabilita 'Siguiente'", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse(null))
    renderOnboarding()
    await toDateStep(user)

    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "2020-01-01" },
    })

    expect(screen.getByText("Debes tener entre 14 y 100 años")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.4
  it("una fecha prerrellenada de más de 100 años también muestra el aviso de rango", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1900-01-01"))
    renderOnboarding()

    await toDateStep(user)

    expect(screen.getByText("Debes tener entre 14 y 100 años")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled()
  })

  // SDD: REQ-009 AC-009.5
  it("si cambia la fecha prerrellenada, el servidor recibe la fecha nueva", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1995-05-20"))
    saveMock.mockResolvedValue(makeProfileResponse())
    renderOnboarding()

    await toDateStep(user)
    await fromDateToGoal(user, { dob: "1999-12-31" })
    await start(user)

    await screen.findByText("Pantalla Home")
    expect(saveMock.mock.calls[0][0]).toMatchObject({ date_of_birth: "1999-12-31" })
  })

  // SDD: REQ-009 AC-009.6
  it("ninguna pregunta pide la edad como número", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1995-05-20"))
    renderOnboarding()

    await toDateStep(user)

    expect(screen.queryByText("¿Cuántos años tienes?")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Ej. 28")).not.toBeInTheDocument()
    expect(screen.queryByText("años")).not.toBeInTheDocument()
  })

  // SDD: REQ-013 AC-013.2
  it("al terminar, el almacenamiento del navegador no contiene las respuestas del perfil", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
    saveMock.mockResolvedValue(makeProfileResponse())
    renderOnboarding()

    await toDateStep(user)
    await fromDateToGoal(user)
    await start(user)
    await screen.findByText("Pantalla Home")

    expect(localStorage.getItem("fitnerd_onboarding_mock")).toBeNull()
    const stored = JSON.stringify(Object.entries(localStorage))
    expect(stored).not.toContain("1996-03-01")
    expect(stored).not.toContain("maintain")
  })
})

// ---------------------------------------------------------------------------
// Spec 015: formulario con react-hook-form y zod. Mismo comportamiento visible
// salvo ft/in enteros (AC-003.5). "Hoy" fijo: 11-10-2026.
// ---------------------------------------------------------------------------

const FUTURE_MESSAGE = "La fecha de nacimiento no puede ser futura"
const RANGE_MESSAGE = "Debes tener entre 14 y 100 años"
const REQUIRED_MESSAGE = "Indica tu fecha de nacimiento"
const dobField = () => screen.getByLabelText("Fecha de nacimiento")
const nextButton = () => screen.getByRole("button", { name: "Siguiente" })
const noRangeMessage = () =>
  expect(screen.queryByText(/^Entre \d+ y \d+/)).not.toBeInTheDocument()

async function toHeightStep(user: User) {
  await toDateStep(user)
  await next(user)
  await heading("¿Cuánto mides?")
}

async function toWeightStep(user: User) {
  await toHeightStep(user)
  await user.type(screen.getByPlaceholderText("Ej. 175"), "175")
  await next(user)
  await heading("¿Cuánto pesas?")
}

describe("OnboardingPage - reglas de validación (spec 015)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 015 REQ-001 AC-001.1
  it.each(["2012-10-11", "1925-10-12"])(
    "la fecha %s (límite de edad) no muestra aviso y habilita 'Siguiente'",
    async (value) => {
      const user = userEvent.setup()
      renderOnboarding()
      await toDateStep(user)

      fireEvent.change(dobField(), { target: { value } })

      expect(screen.queryByText(FUTURE_MESSAGE)).not.toBeInTheDocument()
      expect(screen.queryByText(RANGE_MESSAGE)).not.toBeInTheDocument()
      expect(nextButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-001 AC-001.2
  it("una fecha futura (2026-10-12) muestra el aviso y deshabilita 'Siguiente'", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toDateStep(user)

    fireEvent.change(dobField(), { target: { value: "2026-10-12" } })

    expect(screen.getByText(FUTURE_MESSAGE)).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })

  // SDD: 015 REQ-001 AC-001.3
  it.each(["2012-10-12", "1925-10-11"])(
    "la fecha %s (13 o 101 años) muestra el aviso de rango y deshabilita 'Siguiente'",
    async (value) => {
      const user = userEvent.setup()
      renderOnboarding()
      await toDateStep(user)

      fireEvent.change(dobField(), { target: { value } })

      expect(screen.getByText(RANGE_MESSAGE)).toBeInTheDocument()
      expect(nextButton()).toBeDisabled()
    }
  )

  // SDD: 015 REQ-001 AC-001.4
  it("con el campo de fecha vacío no se muestra ningún mensaje y 'Siguiente' está deshabilitado", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse(null))
    renderOnboarding()
    await toDateStep(user)

    expect(dobField()).toHaveValue("")
    expect(screen.queryByText(REQUIRED_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(FUTURE_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(RANGE_MESSAGE)).not.toBeInTheDocument()
    expect(nextButton()).toBeDisabled()

    // Vaciar una fecha que era válida tampoco muestra mensaje.
    fireEvent.change(dobField(), { target: { value: "1996-03-01" } })
    fireEvent.change(dobField(), { target: { value: "" } })
    expect(screen.queryByText(REQUIRED_MESSAGE)).not.toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })

  // SDD: 015 REQ-003 AC-003.1
  it.each(["100", "250"])(
    "una altura de %s cm habilita 'Siguiente'",
    async (cm) => {
      const user = userEvent.setup()
      renderOnboarding()
      await toHeightStep(user)

      await user.type(screen.getByPlaceholderText("Ej. 175"), cm)

      expect(nextButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-003 AC-003.2
  it("una altura de 99 cm, 251 cm o vacía deja 'Siguiente' deshabilitado sin mensaje", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toHeightStep(user)

    expect(nextButton()).toBeDisabled()
    for (const cm of ["99", "251"]) {
      fireEvent.change(screen.getByPlaceholderText("Ej. 175"), {
        target: { value: cm },
      })
      expect(nextButton()).toBeDisabled()
      noRangeMessage()
    }
  })

  // SDD: 015 REQ-003 AC-003.3
  it("5 ft con las pulgadas vacías habilita 'Siguiente'", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toHeightStep(user)

    await user.click(screen.getByRole("button", { name: "ft / in" }))
    await user.type(screen.getByPlaceholderText("5"), "5")

    expect(nextButton()).toBeEnabled()
  })

  // SDD: 015 REQ-003 AC-003.4
  it.each([
    ["2", ""],
    ["9", ""],
    ["5", "12"],
  ])(
    "%s ft con '%s' in (fuera de rango) deja 'Siguiente' deshabilitado sin mensaje",
    async (ft, inches) => {
      const user = userEvent.setup()
      renderOnboarding()
      await toHeightStep(user)

      await user.click(screen.getByRole("button", { name: "ft / in" }))
      await user.type(screen.getByPlaceholderText("5"), ft)
      if (inches) await user.type(screen.getByPlaceholderText("9"), inches)

      expect(nextButton()).toBeDisabled()
      noRangeMessage()
    }
  )

  // SDD: 015 REQ-003 AC-003.5
  it.each([
    ["5.5", ""],
    ["5", "2.5"],
  ])(
    "%s ft con '%s' in (decimales) deja 'Siguiente' deshabilitado sin mensaje",
    async (ft, inches) => {
      const user = userEvent.setup()
      renderOnboarding()
      await toHeightStep(user)

      await user.click(screen.getByRole("button", { name: "ft / in" }))
      await user.type(screen.getByPlaceholderText("5"), ft)
      if (inches) await user.type(screen.getByPlaceholderText("9"), inches)

      expect(nextButton()).toBeDisabled()
      noRangeMessage()
    }
  )

  // SDD: 015 REQ-004 AC-004.1
  it.each(["30", "300", "72.5"])(
    "un peso de %s kg habilita 'Siguiente'",
    async (kg) => {
      const user = userEvent.setup()
      renderOnboarding()
      await toWeightStep(user)

      await user.type(screen.getByPlaceholderText("Ej. 72"), kg)

      expect(nextButton()).toBeEnabled()
    }
  )

  // SDD: 015 REQ-004 AC-004.2
  it("un peso de 29.9 kg, 300.1 kg o vacío deja 'Siguiente' deshabilitado sin mensaje", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toWeightStep(user)

    expect(nextButton()).toBeDisabled()
    for (const kg of ["29.9", "300.1"]) {
      fireEvent.change(screen.getByPlaceholderText("Ej. 72"), {
        target: { value: kg },
      })
      expect(nextButton()).toBeDisabled()
      noRangeMessage()
    }
  })

  // SDD: 015 REQ-004 AC-004.3
  it("en lb, 66 y 660 habilitan 'Siguiente'; 65.9 y 660.1 lo deshabilitan sin mensaje", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toWeightStep(user)

    await user.click(screen.getByRole("button", { name: "lb" }))
    const field = () => screen.getByPlaceholderText("Ej. 160")
    for (const lb of ["66", "660"]) {
      fireEvent.change(field(), { target: { value: lb } })
      expect(nextButton()).toBeEnabled()
    }
    for (const lb of ["65.9", "660.1"]) {
      fireEvent.change(field(), { target: { value: lb } })
      expect(nextButton()).toBeDisabled()
      noRangeMessage()
    }
  })
})

describe("OnboardingPage - conversión de unidades (spec 015)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
  })

  // SDD: 015 REQ-006 AC-006.1
  it("175 cm se convierte a 5 ft 9 in y vuelve a 175 cm", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toHeightStep(user)
    await user.type(screen.getByPlaceholderText("Ej. 175"), "175")

    await user.click(screen.getByRole("button", { name: "ft / in" }))
    expect(screen.getByPlaceholderText("5")).toHaveValue(5)
    expect(screen.getByPlaceholderText("9")).toHaveValue(9)

    await user.click(screen.getByRole("button", { name: "cm" }))
    expect(screen.getByPlaceholderText("Ej. 175")).toHaveValue(175)
  })

  // SDD: 015 REQ-006 AC-006.4
  it("una altura no válida (1750 cm) cambia solo la unidad y un peso no válido (20 kg) conserva el texto", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toHeightStep(user)
    await user.type(screen.getByPlaceholderText("Ej. 175"), "1750")

    await user.click(screen.getByRole("button", { name: "ft / in" }))
    expect(screen.getByPlaceholderText("5")).toHaveValue(null)
    expect(screen.getByPlaceholderText("9")).toHaveValue(null)

    await user.click(screen.getByRole("button", { name: "cm" }))
    fireEvent.change(screen.getByPlaceholderText("Ej. 175"), {
      target: { value: "175" },
    })
    await next(user)
    await heading("¿Cuánto pesas?")
    await user.type(screen.getByPlaceholderText("Ej. 72"), "20")

    await user.click(screen.getByRole("button", { name: "lb" }))
    expect(screen.getByPlaceholderText("Ej. 160")).toHaveValue(20)
  })
})

describe("OnboardingPage - flujo del asistente (spec 015)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
  })

  // SDD: 015 REQ-007 AC-007.1
  it("al elegir 'Masculino' pasa sola a la fecha de nacimiento y el indicador muestra '2 de 6'", async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(await screen.findByText("Masculino"))

    await heading(DOB_TITLE)
    expect(screen.getByText("2 de 6")).toBeInTheDocument()
  })

  // SDD: 015 REQ-007 AC-007.2
  it("con 175 cm escrito, Enter en el campo pasa a '¿Cuánto pesas?'", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toHeightStep(user)

    await user.type(screen.getByPlaceholderText("Ej. 175"), "175{Enter}")

    await heading("¿Cuánto pesas?")
  })

  // SDD: 015 REQ-007 AC-007.3
  it("'Atrás' desde el peso vuelve a la altura con 175 en el campo y 'Siguiente' habilitado", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toWeightStep(user)

    await user.click(screen.getByRole("button", { name: "Atrás" }))

    await heading("¿Cuánto mides?")
    expect(screen.getByPlaceholderText("Ej. 175")).toHaveValue(175)
    expect(nextButton()).toBeEnabled()
  })

  // SDD: 015 REQ-007 AC-007.4
  it("en la meta, elegir una opción no avanza sola y 'Comenzar' queda habilitado", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toDateStep(user)
    await fromDateToGoal(user)

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(screen.getByRole("heading", { name: "¿Cuál es tu meta?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeEnabled()
  })

  // SDD: 015 REQ-007 AC-007.5
  it("la fecha prerrellenada 1995-05-20 deja 'Siguiente' habilitado", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1995-05-20"))
    renderOnboarding()
    await toDateStep(user)

    expect(dobField()).toHaveValue("1995-05-20")
    expect(nextButton()).toBeEnabled()
  })

  // SDD: 015 REQ-007 AC-007.5
  it("la fecha prerrellenada 1900-01-01 muestra el aviso de rango sin tocar el campo", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(makePendingResponse("1900-01-01"))
    renderOnboarding()
    await toDateStep(user)

    expect(screen.getByText(RANGE_MESSAGE)).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })
})

describe("OnboardingPage - envío (spec 015)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
  })

  // SDD: 015 REQ-008 AC-008.1
  it("5 ft con pulgadas vacías y 160 lb envían height_in 0 y no incluyen age", async () => {
    const user = userEvent.setup()
    saveMock.mockResolvedValue(makeProfileResponse())
    renderOnboarding()
    await toHeightStep(user)

    await user.click(screen.getByRole("button", { name: "ft / in" }))
    await user.type(screen.getByPlaceholderText("5"), "5")
    await next(user)
    await heading("¿Cuánto pesas?")
    await user.click(screen.getByRole("button", { name: "lb" }))
    await user.type(screen.getByPlaceholderText("Ej. 160"), "160")
    await next(user)
    await heading("¿Cuál es tu nivel de actividad física?")
    await user.click(screen.getByText("Moderado"))
    await heading("¿Cuál es tu meta?")
    await user.click(screen.getByText("Mantener peso"))
    await start(user)

    await screen.findByText("Pantalla Home")
    expect(saveMock).toHaveBeenCalledTimes(1)
    const payload = saveMock.mock.calls[0][0]
    expect(payload).toMatchObject({
      height_unit: "ft",
      height_cm: null,
      height_ft: 5,
      height_in: 0,
      weight_unit: "lb",
      weight: 160,
    })
    expect(payload).not.toHaveProperty("age")
  })

  // SDD: 015 REQ-008 AC-008.2
  it("175 cm y 72 kg envían los campos de cm, los de ft/in a null y la fecha introducida", async () => {
    const user = userEvent.setup()
    saveMock.mockResolvedValue(makeProfileResponse())
    renderOnboarding()
    await toDateStep(user)
    await fromDateToGoal(user)
    await start(user)

    await screen.findByText("Pantalla Home")
    expect(saveMock.mock.calls[0][0]).toMatchObject({
      date_of_birth: "1996-03-01",
      height_unit: "cm",
      height_cm: 175,
      height_ft: null,
      height_in: null,
      weight_unit: "kg",
      weight: 72,
    })
  })

  // SDD: 015 REQ-008 AC-008.3
  it("un doble clic en 'Comenzar' envía un solo guardado y muestra 'Guardando…' deshabilitado", async () => {
    const user = userEvent.setup()
    saveMock.mockReturnValue(new Promise(() => {}))
    renderOnboarding()
    await toDateStep(user)
    await fromDateToGoal(user)

    await user.dblClick(screen.getByRole("button", { name: "Comenzar" }))

    const button = await screen.findByRole("button", { name: "Guardando…" })
    expect(button).toBeDisabled()
    expect(saveMock).toHaveBeenCalledTimes(1)
  })
})

describe("OnboardingPage - preguntas obligatorias sin responder (regresión F1)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    saveMock.mockReset()
    localStorage.clear()
    getProfileMock.mockResolvedValue(makePendingResponse("1996-03-01"))
  })

  // SDD: 015 REQ-007 AC-007.4
  it("en el género sin elegir no hay botón 'Siguiente'", async () => {
    renderOnboarding()

    await screen.findByText("Masculino")

    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument()
  })

  // SDD: 015 REQ-007 AC-007.4
  it("en la meta sin elegir, 'Comenzar' está deshabilitado y no se envía nada", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    await toDateStep(user)
    await next(user)
    await heading("¿Cuánto mides?")
    await user.type(screen.getByPlaceholderText("Ej. 175"), "175")
    await next(user)
    await heading("¿Cuánto pesas?")
    await user.type(screen.getByPlaceholderText("Ej. 72"), "72")
    await next(user)
    await heading("¿Cuál es tu nivel de actividad física?")
    await user.click(screen.getByText("Moderado"))
    await heading("¿Cuál es tu meta?")

    const button = screen.getByRole("button", { name: "Comenzar" })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(saveMock).not.toHaveBeenCalled()
  })
})
