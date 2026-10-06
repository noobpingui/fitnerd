import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ResetPasswordForm } from "./ResetPasswordForm"

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ResetPasswordForm token="abc" />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

async function fillAndSubmit(password: string, confirm: string = password) {
  const user = userEvent.setup()
  // paste en vez de type: escribir 73 caracteres uno a uno seria lentisimo.
  await user.click(screen.getByLabelText("Nueva contraseña"))
  await user.paste(password)
  await user.click(screen.getByLabelText("Confirmar contraseña"))
  await user.paste(confirm)
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }))
}

describe("ResetPasswordForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // SDD: REQ-011 AC-011.2
  it("muestra Mínimo 8 caracteres y no envia peticion con una contraseña corta", async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal("fetch", fakeFetch)
    renderForm()

    await fillAndSubmit("corta")

    expect(await screen.findByText("Mínimo 8 caracteres")).toBeInTheDocument()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  // SDD: REQ-011 AC-011.3
  it("muestra Las contraseñas no coinciden y no envia peticion", async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal("fetch", fakeFetch)
    renderForm()

    await fillAndSubmit("Clave12345", "OtraClave999")

    expect(
      await screen.findByText("Las contraseñas no coinciden")
    ).toBeInTheDocument()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  // SDD: REQ-011 AC-011.8
  it("muestra Contraseña demasiado larga con 73 bytes y no envia peticion", async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal("fetch", fakeFetch)
    renderForm()

    await fillAndSubmit("a".repeat(73))

    expect(
      await screen.findByText("Contraseña demasiado larga")
    ).toBeInTheDocument()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  // SDD: REQ-011 AC-011.9
  it("muestra Contraseña demasiado larga con 37 ñ (74 bytes) y no envia peticion", async () => {
    const fakeFetch = vi.fn()
    vi.stubGlobal("fetch", fakeFetch)
    renderForm()

    await fillAndSubmit("ñ".repeat(37))

    expect(
      await screen.findByText("Contraseña demasiado larga")
    ).toBeInTheDocument()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  // SDD: REQ-011 AC-011.5
  it("muestra el error del backend y el enlace Solicitar un enlace nuevo ante un 400", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "El enlace no es válido o ha caducado. Solicita uno nuevo.",
        }),
        { status: 400 }
      )
    )
    vi.stubGlobal("fetch", fakeFetch)
    renderForm()

    await fillAndSubmit("Clave12345")

    expect(
      await screen.findByText(
        "El enlace no es válido o ha caducado. Solicita uno nuevo."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Solicitar un enlace nuevo" })
    ).toHaveAttribute("href", "/forgot-password")
    // El cuerpo enviado lleva el token de la URL y la contraseña nueva.
    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toContain("/api/auth/reset-password")
    expect(JSON.parse(options.body)).toEqual({
      token: "abc",
      password: "Clave12345",
    })
  })

  // SDD: REQ-011 AC-011.7
  it("muestra Guardando... y deshabilita el boton mientras la peticion esta en curso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})))
    renderForm()

    await fillAndSubmit("Clave12345")

    const button = await screen.findByRole("button", { name: "Guardando..." })
    expect(button).toBeDisabled()
  })
})
