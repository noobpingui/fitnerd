import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ForgotPasswordForm } from "./ForgotPasswordForm"

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ForgotPasswordForm />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function stubFetchWith(status: number, body: unknown) {
  const fakeFetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal("fetch", fakeFetch)
  return fakeFetch
}

async function submitEmail(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Email"), email)
  await user.click(screen.getByRole("button", { name: "Enviar enlace" }))
}

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // SDD: REQ-005 AC-005.3
  it("muestra Email inválido y no envia ninguna peticion con un correo mal formado", async () => {
    const fakeFetch = stubFetchWith(200, { message: "ok" })
    renderForm()

    await submitEmail("persona@invalido")

    expect(await screen.findByText("Email inválido")).toBeInTheDocument()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  // SDD: REQ-010 AC-010.1
  it("muestra el mensaje de exito cuando el backend responde 200", async () => {
    stubFetchWith(200, { message: "mensaje corto del backend" })
    renderForm()

    await submitEmail("persona@example.com")

    expect(
      await screen.findByText(
        "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla. Revisa tu bandeja de entrada y la carpeta de spam."
      )
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.2
  it("muestra el error del backend cuando el limite por correo da 429", async () => {
    stubFetchWith(429, {
      error:
        "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde.",
    })
    renderForm()

    await submitEmail("persona@example.com")

    expect(
      await screen.findByText(
        "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."
      )
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.2
  it("muestra el error del backend cuando el limite por IP da 429", async () => {
    stubFetchWith(429, {
      error: "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde.",
    })
    renderForm()

    await submitEmail("persona@example.com")

    expect(
      await screen.findByText(
        "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."
      )
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.2
  it("muestra el error del backend cuando el envio del correo falla con 503", async () => {
    stubFetchWith(503, {
      error: "No se pudo enviar el correo. Inténtalo de nuevo más tarde.",
    })
    renderForm()

    await submitEmail("persona@example.com")

    expect(
      await screen.findByText(
        "No se pudo enviar el correo. Inténtalo de nuevo más tarde."
      )
    ).toBeInTheDocument()
  })

  // SDD: REQ-010 AC-010.3
  it("muestra Enviando... y deshabilita el boton mientras la peticion esta en curso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})))
    renderForm()

    await submitEmail("persona@example.com")

    const button = await screen.findByRole("button", { name: "Enviando..." })
    expect(button).toBeDisabled()
  })

  // SDD: REQ-010 AC-010.4
  it("tiene un enlace Volver al login que apunta a /login", () => {
    renderForm()

    expect(
      screen.getByRole("link", { name: "Volver al login" })
    ).toHaveAttribute("href", "/login")
  })
})
