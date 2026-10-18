// Test de RouteSuspense (spec 017): aviso de carga y aviso de error de descarga.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentType } from "react"
import { lazyNamed } from "@/app/lazyNamed"
import { RouteSuspense } from "@/app/RouteSuspense"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const Screen = () => <p>Pantalla cargada</p>

describe("RouteSuspense", () => {
  beforeEach(() => {
    // React registra con console.error el error que captura el boundary.
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // SDD: 017 REQ-002 AC-002.1
  it("muestra Cargando… mientras se descarga y luego la pantalla", async () => {
    const gate = deferred<{ Screen: ComponentType }>()
    const Lazy = lazyNamed(() => gate.promise, "Screen")

    render(
      <RouteSuspense>
        <Lazy />
      </RouteSuspense>
    )

    expect(screen.getByText("Cargando…")).toBeInTheDocument()
    expect(screen.queryByText("Pantalla cargada")).not.toBeInTheDocument()

    await act(async () => {
      gate.resolve({ Screen })
    })

    expect(await screen.findByText("Pantalla cargada")).toBeInTheDocument()
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument()
  })

  // SDD: 017 REQ-003 AC-003.1
  it("si la descarga falla muestra el error y el botón Recargar, sin Cargando…", async () => {
    const Lazy = lazyNamed(
      () => Promise.reject(new Error("fallo de red")),
      "Screen" as const
    )

    render(
      <RouteSuspense onReload={() => {}}>
        <Lazy />
      </RouteSuspense>
    )

    expect(
      await screen.findByText("No se pudo cargar la página.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Recargar" })).toBeInTheDocument()
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument()
  })

  // SDD: 017 REQ-003 AC-003.2
  it("al pulsar Recargar llama al onReload recibido", async () => {
    const onReload = vi.fn()
    const Lazy = lazyNamed(
      () => Promise.reject(new Error("fallo de red")),
      "Screen" as const
    )
    const user = userEvent.setup()

    render(
      <RouteSuspense onReload={onReload}>
        <Lazy />
      </RouteSuspense>
    )
    await user.click(await screen.findByRole("button", { name: "Recargar" }))

    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
