// Test de PÁGINA del coach (feature 005): botones de valoración bajo las
// respuestas y forma del historial. La red se simula en api.ts (vi.mock).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { askCoach, sendCoachFeedback } from "@/features/coach/api"
import { CoachPage } from "./CoachPage"

vi.mock("@/features/coach/api", () => ({
  askCoach: vi.fn(),
  sendCoachFeedback: vi.fn(),
}))

const askMock = vi.mocked(askCoach)
const sendMock = vi.mocked(sendCoachFeedback)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CoachPage />
    </QueryClientProvider>
  )
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string, answer: string) {
  await user.type(screen.getByPlaceholderText("Escribe tu pregunta..."), text)
  await user.click(screen.getByRole("button", { name: "Enviar pregunta" }))
  await screen.findByText(answer)
}

describe("CoachPage - valoración de respuestas", () => {
  beforeEach(() => {
    askMock.mockReset()
    sendMock.mockReset()
    sendMock.mockResolvedValue(undefined)
    // jsdom no implementa scrollIntoView, que la página usa para el auto-scroll.
    Element.prototype.scrollIntoView = vi.fn()
  })

  // SDD: REQ-009 AC-009.2
  it("no muestra botones de valoración si la respuesta llega con feedback_id nulo", async () => {
    const user = userEvent.setup()
    askMock.mockResolvedValue({ answer: "Respuesta sin traza", feedback_id: null })
    renderPage()

    await ask(user, "Hola", "Respuesta sin traza")

    expect(screen.queryByRole("button", { name: "Respuesta útil" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Respuesta no útil" })).not.toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.3
  it("muestra exactamente un par de botones, asociado a la respuesta del coach", async () => {
    const user = userEvent.setup()
    askMock.mockResolvedValue({ answer: "Haz 3 series", feedback_id: "f1" })
    renderPage()

    await ask(user, "¿Cuántas series?", "Haz 3 series")

    expect(screen.getAllByRole("button", { name: "Respuesta útil" })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "Respuesta no útil" })).toHaveLength(1)
  })

  // SDD: REQ-009 AC-009.4
  it("cada respuesta tiene su propio par de botones y votar una no afecta a la otra", async () => {
    const user = userEvent.setup()
    askMock
      .mockResolvedValueOnce({ answer: "Primera respuesta", feedback_id: "f1" })
      .mockResolvedValueOnce({ answer: "Segunda respuesta", feedback_id: "f2" })
    renderPage()
    await ask(user, "Pregunta uno", "Primera respuesta")
    await ask(user, "Pregunta dos", "Segunda respuesta")

    const upButtons = screen.getAllByRole("button", { name: "Respuesta útil" })
    expect(upButtons).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Respuesta no útil" })).toHaveLength(2)

    await user.click(upButtons[0])

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Respuesta útil" })[0]).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    )
    expect(screen.getAllByRole("button", { name: "Respuesta útil" })[1]).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(sendMock.mock.calls[0][0]).toEqual({ feedback_id: "f1", rating: "up" })
  })

  // SDD: REQ-010 AC-010.5
  it("el historial de la siguiente pregunta solo lleva role y content", async () => {
    const user = userEvent.setup()
    askMock
      .mockResolvedValueOnce({ answer: "Primera respuesta", feedback_id: "f1" })
      .mockResolvedValueOnce({ answer: "Segunda respuesta", feedback_id: "f2" })
    renderPage()
    await ask(user, "Pregunta uno", "Primera respuesta")
    await user.click(screen.getByRole("button", { name: "Respuesta útil" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Respuesta útil" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    )

    await ask(user, "Pregunta dos", "Segunda respuesta")

    expect(askMock).toHaveBeenCalledTimes(2)
    expect(askMock.mock.calls[1][0].history).toEqual([
      { role: "user", content: "Pregunta uno" },
      { role: "assistant", content: "Primera respuesta" },
    ])
    for (const message of askMock.mock.calls[1][0].history) {
      expect(Object.keys(message).sort()).toEqual(["content", "role"])
    }
  })
})
