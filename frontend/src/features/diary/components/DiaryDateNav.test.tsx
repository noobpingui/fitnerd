// Navegación entre días del diario (spec 026): botones, «Hoy» y selector de fecha.
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DiaryDateNav } from "./DiaryDateNav"

const TODAY = "2026-10-26"

function renderNav(date: string, onChange = vi.fn()) {
  render(<DiaryDateNav date={date} today={TODAY} onChange={onChange} />)
  return onChange
}

describe("DiaryDateNav", () => {
  // SDD: 026 REQ-002 AC-002.3
  it("en hoy, «Día siguiente» está deshabilitado y no hay botón «Hoy»", () => {
    renderNav(TODAY)

    expect(screen.getByRole("button", { name: "Día siguiente" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Día anterior" })).toBeEnabled()
  })

  // SDD: 026 REQ-002 AC-002.4
  it("en otro día muestra «Hoy» y «Día siguiente» habilitado", () => {
    renderNav("2026-10-20")

    expect(screen.getByRole("button", { name: "Hoy" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Día siguiente" })).toBeEnabled()
  })

  // SDD: 026 REQ-002 AC-002.5
  it("en el límite de 365 días atrás, «Día anterior» está deshabilitado", () => {
    renderNav("2025-10-26")

    expect(screen.getByRole("button", { name: "Día anterior" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Día siguiente" })).toBeEnabled()
  })

  // SDD: 026 REQ-002 AC-002.5
  it("un día antes del límite, «Día anterior» sigue habilitado", () => {
    renderNav("2025-10-27")

    expect(screen.getByRole("button", { name: "Día anterior" })).toBeEnabled()
  })

  // SDD: 026 REQ-002 AC-002.1
  it("«Día anterior» pide el día de antes", async () => {
    const user = userEvent.setup()
    const onChange = renderNav(TODAY)

    await user.click(screen.getByRole("button", { name: "Día anterior" }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("2026-10-25")
  })

  // SDD: 026 REQ-002 AC-002.2
  it("«Día siguiente» pide el día de después", async () => {
    const user = userEvent.setup()
    const onChange = renderNav("2026-10-25")

    await user.click(screen.getByRole("button", { name: "Día siguiente" }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(TODAY)
  })

  // SDD: 026 REQ-002 AC-002.1
  it("«Día anterior» cruza el cambio de mes y de año", async () => {
    const user = userEvent.setup()
    const onChange = renderNav("2026-01-01")

    await user.click(screen.getByRole("button", { name: "Día anterior" }))

    expect(onChange).toHaveBeenCalledWith("2025-12-31")
  })

  // SDD: 026 REQ-002 AC-002.4
  it("«Hoy» pide el día de hoy", async () => {
    const user = userEvent.setup()
    const onChange = renderNav("2026-10-20")

    await user.click(screen.getByRole("button", { name: "Hoy" }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(TODAY)
  })

  // SDD: 026 REQ-002 AC-002.6
  it("el selector de fecha muestra el día, limita con min y max y no deja salir del intervalo", () => {
    renderNav("2026-10-20")

    const picker = screen.getByLabelText("Elegir día")
    expect(picker).toHaveAttribute("type", "date")
    expect(picker).toHaveValue("2026-10-20")
    expect(picker).toHaveAttribute("min", "2025-10-26")
    expect(picker).toHaveAttribute("max", "2026-10-26")
  })

  // SDD: 026 REQ-002 AC-002.6
  it("elegir 2026-03-10 en el selector llama a onChange con esa fecha", () => {
    const onChange = renderNav(TODAY)

    fireEvent.change(screen.getByLabelText("Elegir día"), { target: { value: "2026-03-10" } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("2026-03-10")
  })

  // SDD: 026 REQ-002 AC-002.6
  it.each(["2025-10-25", "2026-10-27", ""])(
    "un valor fuera del intervalo o vacío («%s») no llama a onChange",
    (value) => {
      const onChange = renderNav("2026-10-20")

      fireEvent.change(screen.getByLabelText("Elegir día"), { target: { value } })

      expect(onChange).not.toHaveBeenCalled()
    }
  )

  // SDD: 026 NFR-001 AC-N001.1
  it("los controles tienen nombre accesible: «Día anterior», «Día siguiente», «Hoy» y «Elegir día»", () => {
    renderNav("2026-10-20")

    for (const name of ["Día anterior", "Día siguiente", "Hoy"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
    expect(screen.getByLabelText("Elegir día")).toBeInTheDocument()
  })
})
