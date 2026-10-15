// Test de la barra de navegación de escritorio (spec 012, REQ-005).
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import { Navbar } from "./Navbar"

vi.mock("@/features/auth/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

describe("Navbar", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(getCurrentUser).mockResolvedValue({
      email: "a@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
  })

  // SDD: 012 REQ-005 AC-005.1
  it("muestra solo Macros, Métricas, Coach y Tienda, en ese orden, sin Catálogo ni Favoritos", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const nav = screen.getByRole("navigation")
    const sectionLinks = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") !== "/home")
      .map((link) => link.textContent)

    expect(sectionLinks).toEqual(["Macros", "Métricas", "Coach", "Tienda"])
    expect(screen.queryByRole("link", { name: "Catálogo" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Favoritos" })).not.toBeInTheDocument()
  })
})
