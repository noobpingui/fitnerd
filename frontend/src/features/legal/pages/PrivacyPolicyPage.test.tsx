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

  // SDD: 022 REQ-016 AC-016.2
  it("'Qué información recolectamos' incluye «Diario de comidas:» con los alimentos y cantidades", () => {
    renderPage()
    const section = sectionOf("Qué información recolectamos")

    const entry = within(section)
      .getAllByRole("listitem")
      .find((item) => /Diario de comidas:/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    const text = entry?.textContent ?? ""
    expect(text).toMatch(/alimentos/i)
    expect(text).toMatch(/cantidades/i)
  })

  // SDD: 023 REQ-012 AC-012.2
  it("el punto de Voyage AI ya no menciona las búsquedas de alimentos y sigue con las preguntas al coach", () => {
    renderPage()
    const section = sectionOf("Con quién se comparte")

    const entry = within(section)
      .getAllByRole("listitem")
      .find((item) => /Voyage AI/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    expect(entry?.textContent).not.toMatch(/búsquedas de alimentos/i)
    expect(entry?.textContent).not.toMatch(/alimentos/i)
    expect(entry?.textContent).toMatch(/preguntas/i)
    expect(entry?.textContent).toMatch(/coach/i)
  })

  // SDD: 028 REQ-021 AC-021.1
  // (sustituye al de la 025, que fijaba el 22 de octubre: la 028 actualiza la política)
  it("la última actualización es la del 27 de octubre de 2026 y ya no la del 22", () => {
    renderPage()

    const text = document.body.textContent ?? ""
    expect(text).toContain("Última actualización: 27 de octubre de 2026")
    expect(text).not.toContain("22 de octubre de 2026")
    expect(text).not.toContain("21 de octubre de 2026")
  })

  // SDD: 028 REQ-021 AC-021.1
  it("el punto «Diario de comidas:» menciona los alimentos personalizados que guardas y tus favoritos", () => {
    renderPage()
    const section = sectionOf("Qué información recolectamos")

    const entry = within(section)
      .getAllByRole("listitem")
      .find((item) => /Diario de comidas:/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    const text = (entry?.textContent ?? "").replace(/\s+/g, " ")
    expect(text).toMatch(/alimentos personalizados/i)
    expect(text).toMatch(/favoritos/i)
    // Lo anterior de la 022 se mantiene.
    expect(text).toMatch(/cantidades/i)
  })

  // SDD: 025 REQ-014 AC-014.1
  it("'Con quién se comparte' incluye «Amazon Web Services (Amazon Bedrock):» con el texto de las fotos", () => {
    renderPage()
    const section = sectionOf("Con quién se comparte")

    const entry = within(section)
      .getAllByRole("listitem")
      .find((item) => /Amazon Web Services \(Amazon Bedrock\):/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    const text = (entry?.textContent ?? "").replace(/\s+/g, " ")
    expect(text).toContain(
      "Las fotos de comidas que envías para analizar se procesan con un modelo de IA de Amazon Bedrock para reconocer los alimentos. Se envían sin sus metadatos (ubicación, cámara y fecha) y fitnerd no las guarda."
    )
  })

  // SDD: 025 REQ-014 AC-014.2
  it("el punto de Langfuse añade que del análisis de fotos solo se envían formato, tamaño y número de alimentos, nunca la foto", () => {
    renderPage()
    const section = sectionOf("Con quién se comparte")

    const entry = within(section)
      .getAllByRole("listitem")
      .find((item) => /Langfuse/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    expect((entry?.textContent ?? "").replace(/\s+/g, " ")).toContain(
      "Del análisis de fotos solo se envían el formato, el tamaño y el número de alimentos reconocidos, nunca la foto."
    )
  })

  // SDD: 005 REQ-012 AC-012.3
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

  // SDD: 012 REQ-007 AC-007.1
  it("'Actividad en la app' menciona al AI Coach y sus valoraciones, sin favoritos ni plan semanal", () => {
    renderPage()

    const entry = screen
      .getAllByRole("listitem")
      .find((item) => /Actividad en la app/.test(item.textContent ?? ""))

    expect(entry).toBeDefined()
    const text = entry?.textContent ?? ""
    expect(text).toMatch(/AI Coach/)
    expect(text).toMatch(/valoraciones/i)
    expect(text.toLowerCase()).not.toContain("favoritos")
    expect(text.toLowerCase()).not.toContain("plan semanal")
  })

  // SDD: 012 REQ-007 AC-007.2
  it("'Para qué usamos tu información' no menciona catálogo, favoritos ni plan", () => {
    renderPage()

    const text = (sectionOf("Para qué usamos tu información").textContent ?? "").toLowerCase()

    expect(text).not.toContain("catálogo")
    expect(text).not.toContain("favoritos")
    expect(text).not.toContain("plan")
  })

  // SDD: 012 REQ-007 AC-007.3
  it("la última actualización tiene formato 'D de mes de AAAA' y no es la del 8 de octubre de 2026", () => {
    renderPage()
    const text = document.body.textContent ?? ""

    expect(text).toMatch(new RegExp(`Última actualización: \\d{1,2} de ${MONTHS} de \\d{4}`))
    expect(text).not.toMatch(/(^|\D)8 de octubre de 2026/)
  })

  // SDD: 012 REQ-007 AC-007.6
  it("sigue sin formas de voseo tras reescribir los textos", () => {
    renderPage()
    const text = document.body.textContent ?? ""

    for (const form of ["registrás", "iniciás", "vos mismo", "hacés", "usás", "usá ", "Podés"]) {
      expect(text).not.toContain(form)
    }
  })
})
