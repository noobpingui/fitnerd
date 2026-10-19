// Test del aviso de relectura fallida (spec 020): rol `alert`, texto, botón
// «Reintentar» accesible por nombre y bloqueado mientras reintenta.
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  METRICS_REFRESH_FAILED_MESSAGE,
  PROFILE_REFRESH_FAILED_MESSAGE,
  RefreshFailedNotice,
} from "./RefreshFailedNotice"

describe("RefreshFailedNotice", () => {
  // SDD: 020 REQ-001 AC-001.6
  it("el componente renderizado muestra los textos de la spec", () => {
    const { rerender } = render(
      <RefreshFailedNotice
        message={METRICS_REFRESH_FAILED_MESSAGE}
        onRetry={() => {}}
        retrying={false}
      />
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla."
    )

    rerender(
      <RefreshFailedNotice
        message={PROFILE_REFRESH_FAILED_MESSAGE}
        onRetry={() => {}}
        retrying={false}
      />
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla."
    )
  })

  // SDD: 020 REQ-001 AC-001.6
  it("tiene el rol alert con el mensaje y el botón 'Reintentar'", () => {
    render(
      <RefreshFailedNotice
        message={METRICS_REFRESH_FAILED_MESSAGE}
        onRetry={() => {}}
        retrying={false}
      />
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(METRICS_REFRESH_FAILED_MESSAGE)
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled()
  })

  // SDD: 020 REQ-002 AC-002.7
  it("muestra el mensaje que recibe, también el del perfil", () => {
    render(
      <RefreshFailedNotice
        message={PROFILE_REFRESH_FAILED_MESSAGE}
        onRetry={() => {}}
        retrying={false}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent(PROFILE_REFRESH_FAILED_MESSAGE)
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })

  // SDD: 020 REQ-001 AC-001.6
  it("al pulsar 'Reintentar' llama a onRetry una vez", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <RefreshFailedNotice message="Aviso" onRetry={onRetry} retrying={false} />
    )

    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // SDD: 020 REQ-001 AC-001.6
  it("mientras reintenta el botón está deshabilitado y conserva su nombre", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<RefreshFailedNotice message="Aviso" onRetry={onRetry} retrying />)

    const button = screen.getByRole("button", { name: "Reintentar" })
    expect(button).toBeDisabled()
    await user.click(button)

    expect(onRetry).not.toHaveBeenCalled()
  })
})
