// Test de COMPONENTE de los botones 👍/👎 del coach (feature 005). La red se
// simula en la capa api.ts del coach (vi.mock), nunca en fetch.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { sendCoachFeedback } from "@/features/coach/api"
import { CoachFeedbackButtons } from "./CoachFeedbackButtons"

vi.mock("@/features/coach/api", () => ({
  askCoach: vi.fn(),
  sendCoachFeedback: vi.fn(),
}))

const sendMock = vi.mocked(sendCoachFeedback)

const GENERAL_ERROR = "No se pudo enviar tu valoración. Inténtalo de nuevo."
const LIMIT_MESSAGE =
  "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."

function renderButtons(feedbackId = "f1") {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CoachFeedbackButtons feedbackId={feedbackId} />
    </QueryClientProvider>
  )
}

const upButton = () => screen.getByRole("button", { name: "Respuesta útil" })
const downButton = () => screen.getByRole("button", { name: "Respuesta no útil" })

describe("CoachFeedbackButtons", () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue(undefined)
  })

  // SDD: REQ-009 AC-009.1
  it("muestra los botones de valoración sin ninguno seleccionado", () => {
    renderButtons()

    expect(upButton()).toHaveAttribute("aria-pressed", "false")
    expect(downButton()).toHaveAttribute("aria-pressed", "false")
  })

  // SDD: NFR-004 AC-N004.1
  it("expone los botones como elementos button con nombre accesible y aria-pressed", () => {
    renderButtons()

    for (const name of ["Respuesta útil", "Respuesta no útil"]) {
      const button = screen.getByRole("button", { name })
      expect(button.tagName).toBe("BUTTON")
      expect(button).toHaveAttribute("aria-pressed")
    }
  })

  // SDD: REQ-010 AC-010.1
  it("envía el voto 'up' con el feedback_id y marca el botón útil al completarse", async () => {
    const user = userEvent.setup()
    renderButtons("f1")

    await user.click(upButton())

    await waitFor(() => expect(upButton()).toHaveAttribute("aria-pressed", "true"))
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toEqual({ feedback_id: "f1", rating: "up" })
    expect(downButton()).toHaveAttribute("aria-pressed", "false")
  })

  // SDD: REQ-010 AC-010.2
  it("permite cambiar el voto y pasa la selección al botón no útil", async () => {
    const user = userEvent.setup()
    renderButtons("f1")
    await user.click(upButton())
    await waitFor(() => expect(upButton()).toHaveAttribute("aria-pressed", "true"))

    await user.click(downButton())

    await waitFor(() => expect(downButton()).toHaveAttribute("aria-pressed", "true"))
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock.mock.calls[1][0]).toEqual({ feedback_id: "f1", rating: "down" })
    expect(upButton()).toHaveAttribute("aria-pressed", "false")
  })

  // SDD: REQ-010 AC-010.3
  it("desactiva los dos botones mientras se envía el voto", async () => {
    const user = userEvent.setup()
    let resolveSend: () => void = () => {}
    sendMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSend = resolve
      })
    )
    renderButtons()

    await user.click(upButton())

    await waitFor(() => expect(upButton()).toBeDisabled())
    expect(downButton()).toBeDisabled()

    resolveSend()

    await waitFor(() => expect(upButton()).toBeEnabled())
    expect(downButton()).toBeEnabled()
  })

  // SDD: REQ-010 AC-010.4
  it("no envía nada al pulsar el botón que ya está seleccionado", async () => {
    const user = userEvent.setup()
    renderButtons()
    await user.click(upButton())
    await waitFor(() => expect(upButton()).toHaveAttribute("aria-pressed", "true"))

    await user.click(upButton())

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(upButton()).toHaveAttribute("aria-pressed", "true")
  })

  // SDD: REQ-011 AC-011.1
  it("ante un error 500 no selecciona nada, reactiva los botones y muestra el error general", async () => {
    const user = userEvent.setup()
    sendMock.mockRejectedValue(new ApiError(500, "Error interno"))
    renderButtons()

    await user.click(upButton())

    expect(await screen.findByText(GENERAL_ERROR)).toBeInTheDocument()
    expect(upButton()).toHaveAttribute("aria-pressed", "false")
    expect(downButton()).toHaveAttribute("aria-pressed", "false")
    expect(upButton()).toBeEnabled()
    expect(downButton()).toBeEnabled()
  })

  // SDD: REQ-011 AC-011.2
  it("ante un error mantiene la selección anterior", async () => {
    const user = userEvent.setup()
    renderButtons()
    await user.click(upButton())
    await waitFor(() => expect(upButton()).toHaveAttribute("aria-pressed", "true"))
    sendMock.mockRejectedValue(new ApiError(500, "Error interno"))

    await user.click(downButton())

    expect(await screen.findByText(GENERAL_ERROR)).toBeInTheDocument()
    expect(upButton()).toHaveAttribute("aria-pressed", "true")
    expect(downButton()).toHaveAttribute("aria-pressed", "false")
  })

  // SDD: REQ-011 AC-011.3
  it("ante un 429 muestra el mensaje que devuelve el servidor", async () => {
    const user = userEvent.setup()
    sendMock.mockRejectedValue(new ApiError(429, LIMIT_MESSAGE))
    renderButtons()

    await user.click(upButton())

    expect(await screen.findByText(LIMIT_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(GENERAL_ERROR)).not.toBeInTheDocument()
  })

  // SDD: REQ-011 AC-011.4
  it("el mensaje de error desaparece cuando el siguiente voto tiene éxito", async () => {
    const user = userEvent.setup()
    sendMock.mockRejectedValueOnce(new ApiError(500, "Error interno"))
    renderButtons()
    await user.click(upButton())
    expect(await screen.findByText(GENERAL_ERROR)).toBeInTheDocument()

    await user.click(upButton())

    await waitFor(() => expect(upButton()).toHaveAttribute("aria-pressed", "true"))
    expect(screen.queryByText(GENERAL_ERROR)).not.toBeInTheDocument()
  })
})
