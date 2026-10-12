// Test de PÁGINA del onboarding (feature 006): el perfil se guarda en el
// servidor, con fecha de nacimiento en lugar de edad. La red se simula en
// api.ts de profile (vi.mock). Se monta la ruta real (OnboardingRoute) y el
// guard para comprobar también la llegada a /home.
import { beforeEach, describe, expect, it, vi } from "vitest"
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
