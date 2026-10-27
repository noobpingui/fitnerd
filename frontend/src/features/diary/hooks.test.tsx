// Hooks de tiempo y de «Deshacer» del diario (spec 026). La lógica de tiempo se
// prueba con `renderHook` y temporizadores falsos; la red se simula en el api.ts
// del diario. Con `setTimeout` falso, TanStack Query no vacía sus notificaciones,
// así que los tests de mutaciones usan los temporizadores reales (el aviso de
// 10 s nunca vence en ellos) y los de plazo no hacen ninguna petición.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { ApiError } from "@/lib/apiClient"
import { restoreMealItem } from "@/features/diary/api"
import { makeMeal } from "@/test/diaryFixtures"
import { useRemovalUndo, useToday } from "./hooks"
import type { Meal, RemovalUndo } from "./types"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
  analyzeMealPhoto: vi.fn(),
  restoreMealItem: vi.fn(),
  deleteMeal: vi.fn(),
}))

const restoreMock = vi.mocked(restoreMealItem)

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
}

const FAKE_ALL = ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] as const

beforeEach(() => {
  restoreMock.mockReset()
})

// ---------------------------------------------------------------------------
// useToday
// ---------------------------------------------------------------------------

describe("useToday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...FAKE_ALL] })
    vi.setSystemTime(new Date(2026, 9, 26, 23, 59, 30))
    setVisibility("visible")
  })

  afterEach(() => {
    vi.useRealTimers()
    setVisibility("visible")
  })

  // SDD: 026 REQ-005 AC-005.1
  it("empieza en la fecha local de hoy", () => {
    const { result } = renderHook(() => useToday())

    expect(result.current).toBe("2026-10-26")
  })

  // SDD: 026 REQ-005 AC-005.1
  it("pasa al día nuevo como mucho un minuto después de la medianoche", () => {
    const { result } = renderHook(() => useToday())

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current).toBe("2026-10-27")
  })

  // SDD: 026 REQ-005 AC-005.1
  it("no cambia mientras sigue siendo el mismo día", () => {
    vi.setSystemTime(new Date(2026, 9, 26, 10, 0, 0))
    const { result } = renderHook(() => useToday())

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current).toBe("2026-10-26")
  })

  // SDD: 026 REQ-005 AC-005.1
  it("usa el intervalo recibido para comprobar la fecha", () => {
    const { result } = renderHook(() => useToday(false, 1_000))

    act(() => {
      vi.setSystemTime(new Date(2026, 9, 27, 0, 0, 0))
      vi.advanceTimersByTime(1_000)
    })

    expect(result.current).toBe("2026-10-27")
  })

  // SDD: 026 REQ-005 AC-005.2
  it("al volver la pestaña a estar visible comprueba la fecha sin esperar al intervalo", () => {
    vi.setSystemTime(new Date(2026, 9, 26, 22, 0, 0))
    const { result } = renderHook(() => useToday())
    setVisibility("hidden")
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0, 0))

    act(() => {
      setVisibility("visible")
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(result.current).toBe("2026-10-27")
  })

  // SDD: 026 REQ-005 AC-005.4
  it("en pausa no cambia aunque pase la medianoche", () => {
    const { result } = renderHook(() => useToday(true))

    act(() => {
      vi.advanceTimersByTime(120_000)
    })

    expect(result.current).toBe("2026-10-26")
  })

  // SDD: 026 REQ-005 AC-005.4
  it("en pausa tampoco cambia con visibilitychange", () => {
    const { result } = renderHook(() => useToday(true))
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0, 0))

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(result.current).toBe("2026-10-26")
  })

  // SDD: 026 REQ-005 AC-005.4
  it("al quitar la pausa cambia en el acto si la fecha ya cambió", () => {
    const { result, rerender } = renderHook(({ paused }) => useToday(paused), {
      initialProps: { paused: true },
    })
    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(result.current).toBe("2026-10-26")

    rerender({ paused: false })

    expect(result.current).toBe("2026-10-27")
  })

  // SDD: 026 REQ-005 AC-005.1
  it("al desmontar deja de comprobar la fecha", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval")
    const { unmount } = renderHook(() => useToday())

    unmount()

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// useRemovalUndo: plazo del aviso
// ---------------------------------------------------------------------------

const PLATANO: RemovalUndo = { token: "tok-platano", name: "Plátano", mealType: "breakfast" }
const LECHE: RemovalUndo = { token: "tok-leche", name: "Leche entera", mealType: "breakfast" }

describe("useRemovalUndo - plazo del aviso", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...FAKE_ALL] })
    vi.setSystemTime(new Date(2026, 9, 26, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 026 REQ-007 AC-007.6
  it("empieza sin aviso", () => {
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })

    expect(result.current.notice).toBeNull()
    expect(result.current.isRestoring).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // SDD: 026 REQ-007 AC-007.6
  it("el aviso desaparece a los 10 segundos y no antes", () => {
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })

    act(() => result.current.offer(PLATANO))
    expect(result.current.notice).toEqual(PLATANO)
    act(() => {
      vi.advanceTimersByTime(9_999)
    })
    expect(result.current.notice).toEqual(PLATANO)
    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current.notice).toBeNull()
    expect(restoreMock).not.toHaveBeenCalled()
  })

  // SDD: 026 REQ-007 AC-007.6
  it("usa la duración recibida", () => {
    const { result } = renderHook(() => useRemovalUndo("2026-10-26", 500), {
      wrapper: wrapper(),
    })

    act(() => result.current.offer(PLATANO))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.notice).toBeNull()
  })

  // SDD: 026 REQ-007 AC-007.7
  it("un aviso nuevo sustituye al anterior y reinicia el plazo", () => {
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })

    act(() => result.current.offer(PLATANO))
    act(() => {
      vi.advanceTimersByTime(8_000)
    })
    act(() => result.current.offer(LECHE))
    expect(result.current.notice).toEqual(LECHE)
    act(() => {
      vi.advanceTimersByTime(8_000)
    })

    expect(result.current.notice).toEqual(LECHE)
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current.notice).toBeNull()
  })

  // SDD: 026 REQ-007 AC-007.7
  it("ofrecer `null` retira el aviso", () => {
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))

    act(() => result.current.offer(null))

    expect(result.current.notice).toBeNull()
  })

  // SDD: 026 REQ-007 AC-007.8
  it("al desmontar limpia el temporizador", () => {
    const { result, unmount } = renderHook(() => useRemovalUndo("2026-10-26"), {
      wrapper: wrapper(),
    })
    act(() => result.current.offer(PLATANO))

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  // SDD: 026 REQ-007 AC-007.6
  it("«undo» sin aviso no hace ninguna petición", () => {
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })

    act(() => result.current.undo())

    expect(restoreMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// useRemovalUndo: restaurar
// ---------------------------------------------------------------------------

describe("useRemovalUndo - restaurar", () => {
  beforeEach(() => {
    restoreMock.mockReset()
  })

  // SDD: 026 REQ-007 AC-007.3
  it("«undo» pide restaurar con el token del aviso y, con éxito, retira el aviso", async () => {
    restoreMock.mockResolvedValue(makeMeal() as Meal)
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))

    act(() => result.current.undo())

    await waitFor(() => expect(result.current.notice).toBeNull())
    expect(restoreMock).toHaveBeenCalledTimes(1)
    expect(restoreMock).toHaveBeenCalledWith("tok-platano")
    expect(result.current.error).toBeNull()
    expect(result.current.isRestoring).toBe(false)
  })

  // SDD: 026 REQ-007 AC-007.9
  it("un error de red deja el aviso y muestra «No se pudo deshacer. Vuelve a intentarlo.»", async () => {
    restoreMock.mockRejectedValue(new TypeError("Failed to fetch"))
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))

    act(() => result.current.undo())

    await waitFor(() =>
      expect(result.current.error).toBe("No se pudo deshacer. Vuelve a intentarlo.")
    )
    expect(result.current.notice).toEqual(PLATANO)
    expect(result.current.isRestoring).toBe(false)
  })

  // SDD: 026 REQ-007 AC-007.9
  it("un error del servidor (500) también muestra el mensaje genérico", async () => {
    restoreMock.mockRejectedValue(new ApiError(500, "boom"))
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))

    act(() => result.current.undo())

    await waitFor(() =>
      expect(result.current.error).toBe("No se pudo deshacer. Vuelve a intentarlo.")
    )
    expect(result.current.notice).toEqual(PLATANO)
  })

  // SDD: 026 REQ-007 AC-007.9
  it("tras un error se puede volver a pulsar «Deshacer» y, si funciona, desaparece el error", async () => {
    restoreMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    restoreMock.mockResolvedValueOnce(makeMeal() as Meal)
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))
    act(() => result.current.undo())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    act(() => result.current.undo())

    await waitFor(() => expect(result.current.notice).toBeNull())
    expect(restoreMock).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })

  // SDD: 026 REQ-007 AC-007.10
  it("un 400 muestra el mensaje del servidor «Una comida no puede tener más de 50 alimentos.»", async () => {
    restoreMock.mockRejectedValue(
      new ApiError(400, "Una comida no puede tener más de 50 alimentos.")
    )
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))

    act(() => result.current.undo())

    await waitFor(() =>
      expect(result.current.error).toBe("Una comida no puede tener más de 50 alimentos.")
    )
    expect(result.current.notice).toEqual(PLATANO)
  })

  // SDD: 026 REQ-007 AC-007.7
  it("un aviso nuevo borra el error del anterior", async () => {
    restoreMock.mockRejectedValue(new TypeError("Failed to fetch"))
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))
    act(() => result.current.undo())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    act(() => result.current.offer(LECHE))

    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.notice).toEqual(LECHE)
  })

  // SDD: 026 REQ-007 AC-007.11
  it("con una restauración en curso, un segundo «undo» no envía otra petición", async () => {
    const pending = deferred<Meal>()
    restoreMock.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useRemovalUndo("2026-10-26"), { wrapper: wrapper() })
    act(() => result.current.offer(PLATANO))

    act(() => result.current.undo())
    await waitFor(() => expect(result.current.isRestoring).toBe(true))
    act(() => result.current.undo())

    expect(restoreMock).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve(makeMeal() as Meal))
    await waitFor(() => expect(result.current.notice).toBeNull())
    expect(restoreMock).toHaveBeenCalledTimes(1)
  })
})
