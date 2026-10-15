// Test de COMPONENTE de GoogleSignInButton (spec 013, NFR-005): sin
// VITE_GOOGLE_CLIENT_ID el botón no se dibuja y la app sigue avisando al
// desarrollador por la consola del navegador. El aviso solo se quita de la
// salida de los tests (vite.config.ts), no de la app.
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("GoogleSignInButton - sin VITE_GOOGLE_CLIENT_ID", () => {
  // SDD: 013 NFR-005 AC-N005.3
  it("no dibuja el botón y avisa por console.warn", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
    // La constante se lee al importar el módulo: se reinician los módulos y se
    // importa todo de nuevo para que React y el componente compartan instancia.
    vi.resetModules()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { render } = await import("@testing-library/react")
    const { MemoryRouter } = await import("react-router")
    const { QueryClient, QueryClientProvider } = await import(
      "@tanstack/react-query"
    )
    const { GoogleSignInButton } = await import("./GoogleSignInButton")

    const { container, unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <GoogleSignInButton />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(container.querySelector("iframe")).toBeNull()
    expect(container.querySelector("button")).toBeNull()
    expect(container.textContent).toBe("")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("VITE_GOOGLE_CLIENT_ID no esta configurado")
    )
    unmount()
  })
})
