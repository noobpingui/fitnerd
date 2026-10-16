// Test del diálogo "Registrar medición" de Métricas (spec 016). La red se
// simula en api.ts (vi.mock). "Hoy" se fija en el lunes 12 de octubre de 2026
// falseando solo Date, para que waitFor y userEvent sigan funcionando.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createBodyMetric } from "@/features/body-metrics/api"
import { formatDate } from "@/features/body-metrics/dateUtils"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { WeightUnit } from "@/features/onboarding/types"
import { RegisterMetricDialog } from "./RegisterMetricDialog"

vi.mock("@/features/body-metrics/api", () => ({
  listBodyMetrics: vi.fn(),
  createBodyMetric: vi.fn(),
  updateBodyMetric: vi.fn(),
  deleteBodyMetric: vi.fn(),
  analyzeBodyMetrics: vi.fn(),
}))
vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const createMock = vi.mocked(createBodyMetric)

type User = ReturnType<typeof userEvent.setup>

const HELP =
  "Si la fecha es anterior a tu última medición de peso, el peso de tu perfil no cambia."
const SAVE_ERROR = "No se pudo guardar la medición. Inténtalo de nuevo."

function metric(recorded_at: string): BodyMetric {
  return {
    id: recorded_at,
    weight: 80,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

function renderDialog(
  props: { metrics?: BodyMetric[]; weightUnit?: WeightUnit } = {}
) {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RegisterMetricDialog
        metrics={props.metrics ?? []}
        weightUnit={props.weightUnit ?? "kg"}
        onClose={onClose}
      />
    </QueryClientProvider>
  )
  return { onClose }
}

const saveButton = () => screen.getByRole("button", { name: /^Guardar|^Guardando/ })
const setDate = (value: string) =>
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value } })

async function type(user: User, label: string, text: string) {
  await user.type(screen.getByLabelText(label), text)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  createMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("RegisterMetricDialog - contenido inicial", () => {
  // SDD: 016 REQ-001 AC-001.3
  it("muestra el título, la fecha de hoy, los demás campos vacíos y los botones", () => {
    renderDialog({ weightUnit: "kg" })

    expect(
      screen.getByRole("dialog", { name: "Registrar medición" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-10-12")
    expect(screen.getByLabelText("Peso (kg)")).toHaveValue(null)
    expect(screen.getByLabelText("% Grasa corporal")).toHaveValue(null)
    expect(screen.getByLabelText("% Masa muscular")).toHaveValue(null)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
  })

  // SDD: 016 REQ-001 AC-001.4
  it("con un perfil en lb el campo de peso se llama 'Peso (lb)'", () => {
    renderDialog({ weightUnit: "lb" })

    expect(screen.getByLabelText("Peso (lb)")).toBeInTheDocument()
    expect(screen.queryByLabelText("Peso (kg)")).not.toBeInTheDocument()
  })

  // SDD: 016 REQ-001 AC-001.6
  it("muestra el texto de ayuda sobre el peso del perfil", () => {
    renderDialog()

    expect(screen.getByText(HELP)).toBeInTheDocument()
  })

  // SDD: 016 REQ-001 AC-001.5
  it("'Cancelar' cierra sin enviar nada al servidor", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await type(user, "Peso (kg)", "80")

    await user.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe("RegisterMetricDialog - validación", () => {
  // SDD: 016 REQ-002 AC-002.1
  it("con una fecha futura muestra el error y deshabilita 'Guardar'", async () => {
    const user = userEvent.setup()
    renderDialog()
    await type(user, "Peso (kg)", "80")

    setDate("2026-10-13")

    expect(await screen.findByText("La fecha no puede ser futura")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.2
  it("con una fecha de más de un año muestra el error y deshabilita 'Guardar'", async () => {
    const user = userEvent.setup()
    renderDialog()
    await type(user, "Peso (kg)", "80")

    setDate("2025-10-11")

    expect(
      await screen.findByText("Solo puedes registrar mediciones del último año")
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.3
  it("acepta hoy menos 365 días y hoy, sin errores de fecha", async () => {
    const user = userEvent.setup()
    renderDialog()
    await type(user, "Peso (kg)", "80")

    setDate("2025-10-12")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.queryByText("La fecha no puede ser futura")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Solo puedes registrar mediciones del último año")
    ).not.toBeInTheDocument()

    setDate("2026-10-12")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.queryByText("Elige una fecha")).not.toBeInTheDocument()
  })

  // SDD: 016 REQ-002 AC-002.4
  it("al borrar la fecha pide elegir una y deshabilita 'Guardar'", async () => {
    const user = userEvent.setup()
    renderDialog()
    await type(user, "Peso (kg)", "80")

    setDate("")

    expect(await screen.findByText("Elige una fecha")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.5
  it("con los tres valores vacíos pide registrar al menos uno", async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.getByText("Registra al menos un valor")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    await type(user, "Peso (kg)", "80")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.queryByText("Registra al menos un valor")).not.toBeInTheDocument()
  })

  // SDD: 016 REQ-002 AC-002.6
  it("un peso de 301 kg muestra 'Entre 30 y 300 kg' y deshabilita 'Guardar'", async () => {
    const user = userEvent.setup()
    renderDialog({ weightUnit: "kg" })

    await type(user, "Peso (kg)", "301")

    expect(await screen.findByText("Entre 30 y 300 kg")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.6
  it("un peso de 661 lb muestra 'Entre 66 y 660 lb'", async () => {
    const user = userEvent.setup()
    renderDialog({ weightUnit: "lb" })

    await type(user, "Peso (lb)", "661")

    expect(await screen.findByText("Entre 66 y 660 lb")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.6
  it("una grasa de 61 muestra 'Entre 3 y 60 %'", async () => {
    const user = userEvent.setup()
    renderDialog()

    await type(user, "% Grasa corporal", "61")

    expect(await screen.findByText("Entre 3 y 60 %")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.6
  it("una masa muscular de 71 muestra 'Entre 10 y 70 %'", async () => {
    const user = userEvent.setup()
    renderDialog()

    await type(user, "% Masa muscular", "71")

    expect(await screen.findByText("Entre 10 y 70 %")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // SDD: 016 REQ-002 AC-002.7
  it("el campo 'Fecha' limita el rango entre hoy menos 365 días y hoy", () => {
    renderDialog()

    const date = screen.getByLabelText("Fecha")
    expect(date).toHaveAttribute("type", "date")
    expect(date).toHaveAttribute("min", "2025-10-12")
    expect(date).toHaveAttribute("max", "2026-10-12")
  })
})

describe("RegisterMetricDialog - guardado", () => {
  // SDD: 016 REQ-003 AC-003.1
  it("envía la fecha, el peso y la grasa, sin masa muscular", async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValue(metric("2026-10-05"))
    const { onClose } = renderDialog({ weightUnit: "kg" })
    setDate("2026-10-05")
    await type(user, "Peso (kg)", "80")
    await type(user, "% Grasa corporal", "20")

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    const payload = (createMock.mock.calls as unknown[][])[0][0]
    expect(payload).toEqual({
      recorded_at: "2026-10-05",
      weight: 80,
      body_fat_percentage: 20,
    })
    expect(payload).not.toHaveProperty("muscle_mass_percentage")
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  // SDD: 016 REQ-003 AC-003.2
  it("con un perfil en lb envía 160 lb como 72.6 kg", async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValue(metric("2026-10-12"))
    renderDialog({ weightUnit: "lb" })
    await type(user, "Peso (lb)", "160")

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect((createMock.mock.calls as unknown[][])[0][0]).toMatchObject({
      recorded_at: "2026-10-12",
      weight: 72.6,
    })
  })

  // SDD: 016 REQ-003 AC-003.3
  it("con solo la grasa rellena no envía peso ni masa muscular", async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValue(metric("2026-10-12"))
    renderDialog()
    await type(user, "% Grasa corporal", "18")

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    const payload = (createMock.mock.calls as unknown[][])[0][0]
    expect(payload).toEqual({
      recorded_at: "2026-10-12",
      body_fat_percentage: 18,
    })
    expect(payload).not.toHaveProperty("weight")
    expect(payload).not.toHaveProperty("muscle_mass_percentage")
  })

  // SDD: 016 REQ-003 AC-003.5
  it("mientras guarda el botón dice 'Guardando…', está deshabilitado y no envía dos veces", async () => {
    const user = userEvent.setup()
    let resolve: (value: BodyMetric) => void = () => {}
    createMock.mockReturnValue(
      new Promise<BodyMetric>((done) => {
        resolve = done
      })
    )
    renderDialog()
    await type(user, "Peso (kg)", "80")

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    const pending = await screen.findByRole("button", { name: "Guardando…" })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(createMock).toHaveBeenCalledTimes(1)

    resolve(metric("2026-10-12"))
  })

  // SDD: 016 REQ-003 AC-003.6
  it("si falla, el diálogo sigue abierto con los valores y muestra el error", async () => {
    const user = userEvent.setup()
    createMock.mockRejectedValue(new Error("boom"))
    const { onClose } = renderDialog()
    await type(user, "Peso (kg)", "80")

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Peso (kg)")).toHaveValue(80)
    expect(screen.getByRole("dialog", { name: "Registrar medición" })).toBeInTheDocument()
  })
})

describe("RegisterMetricDialog - aviso de fecha con medición", () => {
  const METRICS = [metric("2026-10-05")]
  const notice = (iso: string) =>
    `Ya tienes una medición del ${formatDate(iso)}. Los valores que escribas sustituirán a los de ese día; los campos vacíos se conservan.`

  // SDD: 016 REQ-004 AC-004.1
  it("al elegir una fecha con medición muestra el aviso con esa fecha", async () => {
    renderDialog({ metrics: METRICS })

    setDate("2026-10-05")

    expect(await screen.findByText(notice("2026-10-05"))).toBeInTheDocument()
  })

  // SDD: 016 REQ-004 AC-004.2
  it("al elegir una fecha sin medición no muestra el aviso", async () => {
    renderDialog({ metrics: METRICS })

    setDate("2026-10-06")

    await waitFor(() =>
      expect(screen.getByLabelText("Fecha")).toHaveValue("2026-10-06")
    )
    expect(screen.queryByText(/Ya tienes una medición del/)).not.toBeInTheDocument()
  })

  // SDD: 016 REQ-004 AC-004.3
  it("el aviso no bloquea: 'Guardar' sigue habilitado con datos válidos", async () => {
    const user = userEvent.setup()
    renderDialog({ metrics: METRICS })
    await type(user, "Peso (kg)", "80")

    setDate("2026-10-05")

    expect(await screen.findByText(notice("2026-10-05"))).toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })
})

describe("RegisterMetricDialog - accesibilidad", () => {
  // SDD: 016 NFR-002 AC-N002.1
  it("es un diálogo con nombre accesible y los campos se encuentran por su etiqueta", () => {
    renderDialog()

    expect(
      screen.getByRole("dialog", { name: "Registrar medición" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Fecha")).toBeInTheDocument()
    expect(screen.getByLabelText("Peso (kg)")).toBeInTheDocument()
    expect(screen.getByLabelText("% Grasa corporal")).toBeInTheDocument()
    expect(screen.getByLabelText("% Masa muscular")).toBeInTheDocument()
  })

  // SDD: 016 NFR-002 AC-N002.1
  it.each([
    ["Peso (kg)", "301", "Entre 30 y 300 kg"],
    ["% Grasa corporal", "61", "Entre 3 y 60 %"],
    ["% Masa muscular", "71", "Entre 10 y 70 %"],
  ])("el error de '%s' queda enlazado a su campo con aria-describedby", async (label, value, message) => {
    const user = userEvent.setup()
    renderDialog()

    await type(user, label, value)

    await screen.findByText(message)
    const input = screen.getByLabelText(label)
    expect(input).toHaveAttribute("aria-describedby")
    expect(input).toHaveAccessibleDescription(message)
  })

  // SDD: 016 NFR-002 AC-N002.1
  it("el error de fecha queda enlazado al campo 'Fecha'", async () => {
    renderDialog()

    setDate("2026-10-13")

    await screen.findByText("La fecha no puede ser futura")
    expect(screen.getByLabelText("Fecha")).toHaveAccessibleDescription(
      "La fecha no puede ser futura"
    )
  })

  // SDD: 016 NFR-002 AC-N002.1
  it("'Registra al menos un valor' queda enlazado a los campos de valores", async () => {
    renderDialog()

    await screen.findByText("Registra al menos un valor")
    for (const label of ["Peso (kg)", "% Grasa corporal", "% Masa muscular"]) {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(
        /Registra al menos un valor/
      )
    }
  })

  // SDD: 016 NFR-002 AC-N002.2
  it("el error de guardado tiene el rol 'alert'", async () => {
    const user = userEvent.setup()
    createMock.mockRejectedValue(new Error("boom"))
    renderDialog()
    await type(user, "Peso (kg)", "80")

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(SAVE_ERROR)
  })
})
