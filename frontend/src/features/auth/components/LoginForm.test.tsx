// Test de COMPONENTE: renderiza el formulario real en un DOM real (jsdom)
// y lo usa como lo usaría una persona (click, no "llamar a la función de
// submit a mano") - eso es lo que React Testing Library empuja a hacer:
// probar el comportamiento visible, no los detalles internos de
// implementación. A diferencia del test de dateUtils.ts, aquí sí hay React
// de por medio, pero todavia no hace falta mockear la API: cuando la
// validación de Zod falla, react-hook-form ni siquiera llega a llamar a la
// mutation (useLogin) - por eso este test no necesita tocar la red para nada.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LoginForm } from "./LoginForm"

function renderLoginForm() {
  // Un QueryClient nuevo por test - si se compartiera uno solo entre tests,
  // el caché de una corrida podría filtrarse a la siguiente (mismo motivo
  // por el que el backend limpia la base entre cada test).
  const queryClient = new QueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Para el test de login EXITOSO hace falta simular la navegación real a
// "/" (useLogin llama a navigate("/") en su onSuccess) - initialEntries
// arranca la "navegación en memoria" en /login, y la Route de "/" renderiza
// un marcador simple que el test puede buscar para confirmar que redirigió.
function renderLoginFormWithRouting() {
  const queryClient = new QueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/" element={<p>Pantalla de home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("LoginForm", () => {
  beforeEach(() => {
    // GoogleSignInButton intenta cargar un script externo real si detecta
    // un client_id configurado (ver GoogleSignInButton.tsx) - lo
    // "apagamos" para este test aunque el .env local tenga uno real, así
    // el test nunca depende de una carga de red externa.
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  it("muestra los errores de validación al enviar el formulario vacío", async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Email inválido")).toBeInTheDocument()
    expect(
      await screen.findByText("La contraseña es obligatoria")
    ).toBeInTheDocument()
  })

  it("no muestra errores de validación una vez que se completan los campos correctamente", async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "persona@example.com")
    await user.type(screen.getByLabelText("Password"), "unaContraseña123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    // No podemos (ni queremos, en este test) esperar un login exitoso real
    // - eso pasa por la red, y es tema del próximo nivel (tests con la API
    // mockeada). Lo que sí podemos afirmar aquí, sin tocar la red: que la
    // validación en sí no bloquea el envío cuando los datos son válidos.
    expect(screen.queryByText("Email inválido")).not.toBeInTheDocument()
    expect(
      screen.queryByText("La contraseña es obligatoria")
    ).not.toBeInTheDocument()
  })
})

// Tercer nivel, mockeando la RED de verdad (fetch) - equivalente en el
// frontend a mockear LLMClient en el backend: reemplazamos el límite real
// de I/O (la llamada HTTP), no nuestro propio código, así que apiClient.ts,
// useLogin, y el form completo siguen corriendo tal cual corren en
// producción - lo único "falso" es la respuesta del servidor.
describe("LoginForm - login exitoso (API mockeada)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("guarda el token y redirige a home cuando el backend acepta las credenciales", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "un-jwt-de-mentira" }), {
        status: 200,
      })
    )
    vi.stubGlobal("fetch", fakeFetch)

    const user = userEvent.setup()
    renderLoginFormWithRouting()

    await user.type(screen.getByLabelText("Email"), "persona@example.com")
    await user.type(screen.getByLabelText("Password"), "unaContraseña123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    // La redirección a "/" (vía navigate() dentro de useLogin.onSuccess)
    // solo pasa DESPUÉS de que la promesa del fetch mockeado se resuelve -
    // findBy* espera (reintentando) hasta que aparezca, en vez de asumir
    // que ya está ahí en el mismo tick.
    expect(await screen.findByText("Pantalla de home")).toBeInTheDocument()
    expect(localStorage.getItem("fitnerd_token")).toBe("un-jwt-de-mentira")

    // También vale la pena afirmar COMO se llamó a fetch - que apiClient
    // realmente arma la request de login como se espera (método, endpoint).
    expect(fakeFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("muestra el mensaje de error del backend cuando las credenciales son incorrectas", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Wrong Credentials" }), {
        status: 401,
      })
    )
    vi.stubGlobal("fetch", fakeFetch)

    const user = userEvent.setup()
    renderLoginFormWithRouting()

    await user.type(screen.getByLabelText("Email"), "persona@example.com")
    await user.type(screen.getByLabelText("Password"), "contraseñaIncorrecta")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Wrong Credentials")).toBeInTheDocument()
    // Sin token guardado, y sin redirigir - un login fallido no debe dejar
    // a la persona "medio adentro".
    expect(localStorage.getItem("fitnerd_token")).toBeNull()
    expect(screen.queryByText("Pantalla de home")).not.toBeInTheDocument()
  })
})

// Recuperación de contraseña (spec 002): enlace en el login y aviso tras un
// restablecimiento exitoso (llega por location.state.passwordReset).
describe("LoginForm - recuperación de contraseña", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  function renderWithState(state?: { passwordReset: boolean }) {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
          <LoginForm />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  // SDD: REQ-001 AC-001.1
  it("muestra el enlace ¿Olvidaste tu contraseña? que apunta a /forgot-password", () => {
    renderWithState()

    const link = screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })

    expect(link).toHaveAttribute("href", "/forgot-password")
  })

  // SDD: REQ-011 AC-011.4
  it("muestra el aviso de éxito cuando llega state.passwordReset", () => {
    renderWithState({ passwordReset: true })

    expect(
      screen.getByText("Contraseña actualizada. Ya puedes iniciar sesión.")
    ).toBeInTheDocument()
  })

  // SDD: REQ-011 AC-011.4
  it("no muestra el aviso de éxito sin state.passwordReset", () => {
    renderWithState()

    expect(
      screen.queryByText("Contraseña actualizada. Ya puedes iniciar sesión.")
    ).not.toBeInTheDocument()
  })
})

// Aviso de contraseña actualizada una sola vez (spec 014, REQ-011). Se usa un
// router en memoria de datos para poder inspeccionar y recorrer el historial.
describe("LoginForm - aviso de contraseña actualizada una sola vez", () => {
  const NOTICE = "Contraseña actualizada. Ya puedes iniciar sesión."

  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderWithRouter(state?: { passwordReset: boolean }) {
    const router = createMemoryRouter(
      [
        { path: "/login", element: <LoginForm /> },
        { path: "/register", element: <p>Pantalla de registro</p> },
      ],
      { initialEntries: [{ pathname: "/login", state }] }
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    return router
  }

  // SDD: 014 REQ-011 AC-011.1
  it("muestra el aviso al llegar a /login tras restablecer la contraseña", () => {
    renderWithRouter({ passwordReset: true })

    expect(screen.getByText(NOTICE)).toBeInTheDocument()
  })

  // SDD: 014 REQ-011 AC-011.2
  it("mantiene el aviso visible mientras se escribe en los campos", async () => {
    const user = userEvent.setup()
    renderWithRouter({ passwordReset: true })

    await user.type(screen.getByLabelText("Email"), "persona@example.com")
    await user.type(screen.getByLabelText("Password"), "unaContraseña123")

    expect(screen.getByText(NOTICE)).toBeInTheDocument()
  })

  // SDD: 014 REQ-011 AC-011.2
  it("mantiene el aviso visible cuando un intento de login falla con 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Wrong Credentials" }), {
          status: 401,
        })
      )
    )
    const user = userEvent.setup()
    renderWithRouter({ passwordReset: true })

    await user.type(screen.getByLabelText("Email"), "persona@example.com")
    await user.type(screen.getByLabelText("Password"), "contraseñaIncorrecta")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Wrong Credentials")).toBeInTheDocument()
    expect(screen.getByText(NOTICE)).toBeInTheDocument()
  })

  // SDD: 014 REQ-011 AC-011.3
  it("limpia el indicador de la entrada del historial sin ocultar el aviso de la visita", async () => {
    const router = renderWithRouter({ passwordReset: true })

    await waitFor(() =>
      expect(router.state.location.state?.passwordReset).not.toBe(true)
    )
    expect(router.state.location.pathname).toBe("/login")
    expect(screen.getByText(NOTICE)).toBeInTheDocument()
  })

  // SDD: 014 REQ-011 AC-011.4
  it("no vuelve a mostrar el aviso al regresar a /login con atrás", async () => {
    const router = renderWithRouter({ passwordReset: true })
    await waitFor(() =>
      expect(router.state.location.state?.passwordReset).not.toBe(true)
    )

    await act(async () => {
      await router.navigate("/register")
    })
    expect(screen.getByText("Pantalla de registro")).toBeInTheDocument()
    await act(async () => {
      await router.navigate(-1)
    })

    expect(await screen.findByLabelText("Email")).toBeInTheDocument()
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
  })

  // SDD: 014 REQ-011 AC-011.5
  it("no muestra el aviso en una visita a /login sin venir de un restablecimiento", () => {
    renderWithRouter()

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
  })
})

describe("LoginForm - correo con espacios (spec 014)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // SDD: 014 REQ-013 AC-013.2
  it("envía el correo recortado y no muestra Email inválido", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Wrong Credentials" }), {
          status: 401,
        })
      )
    vi.stubGlobal("fetch", fakeFetch)
    const user = userEvent.setup()
    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), " ana@example.com  ")
    await user.type(screen.getByLabelText("Password"), "Clave123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    await waitFor(() => expect(fakeFetch).toHaveBeenCalledTimes(1))
    const [url, init] = fakeFetch.mock.calls[0]
    expect(String(url)).toContain("/api/auth/login")
    expect(JSON.parse(init.body)).toEqual(
      expect.objectContaining({ email: "ana@example.com" })
    )
    expect(screen.queryByText("Email inválido")).not.toBeInTheDocument()
  })
})
