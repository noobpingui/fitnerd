import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FeedbackForm } from "./FeedbackForm"

function renderForm(onSuccess = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FeedbackForm onSuccess={onSuccess} />
    </QueryClientProvider>
  )
  return onSuccess
}

describe("FeedbackForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // SDD: 017 NFR-002 AC-N002.3
  it("muestra los campos de categoría y mensaje y el botón de envío", () => {
    renderForm()

    expect(screen.getByText("Categoría")).toBeInTheDocument()
    expect(screen.getByLabelText("Mensaje")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Enviar feedback" })
    ).toBeInTheDocument()
  })

  // SDD: 017 NFR-002 AC-N002.3
  it("muestra los errores de validación y no envía nada con el formulario vacío", async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal("fetch", fakeFetch)
    const onSuccess = renderForm()

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Enviar feedback" }))

    expect(
      (await screen.findAllByText("Elige una categoría")).length
    ).toBeGreaterThan(1)
    expect(
      await screen.findByText("El mensaje no puede estar vacío")
    ).toBeInTheDocument()
    expect(fakeFetch).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
