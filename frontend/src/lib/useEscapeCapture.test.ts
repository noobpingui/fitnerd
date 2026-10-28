// useEscapeCapture (spec 028, iteración 2, REQ-017): mientras está activo, Escape se
// atiende en `window` en fase de captura, antes que el listener de Radix en `document`,
// y no sigue su camino. Inactivo o desmontado, no hace nada.
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, renderHook } from "@testing-library/react"
import { useEscapeCapture } from "./useEscapeCapture"

// Hace de listener de Radix (`DismissableLayer`): captura en `document`.
const documentListener = vi.fn()

function listenOnDocument() {
  documentListener.mockReset()
  document.addEventListener("keydown", documentListener, true)
}

afterEach(() => {
  document.removeEventListener("keydown", documentListener, true)
})

describe("useEscapeCapture", () => {
  // SDD: 028 REQ-017 AC-017.5
  it("activo, Escape llama a onEscape, marca defaultPrevented y no llega a document", () => {
    listenOnDocument()
    const onEscape = vi.fn()
    renderHook(() => useEscapeCapture(onEscape, true))

    const notPrevented = fireEvent.keyDown(document.body, { key: "Escape" })

    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(notPrevented).toBe(false)
    expect(documentListener).not.toHaveBeenCalled()
  })

  // SDD: 028 REQ-017 AC-017.6
  it("activo, otras teclas pasan sin llamar a onEscape", () => {
    listenOnDocument()
    const onEscape = vi.fn()
    renderHook(() => useEscapeCapture(onEscape, true))

    const notPrevented = fireEvent.keyDown(document.body, { key: "Enter" })

    expect(notPrevented).toBe(true)
    expect(documentListener).toHaveBeenCalledTimes(1)
    // Contraste: Escape sí se atiende con el mismo hook.
    fireEvent.keyDown(document.body, { key: "Escape" })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  // SDD: 028 REQ-017 AC-017.5
  it("inactivo no hace nada y deja pasar Escape; al activarse lo atiende", () => {
    listenOnDocument()
    const onEscape = vi.fn()
    const { rerender } = renderHook(({ active }) => useEscapeCapture(onEscape, active), {
      initialProps: { active: false },
    })

    const notPrevented = fireEvent.keyDown(document.body, { key: "Escape" })
    expect(notPrevented).toBe(true)
    expect(onEscape).not.toHaveBeenCalled()
    expect(documentListener).toHaveBeenCalledTimes(1)

    rerender({ active: true })
    fireEvent.keyDown(document.body, { key: "Escape" })
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(documentListener).toHaveBeenCalledTimes(1)
  })

  // SDD: 028 REQ-017 AC-017.5
  it("al desmontarse deja de atender Escape y este vuelve a llegar a document", () => {
    listenOnDocument()
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useEscapeCapture(onEscape, true))
    fireEvent.keyDown(document.body, { key: "Escape" })
    expect(onEscape).toHaveBeenCalledTimes(1)

    unmount()
    const notPrevented = fireEvent.keyDown(document.body, { key: "Escape" })

    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(notPrevented).toBe(true)
    expect(documentListener).toHaveBeenCalledTimes(1)
  })

  // SDD: 028 REQ-017 AC-017.5
  it("llama siempre a la última función recibida", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onEscape }) => useEscapeCapture(onEscape, true), {
      initialProps: { onEscape: first },
    })

    rerender({ onEscape: second })
    fireEvent.keyDown(document.body, { key: "Escape" })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
