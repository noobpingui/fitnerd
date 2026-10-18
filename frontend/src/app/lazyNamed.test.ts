// Test de lazyNamed y reloadPage (spec 017, carga de pantallas bajo demanda).
import { createElement, Suspense } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { lazyNamed, reloadPage } from "@/app/lazyNamed"

describe("lazyNamed", () => {
  // SDD: 017 REQ-002 AC-002.1
  it("resuelve el export con nombre del módulo y lo renderiza dentro de Suspense", async () => {
    const Screen = () => createElement("p", null, "Pantalla de prueba")
    const Lazy = lazyNamed(() => Promise.resolve({ Screen }), "Screen")

    render(
      createElement(
        Suspense,
        { fallback: createElement("p", null, "Esperando") },
        createElement(Lazy)
      )
    )

    expect(await screen.findByText("Pantalla de prueba")).toBeInTheDocument()
    expect(screen.queryByText("Esperando")).not.toBeInTheDocument()
  })
})

describe("reloadPage", () => {
  // SDD: 017 REQ-003 AC-003.2
  it("llama una vez a reload de la location recibida", () => {
    const reload = vi.fn()

    reloadPage({ reload })

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
