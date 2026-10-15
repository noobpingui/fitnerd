// Test de la cabecera de las pantallas de acceso (spec 012, REQ-006).
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { RegisterPage } from "@/features/auth/pages/RegisterPage"

function renderPage(page: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("AuthHero en las pantallas de acceso", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")
  })

  // SDD: 012 REQ-006 AC-006.1
  it("/login muestra 'AI Coach online' y no los textos del catálogo ni de favoritos", () => {
    renderPage(<LoginPage />)

    expect(screen.getByText("AI Coach online")).toBeInTheDocument()
    expect(
      screen.queryByText("Catálogo de ejercicios con técnica de ejecución")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Guarda tus ejercicios favoritos")).not.toBeInTheDocument()
  })

  // SDD: 012 REQ-006 AC-006.2
  it("/register muestra 'AI Coach online' y no los textos del catálogo ni de favoritos", () => {
    renderPage(<RegisterPage />)

    expect(screen.getByText("AI Coach online")).toBeInTheDocument()
    expect(
      screen.queryByText("Catálogo de ejercicios con técnica de ejecución")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Guarda tus ejercicios favoritos")).not.toBeInTheDocument()
  })
})
