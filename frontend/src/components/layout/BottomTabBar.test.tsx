// Test de la barra inferior móvil (spec 012, REQ-005).
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { BottomTabBar } from "./BottomTabBar"

describe("BottomTabBar", () => {
  // SDD: 012 REQ-005 AC-005.2
  // SDD: 022 REQ-015 AC-015.2
  it("muestra Inicio, Diario, Macros, Métricas, Coach y Tienda, en ese orden", () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>
    )

    const tabs = within(screen.getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.textContent)

    expect(tabs).toEqual(["Inicio", "Diario", "Macros", "Métricas", "Coach", "Tienda"])
    expect(screen.queryByText("Catálogo")).not.toBeInTheDocument()
    expect(screen.queryByText("Favoritos")).not.toBeInTheDocument()
  })

  // SDD: 022 REQ-015 AC-015.2
  it("«Diario» lleva a /diary", () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>
    )

    expect(screen.getByRole("link", { name: "Diario" })).toHaveAttribute("href", "/diary")
  })

  // SDD: 022 REQ-015 AC-015.3
  it("en /diary la pestaña «Diario» aparece como activa y las demás no", () => {
    render(
      <MemoryRouter initialEntries={["/diary"]}>
        <BottomTabBar />
      </MemoryRouter>
    )

    expect(screen.getByRole("link", { name: "Diario" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Macros" })).not.toHaveAttribute("aria-current")
  })
})
