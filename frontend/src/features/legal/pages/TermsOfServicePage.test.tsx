// Test de PÁGINA: términos de servicio (spec 012, REQ-007).
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { TermsOfServicePage } from "./TermsOfServicePage"

function renderPage() {
  return render(
    <MemoryRouter>
      <TermsOfServicePage />
    </MemoryRouter>
  )
}

function sectionOf(name: string) {
  const heading = screen.getByRole("heading", { name })
  const section = heading.closest("section")
  if (!section) throw new Error(`No hay <section> para el heading "${name}"`)
  return section
}

const MONTHS =
  "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)"

describe("TermsOfServicePage", () => {
  // SDD: 012 REQ-007 AC-007.4
  it("'No es asesoría médica' advierte sobre el AI Coach y no menciona el catálogo", () => {
    renderPage()
    const text = sectionOf("No es asesoría médica").textContent ?? ""

    expect(text).toContain("AI Coach")
    expect(text).toContain("información general")
    expect(text).toContain("profesional")
    expect(text.toLowerCase()).not.toContain("catálogo")
  })

  // SDD: 012 REQ-007 AC-007.5
  it("la última actualización tiene formato 'D de mes de AAAA' y no es la del 2 de septiembre de 2026", () => {
    renderPage()
    const text = document.body.textContent ?? ""

    expect(text).toMatch(new RegExp(`Última actualización: \\d{1,2} de ${MONTHS} de \\d{4}`))
    expect(text).not.toContain("2 de septiembre de 2026")
  })

  // SDD: 012 REQ-007 AC-007.6
  it("no contiene formas de voseo", () => {
    renderPage()
    const text = document.body.textContent ?? ""

    for (const form of ["registrás", "iniciás", "vos mismo", "hacés", "usás", "usá ", "Podés"]) {
      expect(text).not.toContain(form)
    }
  })
})
