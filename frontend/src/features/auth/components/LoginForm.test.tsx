// Test de COMPONENTE: renderiza el formulario real en un DOM real (jsdom)
// y lo usa como lo usaria una persona (click, no "llamar a la funcion de
// submit a mano") - eso es lo que React Testing Library empuja a hacer:
// probar el comportamiento visible, no los detalles internos de
// implementacion. A diferencia del test de dateUtils.ts, aca SI hay React
// de por medio, pero todavia no hace falta mockear la API: cuando la
// validacion de Zod falla, react-hook-form ni siquiera llega a llamar a la
// mutation (useLogin) - por eso este test no necesita tocar la red para nada.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LoginForm } from "./LoginForm"

function renderLoginForm() {
  // Un QueryClient nuevo por test - si se compartiera uno solo entre tests,
  // el cache de una corrida podria filtrarse a la siguiente (mismo motivo
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

// Para el test de login EXITOSO hace falta simular la navegacion real a
// "/" (useLogin llama a navigate("/") en su onSuccess) - initialEntries
// arranca la "navegacion en memoria" en /login, y la Route de "/" renderiza
// un marcador simple que el test puede buscar para confirmar que redirigio.
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
    // "apagamos" para este test aunque el .env local tenga uno real, asi
    // el test nunca depende de una carga de red externa.
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  it("muestra los errores de validacion al enviar el formulario vacio", async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Email inválido")).toBeInTheDocument()
    expect(
      await screen.findByText("La contraseña es obligatoria")
    ).toBeInTheDocument()
  })

  it("no muestra errores de validacion una vez que se completan los campos correctamente", async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "persona@example.com")
    await user.type(screen.getByLabelText("Password"), "unaContraseña123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    // No podemos (ni queremos, en este test) esperar un login exitoso real
    // - eso pasa por la red, y es tema del proximo nivel (tests con la API
    // mockeada). Lo que SI podemos afirmar aca, sin tocar la red: que la
    // validacion en si no bloquea el envio cuando los datos son validos.
    expect(screen.queryByText("Email inválido")).not.toBeInTheDocument()
    expect(
      screen.queryByText("La contraseña es obligatoria")
    ).not.toBeInTheDocument()
  })
})

// Tercer nivel, mockeando la RED de verdad (fetch) - equivalente en el
// frontend a mockear LLMClient en el backend: reemplazamos el limite real
// de I/O (la llamada HTTP), no nuestro propio codigo, asi que apiClient.ts,
// useLogin, y el form completo siguen corriendo tal cual corren en
// produccion - lo unico "falso" es la respuesta del servidor.
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

    // La redireccion a "/" (via navigate() dentro de useLogin.onSuccess)
    // solo pasa DESPUES de que la promesa del fetch mockeado se resuelve -
    // findBy* espera (reintentando) hasta que aparezca, en vez de asumir
    // que ya esta ahi en el mismo tick.
    expect(await screen.findByText("Pantalla de home")).toBeInTheDocument()
    expect(localStorage.getItem("fitnerd_token")).toBe("un-jwt-de-mentira")

    // Tambien vale la pena afirmar COMO se llamo a fetch - que apiClient
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
