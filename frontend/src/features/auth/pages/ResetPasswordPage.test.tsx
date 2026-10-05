import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ResetPasswordPage } from "./ResetPasswordPage"
import { LoginForm } from "@/features/auth/components/LoginForm"

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<LoginForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // SDD: REQ-011 AC-011.1
  it("muestra los campos y el boton cuando la URL trae token", () => {
    renderAt("/reset-password?token=abc")

    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument()
    expect(screen.getByLabelText("Confirmar contraseña")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Guardar contraseña" })
    ).toBeInTheDocument()
  })

  // SDD: REQ-011 AC-011.6
  it.each(["/reset-password", "/reset-password?token="])(
    "sin token (%s) no muestra el formulario y ofrece solicitar un enlace nuevo",
    (url) => {
      renderAt(url)

      expect(
        screen.getByText(
          "El enlace no es válido o ha caducado. Solicita uno nuevo."
        )
      ).toBeInTheDocument()
      expect(screen.queryByLabelText("Nueva contraseña")).not.toBeInTheDocument()
      expect(
        screen.getByRole("link", { name: "Solicitar un enlace nuevo" })
      ).toHaveAttribute("href", "/forgot-password")
    }
  )

  // SDD: REQ-011 AC-011.4
  it("tras un 200 termina en /login con el aviso de contraseña actualizada", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "Contraseña actualizada" }), {
            status: 200,
          })
        )
    )
    const user = userEvent.setup()
    renderAt("/reset-password?token=abc")

    await user.type(screen.getByLabelText("Nueva contraseña"), "Clave12345")
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Clave12345")
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }))

    expect(
      await screen.findByText("Contraseña actualizada. Ya puedes iniciar sesión.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument()
  })
})
