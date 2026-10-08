// Test de PÁGINA: política de privacidad (feature 005, REQ-012 y REQ-013).
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { PrivacyPolicyPage } from "./PrivacyPolicyPage"

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPolicyPage />
    </MemoryRouter>
  )
}

// La sección es el <section> que contiene el heading dado.
function sectionOf(name: string) {
  const heading = screen.getByRole("heading", { name })
  const section = heading.closest("section")
  if (!section) throw new Error(`No hay <section> para el heading "${name}"`)
  return section
}

const MONTHS =
  "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)"

describe("PrivacyPolicyPage", () => {
  // SDD: REQ-012 AC-012.1
  it("menciona a Langfuse con las valoraciones y que no se envían el email ni el nombre", () => {
    renderPage()
    const section = sectionOf("Con quién se comparte")

    const entry = within(section)
      .getAllByRole("listitem")
      .find((item) => /Langfuse/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    const text = entry?.textContent ?? ""
    expect(text).toMatch(/valoraciones/i)
    expect(text).toMatch(/email/i)
    expect(text).toMatch(/nombre/i)
    expect(text).toMatch(/nunca|ni /i)
  })

  // SDD: REQ-012 AC-012.2
  it("menciona a Voyage AI en 'Con quién se comparte'", () => {
    renderPage()
    const section = sectionOf("Con quién se comparte")

    expect(within(section).getByText(/Voyage AI/)).toBeInTheDocument()
  })

  // SDD: REQ-012 AC-012.3
  it("menciona a Langfuse en 'Tus derechos'", () => {
    renderPage()
    const section = sectionOf("Tus derechos")

    expect(section.textContent).toMatch(/Langfuse/)
  })

  // SDD: REQ-012 AC-012.1
  it("menciona las valoraciones del AI Coach en 'Actividad en la app'", () => {
    renderPage()

    const entry = screen
      .getAllByRole("listitem")
      .find((item) => /Actividad en la app/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    expect(entry?.textContent).toMatch(/valoraciones/i)
  })

  // SDD: REQ-012 AC-012.4
  it("muestra una última actualización con formato 'D de mes de AAAA' y distinta de la anterior", () => {
    renderPage()
    const text = document.body.textContent ?? ""

    expect(text).toMatch(new RegExp(`Última actualización: \\d{1,2} de ${MONTHS} de \\d{4}`))
    expect(text).not.toContain("2 de septiembre de 2026")
  })

  // SDD: REQ-013 AC-013.1
  it("no contiene formas de voseo", () => {
    renderPage()
    const text = document.body.textContent ?? ""

    for (const form of ["registrás", "iniciás", "vos mismo", "hacés", "usás", "usá ", "Podés"]) {
      expect(text).not.toContain(form)
    }
  })
})
