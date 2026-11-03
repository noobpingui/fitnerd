// Test de PÁGINA del coach (spec 034): interruptor de datos personales y
// contexto que viaja con cada pregunta. La red se simula en las capas api.ts
// (vi.mock); el resto (hooks, caché, cálculo de macros e indicadores) es real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { askCoach, sendCoachFeedback } from "@/features/coach/api"
import { getProfile } from "@/features/profile/api"
import { listBodyMetrics } from "@/features/body-metrics/api"
import { bodyMetricsKeys } from "@/features/body-metrics/hooks"
import { profileKeys } from "@/features/profile/hooks"
import type { BodyMetric } from "@/features/body-metrics/types"
import { calculateMacros } from "@/features/macros/calculations"
import { answersFromProfile } from "@/features/profile/mappers"
import { parseLocalDate } from "@/lib/dates"
import { makePendingResponse, makeProfileResponse } from "@/test/profileFixtures"
import { CoachPage } from "./CoachPage"

vi.mock("@/features/coach/api", () => ({
  askCoach: vi.fn(),
  sendCoachFeedback: vi.fn(),
}))

vi.mock("@/features/profile/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/profile/api")>()),
  getProfile: vi.fn(),
}))

vi.mock("@/features/body-metrics/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/body-metrics/api")>()),
  listBodyMetrics: vi.fn(),
}))

const askMock = vi.mocked(askCoach)
const sendMock = vi.mocked(sendCoachFeedback)
const getProfileMock = vi.mocked(getProfile)
const listMetricsMock = vi.mocked(listBodyMetrics)

const TOGGLE_NAME = "Usar mis datos para personalizar las respuestas"
const HELP_ON = "El coach tiene en cuenta tu nombre, tu perfil, tus macros y tu progreso."
// (revisión 2, F5: texto de ayuda nuevo)
const HELP_OFF =
  "El coach no usa tus datos personales. Los mensajes anteriores de esta conversación se siguen enviando al coach y pueden incluirlos."
const TODAY = "2026-10-12"

function m(recorded_at: string, weight: number): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

// Mediciones «más lento» de la spec 010.
const SLOWER = [
  m("2026-09-20", 80),
  m("2026-09-27", 79.8),
  m("2026-10-04", 79.6),
  m("2026-10-11", 79.4),
]

// Perfil base: hombre, 180 cm, kg, actividad alta, meta perder peso.
const PROFILE = makeProfileResponse(
  { date_of_birth: "1996-10-12", first_name: "Carlos" },
  {
    gender: "male",
    height_unit: "cm",
    height_cm: 180,
    weight_unit: "kg",
    weight: 79.4,
    activity_level: "high",
    goal: "lose",
  }
)

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderPage(queryClient = newQueryClient()) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CoachPage />
    </QueryClientProvider>
  )
  return { ...view, queryClient }
}

// Espera a que el perfil y las mediciones estén en la caché.
async function renderLoaded() {
  const rendered = renderPage()
  await waitFor(() => {
    expect(rendered.queryClient.getQueryData(profileKeys.detail)).toBeDefined()
    expect(rendered.queryClient.getQueryData(bodyMetricsKeys.list)).toBeDefined()
  })
  return rendered
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string, answer: string) {
  await user.type(screen.getByPlaceholderText("Escribe tu pregunta..."), text)
  await user.click(screen.getByRole("button", { name: "Enviar pregunta" }))
  await screen.findByText(answer)
}

function toggle() {
  return screen.getByRole("switch", { name: TOGGLE_NAME })
}

function neverResolves<T>() {
  return new Promise<T>(() => {})
}

describe("CoachPage - datos personales", () => {
  beforeEach(() => {
    askMock.mockReset()
    sendMock.mockReset()
    getProfileMock.mockReset()
    listMetricsMock.mockReset()
    sendMock.mockResolvedValue(undefined)
    getProfileMock.mockResolvedValue(PROFILE)
    listMetricsMock.mockResolvedValue(SLOWER)
    askMock.mockImplementation(async ({ question }) => ({
      answer: `Respuesta a ${question}`,
      feedback_id: null,
    }))
    localStorage.clear()
    // jsdom no implementa scrollIntoView, que la página usa para el auto-scroll.
    Element.prototype.scrollIntoView = vi.fn()
    // Lunes 12 de octubre de 2026. Solo se simula Date: userEvent y waitFor
    // siguen usando los temporizadores reales.
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  // --- Interruptor ---------------------------------------------------------

  // SDD: 034 REQ-010 AC-010.1
  it("muestra el interruptor activado por defecto, con su texto de ayuda", () => {
    renderPage()

    expect(toggle()).toBeChecked()
    expect(screen.getByText(HELP_ON)).toBeInTheDocument()
    expect(screen.queryByText(HELP_OFF)).not.toBeInTheDocument()
  })

  // SDD: 034 REQ-010 AC-010.1
  it("el interruptor está bajo la descripción y antes del recuadro del chat", () => {
    renderPage()

    const description = screen.getByText(/Resuelve tus dudas sobre alimentación/)
    const input = screen.getByPlaceholderText("Escribe tu pregunta...")

    expect(
      description.compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      toggle().compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  // SDD: 034 REQ-010 AC-010.2
  it("al desactivarlo cambia el texto y la conversación no se borra", async () => {
    const user = userEvent.setup()
    renderPage()
    await ask(user, "¿Cuántas series?", "Respuesta a ¿Cuántas series?")

    await user.click(toggle())

    expect(toggle()).not.toBeChecked()
    expect(screen.getByText(HELP_OFF)).toBeInTheDocument()
    expect(screen.queryByText(HELP_ON)).not.toBeInTheDocument()
    expect(screen.getByText("¿Cuántas series?")).toBeInTheDocument()
    expect(screen.getByText("Respuesta a ¿Cuántas series?")).toBeInTheDocument()
  })

  // SDD: 034 REQ-010 AC-010.5
  it("tras desactivarlo y volver a montar la página sigue desactivado", async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.click(toggle())
    expect(toggle()).not.toBeChecked()
    first.unmount()

    renderPage()

    expect(toggle()).not.toBeChecked()
    expect(screen.getByText(HELP_OFF)).toBeInTheDocument()
  })

  // SDD: 034 REQ-010 AC-010.5
  it("al reactivarlo vuelve a quedar activado tras remontar", async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.click(toggle())
    await user.click(toggle())
    first.unmount()

    renderPage()

    expect(toggle()).toBeChecked()
  })

  // --- Petición con contexto ------------------------------------------------

  // SDD: 034 REQ-007 AC-007.1
  // SDD: 034 REQ-002 AC-002.1
  // SDD: 034 REQ-003 AC-003.1
  it("la pregunta lleva las calorías, los macros y los indicadores que muestran /home y Métricas", async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await ask(user, "¿Cuánta proteína necesito?", "Respuesta a ¿Cuánta proteína necesito?")

    expect(askMock).toHaveBeenCalledTimes(1)
    const payload = askMock.mock.calls[0][0]
    expect(payload.question).toBe("¿Cuánta proteína necesito?")
    expect(payload.history).toEqual([])
    expect(payload.use_personal_context).toBe(true)
    const summary = calculateMacros(answersFromProfile(PROFILE), parseLocalDate(TODAY))
    const grams = (key: string) => summary.macros.find((macro) => macro.key === key)!.grams
    expect(payload.personal_context?.today).toBe(TODAY)
    expect(payload.personal_context?.macros).toEqual({
      maintenance_kcal: 2750,
      target_kcal: 2200,
      protein_g: grams("protein"),
      carbs_g: grams("carbs"),
      fat_g: grams("fat"),
    })
    const indicators = payload.personal_context?.indicators
    expect(indicators?.weight).toBe("79,4 kg")
    expect(indicators?.weight_change_30d).toBe("-0,6 kg")
    expect(indicators?.rate).toBe("-0,2 kg/sem")
    expect(indicators?.pace_status).toBe("too_slow")
  })

  // SDD: 034 REQ-007 AC-007.2
  it("sin mediciones la pregunta lleva las calorías y macros, y los indicadores en null", async () => {
    const user = userEvent.setup()
    listMetricsMock.mockResolvedValue([])
    await renderLoaded()

    await ask(user, "¿Cuánta proteína necesito?", "Respuesta a ¿Cuánta proteína necesito?")

    const payload = askMock.mock.calls[0][0]
    expect(payload.use_personal_context).toBe(true)
    expect(payload.personal_context?.macros.target_kcal).toBe(2200)
    expect(payload.personal_context?.macros.maintenance_kcal).toBe(2750)
    expect(payload.personal_context?.indicators).toBeNull()
  })

  // SDD: 034 REQ-007 AC-007.3
  // SDD: 034 REQ-010 AC-010.3
  it("con el interruptor desactivado la petición lo indica y no lleva calorías, macros ni indicadores", async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(toggle())

    await ask(user, "¿Cuánta proteína necesito?", "Respuesta a ¿Cuánta proteína necesito?")

    const payload = askMock.mock.calls[0][0]
    expect(payload.use_personal_context).toBe(false)
    expect(payload.personal_context).toBeUndefined()
    expect(JSON.stringify(payload)).not.toContain("kcal")
    expect(JSON.stringify(payload)).not.toContain("79,4")
  })

  // SDD: 034 REQ-010 AC-010.3
  it("al reactivarlo, la siguiente pregunta vuelve a llevar el contexto", async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(toggle())
    await ask(user, "Primera", "Respuesta a Primera")
    await user.click(toggle())

    await ask(user, "Segunda", "Respuesta a Segunda")

    expect(askMock.mock.calls[0][0].personal_context).toBeUndefined()
    expect(askMock.mock.calls[1][0].use_personal_context).toBe(true)
    expect(askMock.mock.calls[1][0].personal_context?.macros.target_kcal).toBe(2200)
  })

  // --- Sin esperar a los datos ---------------------------------------------

  const NOT_READY: Array<[string, () => void]> = [
    ["el perfil está cargando", () => getProfileMock.mockReturnValue(neverResolves())],
    ["las mediciones están cargando", () => listMetricsMock.mockReturnValue(neverResolves())],
    ["el perfil falló", () => getProfileMock.mockRejectedValue(new Error("fallo de red"))],
    ["las mediciones fallaron", () => listMetricsMock.mockRejectedValue(new Error("fallo de red"))],
    ["el usuario no tiene perfil", () => getProfileMock.mockResolvedValue(makePendingResponse())],
  ]

  // SDD: 034 REQ-006 AC-006.3
  it.each(NOT_READY)(
    "si %s, la pregunta se envía sin esperar y sin calorías, macros ni indicadores",
    async (_name, setUp) => {
      const user = userEvent.setup()
      setUp()
      renderPage()

      await ask(user, "¿Cuánta proteína necesito?", "Respuesta a ¿Cuánta proteína necesito?")

      expect(askMock).toHaveBeenCalledTimes(1)
      const payload = askMock.mock.calls[0][0]
      expect(payload.question).toBe("¿Cuánta proteína necesito?")
      expect(payload.use_personal_context).toBe(true)
      expect(payload.personal_context).toBeUndefined()
    }
  )

  // --- Historial -----------------------------------------------------------

  // SDD: 034 REQ-004 AC-004.1
  it("la tercera pregunta lleva cuatro turnos de historial con el texto que se ve en pantalla", async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await ask(user, "Pregunta uno", "Respuesta a Pregunta uno")
    await ask(user, "Pregunta dos", "Respuesta a Pregunta dos")

    await ask(user, "Pregunta tres", "Respuesta a Pregunta tres")

    expect(askMock).toHaveBeenCalledTimes(3)
    const payload = askMock.mock.calls[2][0]
    expect(payload.history).toEqual([
      { role: "user", content: "Pregunta uno" },
      { role: "assistant", content: "Respuesta a Pregunta uno" },
      { role: "user", content: "Pregunta dos" },
      { role: "assistant", content: "Respuesta a Pregunta dos" },
    ])
    expect(JSON.stringify(payload.history)).not.toContain("Carlos")
    expect(JSON.stringify(payload.history)).not.toContain("kcal")
    // El contexto viaja una sola vez, en la petición de la pregunta nueva.
    expect(payload.personal_context?.macros.target_kcal).toBe(2200)
    expect(screen.getByText("Pregunta uno")).toBeInTheDocument()
    expect(screen.getByText("Respuesta a Pregunta dos")).toBeInTheDocument()
  })

  // SDD: 034 REQ-004 AC-004.2
  it("cada pregunta calcula el contexto con el perfil de la caché en ese momento", async () => {
    const user = userEvent.setup()
    const { queryClient } = await renderLoaded()
    await ask(user, "Primera", "Respuesta a Primera")

    queryClient.setQueryData(
      profileKeys.detail,
      makeProfileResponse(
        { date_of_birth: "1996-10-12", first_name: "Carlos" },
        {
          gender: "male",
          height_unit: "cm",
          height_cm: 180,
          weight_unit: "kg",
          weight: 79.4,
          activity_level: "high",
          goal: "maintain",
        }
      )
    )
    await ask(user, "Segunda", "Respuesta a Segunda")

    const first = askMock.mock.calls[0][0].personal_context?.macros.target_kcal
    const second = askMock.mock.calls[1][0].personal_context?.macros.target_kcal
    expect(first).toBe(2200)
    expect(second).toBe(2750)
  })

  // --- Revisión 2: ayuda con el historial (F5) y nombres anteriores (F10) ---

  // SDD: 034 REQ-010 AC-010.7
  it("al desactivarlo, el párrafo enlazado con aria-describedby tiene exactamente el texto nuevo", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(toggle())

    const helpId = toggle().getAttribute("aria-describedby")
    expect(helpId).toBeTruthy()
    const help = document.getElementById(helpId!)
    expect(help?.textContent).toBe(HELP_OFF)
    expect(help?.tagName).toBe("P")
  })

  // SDD: 034 REQ-010 AC-010.8
  // SDD: 034 REQ-010 AC-010.7
  it("tras desactivarlo, el historial con el nombre y las cifras se reenvía idéntico y sin contexto", async () => {
    const user = userEvent.setup()
    await renderLoaded()
    const reply = "Hola, Carlos: con tu objetivo de 2200 kcal…"
    askMock.mockResolvedValueOnce({ answer: reply, feedback_id: null })
    await ask(user, "¿Cuánta proteína necesito?", reply)

    await user.click(toggle())
    expect(document.getElementById(toggle().getAttribute("aria-describedby")!)?.textContent).toBe(
      HELP_OFF
    )
    await ask(user, "¿Y la cena?", "Respuesta a ¿Y la cena?")

    const payload = askMock.mock.calls[1][0]
    expect(payload.use_personal_context).toBe(false)
    expect(payload.personal_context).toBeUndefined()
    expect(payload.history).toEqual([
      { role: "user", content: "¿Cuánta proteína necesito?" },
      { role: "assistant", content: reply },
    ])
  })

  const CARLITOS = { ...PROFILE, first_name: "Carlitos" }

  // SDD: 034 REQ-013 AC-013.1
  // SDD: 034 REQ-013 AC-013.2
  it("envía el nombre anterior solo cuando hay conversación y el nombre cambió", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CARLITOS)
    const { queryClient } = await renderLoaded()

    await ask(user, "Primera", "Respuesta a Primera")
    await ask(user, "Segunda", "Respuesta a Segunda")

    expect(askMock.mock.calls[0][0].previous_names).toBeUndefined()
    expect(askMock.mock.calls[1][0].previous_names).toBeUndefined()

    queryClient.setQueryData(profileKeys.detail, PROFILE)
    await ask(user, "Tercera", "Respuesta a Tercera")

    expect(askMock.mock.calls[2][0].previous_names).toEqual(["Carlitos"])
  })

  // SDD: 034 REQ-013 AC-013.1
  it("envía el nombre anterior también con el interruptor desactivado", async () => {
    const user = userEvent.setup()
    getProfileMock.mockResolvedValue(CARLITOS)
    const { queryClient } = await renderLoaded()
    await user.click(toggle())
    await ask(user, "Primera", "Respuesta a Primera")

    queryClient.setQueryData(profileKeys.detail, PROFILE)
    await ask(user, "Segunda", "Respuesta a Segunda")

    const payload = askMock.mock.calls[1][0]
    expect(payload.use_personal_context).toBe(false)
    expect(payload.personal_context).toBeUndefined()
    expect(payload.previous_names).toEqual(["Carlitos"])
  })
})
