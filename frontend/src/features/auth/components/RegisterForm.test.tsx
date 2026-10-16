import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { register } from "@/features/auth/api"
import { RegisterForm } from "./RegisterForm"

// La red se simula en la capa api.ts de la feature (Art. P1.4).
vi.mock("@/features/auth/api", () => ({
  register: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  getCurrentUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

const registerMock = vi.mocked(register)

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// fireEvent.change en vez de user.type: escribir 73 caracteres uno a uno
// sería lentísimo, y la fecha de un <input type="date"> no se teclea bien.
async function fillAndSubmit(password: string) {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } })
  fireEvent.change(screen.getByLabelText("Apellido"), {
    target: { value: "Pérez" },
  })
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ana@example.com" },
  })
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
    target: { value: "1990-01-01" },
  })
  await userEvent.setup().click(
    screen.getByRole("button", { name: "Crear cuenta" })
  )
}

// Variante para REQ-013: permite fijar el correo y usa una contraseña válida fija.
async function fillAndSubmitWithEmail(email: string) {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } })
  fireEvent.change(screen.getByLabelText("Apellido"), {
    target: { value: "Pérez" },
  })
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } })
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Clave1234" },
  })
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
    target: { value: "1990-01-01" },
  })
  // Se envía el formulario directamente: jsdom aplica la validación nativa de
  // type="email" al hacer clic y no dejaría llegar al esquema de zod.
  const form = screen.getByRole("button", { name: "Crear cuenta" }).closest("form")!
  fireEvent.submit(form)
}

describe("RegisterForm - reglas de contraseña (spec 014)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    registerMock.mockReset()
  })

  // SDD: 014 REQ-008 AC-008.1
  it("muestra Mínimo 8 caracteres con 7 caracteres y no envía la petición", async () => {
    renderForm()

    await fillAndSubmit("Clave12")

    expect(await screen.findByText("Mínimo 8 caracteres")).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  // SDD: 014 REQ-008 AC-008.2
  it("muestra Contraseña demasiado larga con 73 bytes y no envía la petición", async () => {
    renderForm()

    await fillAndSubmit("a".repeat(73))

    expect(
      await screen.findByText("Contraseña demasiado larga")
    ).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  // SDD: 014 REQ-008 AC-008.3
  it("muestra Contraseña demasiado larga con 37 eñes (74 bytes) y no envía la petición", async () => {
    renderForm()

    await fillAndSubmit("ñ".repeat(37))

    expect(
      await screen.findByText("Contraseña demasiado larga")
    ).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  // SDD: 014 REQ-008 AC-008.4
  it("envía el registro con 36 eñes (exactamente 72 bytes)", async () => {
    registerMock.mockResolvedValue({ token: "un-jwt-de-mentira" })
    const password = "ñ".repeat(36)
    renderForm()

    await fillAndSubmit(password)

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1))
    expect(registerMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ password })
    )
    expect(
      screen.queryByText("Contraseña demasiado larga")
    ).not.toBeInTheDocument()
  })

  // SDD: 014 REQ-008 AC-008.5
  it("cuenta cada emoji como un carácter: 7 emojis muestran Mínimo 8 caracteres", async () => {
    renderForm()

    await fillAndSubmit("😀".repeat(7))

    expect(await screen.findByText("Mínimo 8 caracteres")).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  // SDD: 014 REQ-008 AC-008.6
  it("muestra el error 400 del servidor sobre la contraseña demasiado larga", async () => {
    registerMock.mockRejectedValue(
      new ApiError(400, "La contraseña es demasiado larga")
    )
    renderForm()

    await fillAndSubmit("Clave1234")

    expect(
      await screen.findByText("La contraseña es demasiado larga")
    ).toBeInTheDocument()
  })
})

describe("RegisterForm - correo con espacios (spec 014)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    registerMock.mockReset()
  })

  // SDD: 014 REQ-013 AC-013.1
  it("envía el correo recortado y con sus mayúsculas, sin mostrar Email inválido", async () => {
    registerMock.mockResolvedValue({ token: "un-jwt-de-mentira" })
    renderForm()

    await fillAndSubmitWithEmail("  Ana@Example.COM ")

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1))
    expect(registerMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ email: "Ana@Example.COM" })
    )
    expect(screen.queryByText("Email inválido")).not.toBeInTheDocument()
  })

  // SDD: 014 REQ-013 AC-013.4
  it("muestra Email inválido con un correo de solo espacios y no envía la petición", async () => {
    renderForm()

    await fillAndSubmitWithEmail("   ")

    expect(await screen.findByText("Email inválido")).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  // SDD: 014 REQ-013 AC-013.5
  it("muestra Email inválido con ' no-es-un-correo ' y no envía la petición", async () => {
    renderForm()

    await fillAndSubmitWithEmail(" no-es-un-correo ")

    expect(await screen.findByText("Email inválido")).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })
})
