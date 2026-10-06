// Las rutas de recuperacion de contraseña son PUBLICAS: se abren sin sesion
// y no deben redirigir al login.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouter } from "@/app/router"

describe("AppRouter - rutas de recuperacion de contraseña", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  function renderRouter() {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <AppRouter />
      </QueryClientProvider>
    )
  }

  // SDD: REQ-001 AC-001.2
  it("/forgot-password muestra el formulario sin sesion y sin redirigir al login", async () => {
    window.history.pushState({}, "", "/forgot-password")

    renderRouter()

    expect(await screen.findByLabelText("Email")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Enviar enlace" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/forgot-password")
  })

  // SDD: REQ-001 AC-001.2
  it("/reset-password?token=abc es accesible sin sesion y sin redirigir al login", async () => {
    window.history.pushState({}, "", "/reset-password?token=abc")

    renderRouter()

    expect(await screen.findByLabelText("Nueva contraseña")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/reset-password")
  })
})
