// Test de COMPONENTE del chat de porciones (spec 031). La red se simula en el
// api.ts del diario; el estado vive en `usePortionChat`, que aquí llama un arnés
// del propio test, como hace `DiaryPage`.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ZodError } from "zod"
import { ApiError } from "@/lib/apiClient"
import { addMealItems, estimatePortion, getDiary } from "@/features/diary/api"
import { makeEggsWithPer100g, makePortionEstimate } from "@/test/portionEstimateFixtures"
import { usePortionChat } from "../hooks"
import type { PortionEstimate } from "../types"
import { PortionChat } from "./PortionChat"

vi.mock("@/features/diary/api", () => ({
  estimatePortion: vi.fn(),
  // Spec 032: el diálogo «Añadir alimento» guarda con addMealItems.
  addMealItems: vi.fn(),
  getDiary: vi.fn(),
}))

const estimateMock = vi.mocked(estimatePortion)
const addMock = vi.mocked(addMealItems)
const getDiaryMock = vi.mocked(getDiary)

const EXPLANATION =
  "Pregunta a la IA cuántos gramos pesa un alimento o una porción, por ejemplo «5 huevos» o «un filete de pescado». La respuesta es una estimación aproximada."
const GENERIC_ERROR = "No se pudo estimar el peso. Vuelve a intentarlo."
const NOT_FOOD_MESSAGE = "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento."
const UNKNOWN_MESSAGE =
  "No he podido estimar el peso. Prueba a describir el alimento de otra forma."

function Harness() {
  const chat = usePortionChat()
  return <PortionChat chat={chat} date="2026-10-31" />
}

function renderChat() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const field = () => screen.getByRole("textbox", { name: "Alimento o porción" })
const sendButton = () => screen.getByRole("button", { name: "Preguntar" })
const log = () => screen.getByRole("log", { name: "Conversación sobre gramos" })

const estimated = (grams: number, unit: string | null = null, note: string | null = null) =>
  ({ status: "estimated", grams, unit, note }) as PortionEstimate

describe("PortionChat - bloque y validación", () => {
  beforeEach(() => {
    estimateMock.mockReset()
  })

  // SDD: 031 REQ-001 AC-001.1
  it("muestra el título, el texto explicativo, el campo con su etiqueta y el botón «Preguntar»", () => {
    renderChat()

    expect(screen.getByRole("heading", { level: 2, name: "Calcular gramos con IA" })).toBeInTheDocument()
    expect(screen.getByText(EXPLANATION)).toBeInTheDocument()
    expect(field()).toBeInTheDocument()
    expect(field()).toHaveAttribute("placeholder", "Por ejemplo: 5 huevos")
    expect(sendButton()).toBeInTheDocument()
  })

  // SDD: 031 REQ-001 AC-001.6
  it("sin preguntas muestra «Todavía no has preguntado nada.» en la conversación", () => {
    renderChat()

    expect(within(log()).getByText("Todavía no has preguntado nada.")).toBeInTheDocument()
  })

  // SDD: 031 NFR-001 AC-N001.1
  it("la conversación es un `role=\"log\"` educado con el nombre «Conversación sobre gramos»", () => {
    renderChat()

    const region = log()
    const polite =
      region.getAttribute("aria-live") === "polite" || region.getAttribute("role") === "log"
    expect(polite).toBe(true)
    expect(region).toHaveAccessibleName("Conversación sobre gramos")
  })

  // SDD: 031 REQ-002 AC-002.1
  it("con el campo vacío el botón está desactivado y el contador marca «0/200»", () => {
    renderChat()

    expect(sendButton()).toBeDisabled()
    expect(screen.getByText("0/200")).toBeInTheDocument()
  })

  // SDD: 031 REQ-002 AC-002.2
  it("con solo espacios, Enter no envía nada y el botón sigue desactivado", async () => {
    const user = userEvent.setup()
    renderChat()

    await user.type(field(), "   {Enter}")

    expect(estimateMock).not.toHaveBeenCalled()
    expect(sendButton()).toBeDisabled()
  })

  // SDD: 031 REQ-002 AC-002.3
  it("un texto de 250 caracteres se queda en 200 y el contador marca «200/200»", () => {
    renderChat()

    fireEvent.change(field(), { target: { value: "a".repeat(250) } })

    expect(field()).toHaveValue("a".repeat(200))
    expect(screen.getByText("200/200")).toBeInTheDocument()
  })

  // SDD: 031 REQ-002 AC-002.3
  it("pegar 250 caracteres deja los 200 primeros", async () => {
    const user = userEvent.setup()
    renderChat()

    await user.click(field())
    await user.paste("b".repeat(250))

    expect(field()).toHaveValue("b".repeat(200))
    expect(screen.getByText("200/200")).toBeInTheDocument()
  })

  // SDD: 031 REQ-002 AC-002.4
  it("con «5 huevos» el contador marca «8/200» y el botón está activado", async () => {
    const user = userEvent.setup()
    renderChat()

    await user.type(field(), "5 huevos")

    expect(screen.getByText("8/200")).toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
  })
})

describe("PortionChat - enviar la pregunta", () => {
  beforeEach(() => {
    estimateMock.mockReset()
  })

  // SDD: 031 REQ-003 AC-003.1
  it("«  5 huevos  » + «Preguntar» hace una sola petición con «5 huevos», muestra la pregunta, vacía el campo y muestra «Calculando…»", async () => {
    const user = userEvent.setup()
    const pending = deferred<PortionEstimate>()
    estimateMock.mockReturnValue(pending.promise)
    renderChat()

    await user.type(field(), "  5 huevos  ")
    await user.click(sendButton())

    expect(estimateMock).toHaveBeenCalledTimes(1)
    expect(estimateMock).toHaveBeenCalledWith("5 huevos")
    expect(within(log()).getByText("5 huevos")).toBeInTheDocument()
    expect(field()).toHaveValue("")
    expect(within(log()).getByText("Calculando…")).toBeInTheDocument()
    expect(within(log()).queryByText("Todavía no has preguntado nada.")).not.toBeInTheDocument()
    await act(async () => pending.resolve(estimated(250)))
  })

  // SDD: 031 REQ-003 AC-003.2
  it("Enter en el campo envía «un filete de pescado»", async () => {
    const user = userEvent.setup()
    estimateMock.mockResolvedValue(estimated(150))
    renderChat()

    await user.type(field(), "un filete de pescado{Enter}")

    expect(estimateMock).toHaveBeenCalledTimes(1)
    expect(estimateMock).toHaveBeenCalledWith("un filete de pescado")
    expect(await screen.findByText("Unos 150 g")).toBeInTheDocument()
  })

  // SDD: 031 REQ-003 AC-003.3
  it("la segunda pregunta envía solo «un plátano», sin la anterior", async () => {
    const user = userEvent.setup()
    estimateMock.mockResolvedValue(estimated(120))
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await screen.findByText("Unos 120 g")

    await user.type(field(), "un plátano{Enter}")

    await vi.waitFor(() => expect(estimateMock).toHaveBeenCalledTimes(2))
    expect(estimateMock).toHaveBeenNthCalledWith(1, "5 huevos")
    expect(estimateMock).toHaveBeenNthCalledWith(2, "un plátano")
    expect(estimateMock.mock.calls[1]).toEqual(["un plátano"])
  })

  // SDD: 031 REQ-004 AC-004.1
  it("con una pregunta en curso, escribir y pulsar «Preguntar» o Enter no envía otra y el campo conserva el texto", async () => {
    const user = userEvent.setup()
    const pending = deferred<PortionEstimate>()
    estimateMock.mockReturnValue(pending.promise)
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    expect(await screen.findByText("Calculando…")).toBeInTheDocument()

    await user.type(field(), "un plátano")
    expect(sendButton()).toBeDisabled()
    await user.click(sendButton())
    await user.type(field(), "{Enter}")

    expect(estimateMock).toHaveBeenCalledTimes(1)
    expect(field()).toHaveValue("un plátano")
    await act(async () => pending.resolve(estimated(250)))
  })

  // SDD: 031 REQ-004 AC-004.2
  it("al llegar la respuesta desaparece «Calculando…» y, con texto válido, «Preguntar» se reactiva", async () => {
    const user = userEvent.setup()
    const pending = deferred<PortionEstimate>()
    estimateMock.mockReturnValue(pending.promise)
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await user.type(field(), "un plátano")
    expect(sendButton()).toBeDisabled()

    await act(async () => pending.resolve(estimated(250)))

    expect(screen.queryByText("Calculando…")).not.toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
  })

  // SDD: 031 NFR-001 AC-N001.2
  it("tras Enter con una pregunta válida el foco sigue en el campo", async () => {
    const user = userEvent.setup()
    const pending = deferred<PortionEstimate>()
    estimateMock.mockReturnValue(pending.promise)
    renderChat()

    await user.type(field(), "5 huevos{Enter}")

    expect(field()).toHaveFocus()
    await act(async () => pending.resolve(estimated(250)))
    expect(field()).toHaveFocus()
  })
})

describe("PortionChat - respuestas y errores", () => {
  beforeEach(() => {
    estimateMock.mockReset()
  })

  async function ask(text = "5 huevos") {
    const user = userEvent.setup()
    await user.type(field(), `${text}{Enter}`)
    return user
  }

  // SDD: 031 REQ-005 AC-005.1
  it("una estimación completa muestra «Unos 250 g», «Porción: 5 huevos grandes» y la nota bajo la pregunta", async () => {
    estimateMock.mockResolvedValue(makePortionEstimate())
    renderChat()

    await ask()

    expect(await within(log()).findByText("Unos 250 g")).toBeInTheDocument()
    expect(within(log()).getByText("Porción: 5 huevos grandes")).toBeInTheDocument()
    expect(within(log()).getByText("Unos 50 g por huevo sin cáscara.")).toBeInTheDocument()
    const question = within(log()).getByText("5 huevos")
    const grams = within(log()).getByText("Unos 250 g")
    expect(question.compareDocumentPosition(grams) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // SDD: 031 REQ-005 AC-005.2
  it("una estimación sin porción ni nota muestra solo «Unos 120 g»", async () => {
    estimateMock.mockResolvedValue(estimated(120))
    renderChat()

    await ask()

    expect(await within(log()).findByText("Unos 120 g")).toBeInTheDocument()
    expect(within(log()).queryByText(/Porción:/)).not.toBeInTheDocument()
    expect(within(log()).queryByText(/cáscara/)).not.toBeInTheDocument()
  })

  // SDD: 031 REQ-005 AC-005.3
  it("5000 g se muestra como «Unos 5000 g»", async () => {
    estimateMock.mockResolvedValue(estimated(5000))
    renderChat()

    await ask("una sandía")

    expect(await within(log()).findByText("Unos 5000 g")).toBeInTheDocument()
  })

  // SDD: 031 REQ-006 AC-006.1
  it("not_food muestra el mensaje sin «Unos» ni «Porción:»", async () => {
    estimateMock.mockResolvedValue({ status: "not_food", message: NOT_FOOD_MESSAGE })
    renderChat()

    await ask("un coche")

    expect(await within(log()).findByText(NOT_FOOD_MESSAGE)).toBeInTheDocument()
    expect(within(log()).queryByText(/Unos /)).not.toBeInTheDocument()
    expect(within(log()).queryByText(/Porción:/)).not.toBeInTheDocument()
  })

  // SDD: 031 REQ-006 AC-006.2
  it("unknown muestra su mensaje como respuesta", async () => {
    estimateMock.mockResolvedValue({ status: "unknown", message: UNKNOWN_MESSAGE })
    renderChat()

    await ask("zzz")

    expect(await within(log()).findByText(UNKNOWN_MESSAGE)).toBeInTheDocument()
  })

  // SDD: 031 REQ-007 AC-007.1
  it("un 429 conserva la pregunta y muestra el mensaje con estilo neutro, no de error", async () => {
    const message = "Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a intentarlo más tarde."
    estimateMock.mockRejectedValue(new ApiError(429, message))
    renderChat()

    await ask()

    const notice = await within(log()).findByText(message)
    expect(within(log()).getByText("5 huevos")).toBeInTheDocument()
    expect(notice.className).not.toMatch(/destructive/)
    expect(log().querySelector(".text-destructive")).toBeNull()
  })

  // SDD: 031 REQ-007 AC-007.2
  it("un 503 muestra el mensaje del servidor con el estilo de error", async () => {
    const message = "No se pudo estimar el peso en este momento. Vuelve a intentarlo en unos minutos."
    estimateMock.mockRejectedValue(new ApiError(503, message))
    renderChat()

    await ask()

    const error = await within(log()).findByText(message)
    expect(within(log()).getByText("5 huevos")).toBeInTheDocument()
    expect(error).toHaveClass("text-destructive")
  })

  // SDD: 031 REQ-007 AC-007.3
  it("un 400 muestra el mensaje del servidor con el estilo de error", async () => {
    const message = "La pregunta no puede superar los 200 caracteres."
    estimateMock.mockRejectedValue(new ApiError(400, message))
    renderChat()

    await ask()

    expect(await within(log()).findByText(message)).toHaveClass("text-destructive")
  })

  // SDD: 031 REQ-007 AC-007.4
  it.each([
    ["un fallo de red", () => new TypeError("Failed to fetch")],
    ["un 500", () => new ApiError(500, "boom interno")],
  ])("%s muestra el mensaje genérico y no el texto original", async (_name, makeError) => {
    estimateMock.mockRejectedValue(makeError())
    renderChat()

    await ask()

    const error = await within(log()).findByText(GENERIC_ERROR)
    expect(error).toHaveClass("text-destructive")
    expect(within(log()).queryByText(/boom interno|Failed to fetch/)).not.toBeInTheDocument()
    expect(within(log()).getByText("5 huevos")).toBeInTheDocument()
  })

  // SDD: 031 REQ-007 AC-007.5
  it("una respuesta con forma inesperada (ZodError) muestra el mensaje genérico", async () => {
    estimateMock.mockRejectedValue(
      new ZodError([{ code: "custom", path: ["grams"], message: "Invalid input" }])
    )
    renderChat()

    await ask()

    expect(await within(log()).findByText(GENERIC_ERROR)).toBeInTheDocument()
  })

  // SDD: 031 REQ-007 AC-007.6
  it.each([
    ["un 500", () => new ApiError(500, "boom")],
    ["un 429", () => new ApiError(429, "Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a intentarlo más tarde.")],
    ["un fallo de red", () => new TypeError("Failed to fetch")],
  ])("tras %s se puede escribir otra pregunta y enviarla", async (_name, makeError) => {
    const user = userEvent.setup()
    estimateMock.mockRejectedValueOnce(makeError())
    estimateMock.mockResolvedValueOnce(estimated(120))
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await vi.waitFor(() => expect(screen.queryByText("Calculando…")).not.toBeInTheDocument())

    await user.type(field(), "un plátano")
    expect(sendButton()).toBeEnabled()
    await user.click(sendButton())

    expect(estimateMock).toHaveBeenCalledTimes(2)
    expect(estimateMock).toHaveBeenLastCalledWith("un plátano")
    expect(await within(log()).findByText("Unos 120 g")).toBeInTheDocument()
  })

  // SDD: 031 REQ-008 AC-008.1
  it("dos preguntas respondidas aparecen con sus respuestas, en el orden en que se hicieron", async () => {
    const user = userEvent.setup()
    estimateMock.mockResolvedValueOnce(estimated(250))
    estimateMock.mockResolvedValueOnce(estimated(120))
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await within(log()).findByText("Unos 250 g")
    await user.type(field(), "un plátano{Enter}")
    await within(log()).findByText("Unos 120 g")

    const order = ["5 huevos", "Unos 250 g", "un plátano", "Unos 120 g"].map((text) =>
      within(log()).getByText(text)
    )
    for (let i = 0; i < order.length - 1; i++) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }
  })
})

describe("PortionChat - valores por 100 g y «Añadir alimento» (spec 032)", () => {
  const PER_100G_LINE =
    "Por 100 g: 143 kcal · 12,6 g proteína · 0,7 g carbohidratos · 9,5 g grasa"
  const SAVE_FAILED = "No se pudo guardar. Vuelve a intentarlo."

  beforeEach(() => {
    estimateMock.mockReset()
    addMock.mockReset()
    getDiaryMock.mockReset()
  })

  const chatBlock = () => screen.getByRole("region", { name: "Calcular gramos con IA" })
  const chatAddButton = () => within(chatBlock()).queryByRole("button", { name: "Añadir alimento" })
  const getChatAddButton = () =>
    within(chatBlock()).getByRole("button", { name: "Añadir alimento" })

  async function ask(text = "5 huevos") {
    const user = userEvent.setup()
    await user.type(field(), `${text}{Enter}`)
    return user
  }

  function follows(first: HTMLElement, second: HTMLElement): boolean {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
  }

  // SDD: 032 REQ-005 AC-005.1
  it("muestra los gramos, la porción, la nota y «Por 100 g: …» en ese orden", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()

    await ask()

    const grams = await within(log()).findByText("Unos 250 g")
    const unit = within(log()).getByText("Porción: 5 huevos grandes")
    const note = within(log()).getByText("Unos 50 g por huevo sin cáscara.")
    const per100g = within(log()).getByText(PER_100G_LINE)
    expect(follows(grams, unit)).toBe(true)
    expect(follows(unit, note)).toBe(true)
    expect(follows(note, per100g)).toBe(true)
  })

  // SDD: 032 REQ-005 AC-005.2
  it("una estimación con per_100g null no muestra «Por 100 g:»", async () => {
    estimateMock.mockResolvedValue(makePortionEstimate())
    renderChat()

    await ask()

    await within(log()).findByText("Unos 250 g")
    expect(within(log()).queryByText(/Por 100 g:/)).not.toBeInTheDocument()

    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    await ask("5 huevos")
    expect(await within(log()).findByText(/Por 100 g: 143 kcal/)).toBeInTheDocument()
  })

  // SDD: 032 REQ-005 AC-005.3
  it("52,4 kcal, 0 g, 13,8 g y 0,2 g se muestran como «52 kcal · 0,0 g …»", async () => {
    estimateMock.mockResolvedValue(
      makeEggsWithPer100g({
        per_100g: { calories_kcal: 52.4, protein_g: 0, carbs_g: 13.8, fat_g: 0.2 },
      } as Partial<PortionEstimate>)
    )
    renderChat()

    await ask("una manzana")

    expect(
      await within(log()).findByText(
        "Por 100 g: 52 kcal · 0,0 g proteína · 13,8 g carbohidratos · 0,2 g grasa"
      )
    ).toBeInTheDocument()
  })

  // SDD: 032 REQ-006 AC-006.1
  it("con la conversación vacía no hay botón «Añadir alimento» en el bloque", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()

    expect(chatAddButton()).not.toBeInTheDocument()

    await ask()
    await within(log()).findByText("Unos 250 g")
    expect(getChatAddButton()).toBeInTheDocument()
  })

  // SDD: 032 REQ-006 AC-006.2
  it("tras una estimación aparece «Añadir alimento» justo antes de «Preguntar»", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()

    await ask()

    await within(log()).findByText("Unos 250 g")
    const buttons = within(chatBlock()).getAllByRole("button")
    const add = getChatAddButton()
    expect(buttons.indexOf(add)).toBeGreaterThanOrEqual(0)
    expect(buttons[buttons.indexOf(add) + 1]).toBe(sendButton())
    expect(follows(add, sendButton())).toBe(true)
  })

  // SDD: 032 REQ-006 AC-006.3
  it("mientras la siguiente pregunta está en curso el botón desaparece", async () => {
    const user = userEvent.setup()
    const pending = deferred<PortionEstimate>()
    estimateMock.mockResolvedValueOnce(makeEggsWithPer100g())
    estimateMock.mockReturnValueOnce(pending.promise)
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await within(log()).findByText("Unos 250 g")
    expect(getChatAddButton()).toBeInTheDocument()

    await user.type(field(), "un plátano{Enter}")

    expect(await within(log()).findByText("Calculando…")).toBeInTheDocument()
    expect(chatAddButton()).not.toBeInTheDocument()
    await act(async () => pending.resolve(estimated(120)))
  })

  // SDD: 032 REQ-006 AC-006.4
  it.each([
    ["not_food", () => Promise.resolve({ status: "not_food", message: NOT_FOOD_MESSAGE } as PortionEstimate)],
    ["unknown", () => Promise.resolve({ status: "unknown", message: UNKNOWN_MESSAGE } as PortionEstimate)],
    ["un 429", () => Promise.reject(new ApiError(429, "Alcanzaste el límite."))],
    ["un error", () => Promise.reject(new ApiError(500, "boom"))],
  ])("si la siguiente pregunta recibe %s, el botón desaparece", async (_name, next) => {
    const user = userEvent.setup()
    estimateMock.mockResolvedValueOnce(makeEggsWithPer100g())
    estimateMock.mockImplementationOnce(next)
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await within(log()).findByText("Unos 250 g")
    expect(getChatAddButton()).toBeInTheDocument()

    await user.type(field(), "otra cosa{Enter}")

    await vi.waitFor(() => expect(within(log()).queryByText("Calculando…")).not.toBeInTheDocument())
    expect(within(log()).getByText("otra cosa")).toBeInTheDocument()
    expect(chatAddButton()).not.toBeInTheDocument()
  })

  // SDD: 032 REQ-006 AC-006.5
  it("una estimación sin nombre ni per_100g también muestra el botón", async () => {
    estimateMock.mockResolvedValue(makePortionEstimate())
    renderChat()

    await ask()

    await within(log()).findByText("Unos 250 g")
    expect(getChatAddButton()).toBeInTheDocument()
  })

  // SDD: 032 REQ-011 AC-011.1
  it("la respuesta de un backend anterior (sin las claves nuevas) muestra los gramos, no «Por 100 g:» y el botón", async () => {
    estimateMock.mockResolvedValue(estimated(250))
    renderChat()

    await ask()

    expect(await within(log()).findByText("Unos 250 g")).toBeInTheDocument()
    expect(within(log()).queryByText(/Por 100 g:/)).not.toBeInTheDocument()
    expect(getChatAddButton()).toBeInTheDocument()
  })

  // SDD: 032 REQ-011 AC-011.2
  it("una respuesta con forma inesperada muestra el mensaje genérico y no el botón", async () => {
    estimateMock.mockRejectedValue(
      new ZodError([{ code: "custom", path: ["per_100g"], message: "Invalid input" }])
    )
    renderChat()

    await ask()

    expect(await within(log()).findByText(GENERIC_ERROR)).toBeInTheDocument()
    expect(chatAddButton()).not.toBeInTheDocument()

    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    await ask("5 huevos")
    expect(await within(log()).findByText(/Por 100 g: 143 kcal/)).toBeInTheDocument()
    expect(getChatAddButton()).toBeInTheDocument()
  })

  // SDD: 032 REQ-007 AC-007.1
  it("pulsar «Añadir alimento» abre el diálogo con los datos de la estimación", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()
    const user = await ask()
    await within(log()).findByText("Unos 250 g")

    await user.click(getChatAddButton())

    const dialog = await screen.findByRole("dialog", { name: "Añadir alimento" })
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Huevo")
    expect(within(dialog).getByLabelText("Gramos")).toHaveValue("250")
    expect(within(dialog).getByLabelText("Calorías por 100 g (kcal)")).toHaveValue("143")
    expect(within(dialog).getByLabelText("Proteína por 100 g (g)")).toHaveValue("12,6")
    expect(within(dialog).getByLabelText("Carbohidratos por 100 g (g)")).toHaveValue("0,7")
    expect(within(dialog).getByLabelText("Grasa por 100 g (g)")).toHaveValue("9,5")
  })

  // SDD: 032 REQ-007 AC-007.5
  it("con dos estimaciones el diálogo se precarga con la de la última pregunta", async () => {
    const user = userEvent.setup()
    estimateMock.mockResolvedValueOnce(makeEggsWithPer100g())
    estimateMock.mockResolvedValueOnce(
      makeEggsWithPer100g({
        grams: 120,
        unit: null,
        note: null,
        name: "Plátano",
        per_100g: { calories_kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 },
      } as Partial<PortionEstimate>)
    )
    renderChat()
    await user.type(field(), "5 huevos{Enter}")
    await within(log()).findByText("Unos 250 g")
    await user.type(field(), "un plátano{Enter}")
    await within(log()).findByText("Unos 120 g")

    await user.click(getChatAddButton())

    const dialog = await screen.findByRole("dialog", { name: "Añadir alimento" })
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Plátano")
    expect(within(dialog).getByLabelText("Gramos")).toHaveValue("120")
    expect(within(dialog).getByLabelText("Calorías por 100 g (kcal)")).toHaveValue("89")
  })

  // SDD: 032 REQ-010 AC-010.3
  it("«Cancelar» cierra el diálogo sin enviar nada y la conversación no cambia", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()
    const user = await ask()
    await within(log()).findByText("Unos 250 g")
    await user.click(getChatAddButton())
    const dialog = await screen.findByRole("dialog", { name: "Añadir alimento" })

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(addMock).not.toHaveBeenCalled()
    expect(within(log()).getByText("5 huevos")).toBeInTheDocument()
    expect(within(log()).getByText("Unos 250 g")).toBeInTheDocument()
    expect(estimateMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 032 REQ-010 AC-010.3
  it("Escape cierra el diálogo sin enviar nada y la conversación no cambia", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()
    const user = await ask()
    await within(log()).findByText("Unos 250 g")
    await user.click(getChatAddButton())
    await screen.findByRole("dialog", { name: "Añadir alimento" })

    await user.keyboard("{Escape}")

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(addMock).not.toHaveBeenCalled()
    expect(within(log()).getByText("Unos 250 g")).toBeInTheDocument()
    expect(getChatAddButton()).toBeInTheDocument()
  })

  // SDD: 032 NFR-003 AC-N003.2
  it("al cancelar, el foco vuelve al botón «Añadir alimento» del chat", async () => {
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()
    const user = await ask()
    await within(log()).findByText("Unos 250 g")
    await user.click(getChatAddButton())
    const dialog = await screen.findByRole("dialog", { name: "Añadir alimento" })

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))

    await vi.waitFor(() => expect(getChatAddButton()).toHaveFocus())
  })

  // SDD: 032 REQ-010 AC-010.2
  it("un fallo al guardar desde el chat mantiene el diálogo con el mensaje genérico", async () => {
    addMock.mockRejectedValue(new ApiError(500, "boom"))
    estimateMock.mockResolvedValue(makeEggsWithPer100g())
    renderChat()
    const user = await ask()
    await within(log()).findByText("Unos 250 g")
    await user.click(getChatAddButton())
    const dialog = await screen.findByRole("dialog", { name: "Añadir alimento" })
    await user.click(within(dialog).getByRole("radio", { name: "Cena" }))

    await user.click(within(dialog).getByRole("button", { name: "Añadir" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
    expect(screen.getByRole("dialog", { name: "Añadir alimento" })).toBeInTheDocument()
  })
})
