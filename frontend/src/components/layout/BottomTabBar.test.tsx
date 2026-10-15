// Test de la barra inferior móvil (spec 012, REQ-005).
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { BottomTabBar } from "./BottomTabBar"

describe("BottomTabBar", () => {
  // SDD: 012 REQ-005 AC-005.2
  it("muestra solo Inicio, Macros, Métricas, Coach y Tienda, en ese orden", () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>
    )

    const tabs = within(screen.getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.textContent)

    expect(tabs).toEqual(["Inicio", "Macros", "Métricas", "Coach", "Tienda"])
    expect(screen.queryByText("Catálogo")).not.toBeInTheDocument()
    expect(screen.queryByText("Favoritos")).not.toBeInTheDocument()
  })
})
