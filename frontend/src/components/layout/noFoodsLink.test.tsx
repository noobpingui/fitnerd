// La ruta /foods (spec 021; desde la 023 redirige a /diary) no tiene entrada en la
// navegación: ni la barra de escritorio ni la inferior móvil la enlazan.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { getCurrentUser } from "@/features/auth/api"
import routerSource from "@/app/router.tsx?raw"
import { BottomTabBar } from "./BottomTabBar"
import { Navbar } from "./Navbar"

vi.mock("@/features/auth/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

function expectNoFoodsEntry(container: HTMLElement) {
  // Precondición: la pantalla existe y se alcanza solo por la URL /foods.
  expect(routerSource).toMatch(/path="\/foods"/)
  expect(screen.queryByRole("link", { name: /alimentos/i })).not.toBeInTheDocument()
  expect(screen.queryByText("Alimentos")).not.toBeInTheDocument()
  expect(container.querySelector('a[href="/foods"]')).toBeNull()
}

describe("Navegación sin entrada a Alimentos", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(getCurrentUser).mockResolvedValue({
      email: "a@example.com",
    } as Awaited<ReturnType<typeof getCurrentUser>>)
  })

  // SDD: 021 REQ-012 AC-012.8
  // SDD: 023 REQ-011 AC-011.2
  it("la barra de escritorio no tiene enlace «Alimentos» ni apunta a /foods", () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expectNoFoodsEntry(container)
  })

  // SDD: 021 REQ-012 AC-012.8
  // SDD: 023 REQ-011 AC-011.2
  it("la barra inferior móvil no tiene enlace «Alimentos» ni apunta a /foods", () => {
    const { container } = render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>
    )

    expectNoFoodsEntry(container)
  })
})
