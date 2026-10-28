// useDebouncedValue (spec 028, REQ-013): el valor se actualiza un tiempo
// después del último cambio y `flush` lo aplica en el momento (Intro).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useDebouncedValue } from "./useDebouncedValue"

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 028 REQ-013 AC-013.1
  it("devuelve el valor inicial en el acto, sin esperar", () => {
    const { result } = renderHook(() => useDebouncedValue("arroz", 300))

    expect(result.current[0]).toBe("arroz")
  })

  // SDD: 028 REQ-013 AC-013.1
  it("un cambio se aplica al cumplirse el retardo y no antes", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    })

    rerender({ value: "arroz" })
    advance(299)
    expect(result.current[0]).toBe("a")

    advance(1)
    expect(result.current[0]).toBe("arroz")
  })

  // SDD: 028 REQ-013 AC-013.2
  it("cada cambio reinicia la espera: solo cuenta la última tecla", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    })

    rerender({ value: "a" })
    advance(200)
    rerender({ value: "ar" })
    advance(200)
    rerender({ value: "arr" })
    advance(299)
    expect(result.current[0]).toBe("")

    advance(1)
    expect(result.current[0]).toBe("arr")
  })

  // SDD: 028 REQ-013 AC-013.2
  it("los valores intermedios nunca llegan a ser el valor devuelto", () => {
    const seen: string[] = []
    const { rerender } = renderHook(
      ({ value }) => {
        const [debounced] = useDebouncedValue(value, 300)
        seen.push(debounced)
        return debounced
      },
      { initialProps: { value: "" } }
    )

    rerender({ value: "a" })
    advance(100)
    rerender({ value: "ar" })
    advance(100)
    rerender({ value: "arr" })
    advance(300)

    expect(seen).not.toContain("a")
    expect(seen).not.toContain("ar")
    expect(seen).toContain("arr")
  })

  // SDD: 028 REQ-013 AC-013.6
  it("`flush` aplica el valor en el momento, sin esperar el retardo", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    })
    rerender({ value: "arroz" })
    expect(result.current[0]).toBe("")

    act(() => {
      result.current[1]("arroz")
    })

    expect(result.current[0]).toBe("arroz")
  })

  // SDD: 028 REQ-013 AC-013.6
  it("tras `flush`, al cumplirse el retardo el valor sigue siendo el mismo", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    })
    rerender({ value: "arroz" })
    act(() => {
      result.current[1]("arroz")
    })

    advance(1000)

    expect(result.current[0]).toBe("arroz")
  })

  // SDD: 028 REQ-013 AC-013.6
  it("el valor tras `flush` no vuelve atrás por un cambio anterior que estaba pendiente", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    })
    rerender({ value: "arr" })
    advance(100)
    rerender({ value: "arroz" })
    act(() => {
      result.current[1]("arroz")
    })

    advance(400)

    expect(result.current[0]).toBe("arroz")
  })

  // SDD: 028 REQ-013 AC-013.1
  it("tras `flush`, un cambio nuevo vuelve a esperar el retardo", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "arroz" },
    })
    act(() => {
      result.current[1]("arroz")
    })

    rerender({ value: "pollo" })
    advance(299)
    expect(result.current[0]).toBe("arroz")

    advance(1)
    expect(result.current[0]).toBe("pollo")
  })

  // SDD: 028 REQ-013 AC-013.1
  it("sirve para cualquier tipo de valor", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 50), {
      initialProps: { value: 1 },
    })

    rerender({ value: 2 })
    advance(50)

    expect(result.current[0]).toBe(2)
  })
})
