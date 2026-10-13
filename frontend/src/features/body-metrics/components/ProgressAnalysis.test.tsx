// Test de "Análisis del coach" (spec 010, REQ-007 y REQ-009): el botón envía la
// petición recibida por prop, y el bloque de sugerencia aparece solo si el
// servidor devuelve una. La red se simula en api.ts (vi.mock).
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { analyzeBodyMetrics } from "@/features/body-metrics/api"
import { ApiError } from "@/lib/apiClient"
import { ProgressAnalysis } from "./ProgressAnalysis"

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

const analyzeMock = vi.mocked(analyzeBodyMetrics)

// Primer argumento de la primera llamada (la firma real con `request` la crea
// el implementer; el cast evita depender de ella para compilar).
const firstArg = () => (analyzeMock.mock.calls as unknown[][])[0][0]

// El componente recibe `request` por prop (plan §3.4); se tipa aquí para que
// el archivo compile antes de que la prop exista.
const Analysis = ProgressAnalysis as unknown as (props: {
  request: unknown
}) => React.JSX.Element

const BUTTON = "Pídele al IA Coach que analice tu progreso"
const TITLE = "Ajuste de calorías sugerido"
const NO_PROFILE = "Completa tu perfil para poder generar un análisis."
const REQUEST = { today: "2026-10-12", marker: "cuerpo-de-prueba" }

const ADJUST = {
  kind: "adjust",
  target_kcal: 2200,
  suggested_kcal: 1750,
  adjustment_kcal: -450,
  floor_kcal: 1500,
}

function resolveWith(calorie_suggestion: unknown) {
  analyzeMock.mockResolvedValueOnce({
    analysis: "Tu progreso va más lento que tu meta.",
    calorie_suggestion,
  } as never)
}

function renderAnalysis(request: unknown = REQUEST) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Analysis request={request} />
    </QueryClientProvider>
  )
}

async function clickAnalyze(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: BUTTON }))
}

beforeEach(() => {
  analyzeMock.mockReset()
})

describe("ProgressAnalysis", () => {
  // SDD: REQ-007 AC-007.1
  it("muestra el texto del análisis y el bloque cuando hay sugerencia", async () => {
    const user = userEvent.setup()
    resolveWith(ADJUST)
    renderAnalysis()

    await clickAnalyze(user)

    expect(
      await screen.findByText("Tu progreso va más lento que tu meta.")
    ).toBeInTheDocument()
    expect(screen.getByText(TITLE)).toBeInTheDocument()
    expect(screen.getByText(/2200 kcal → 1750 kcal al día/)).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.6
  it("sin sugerencia muestra el texto y no el bloque", async () => {
    const user = userEvent.setup()
    // Primero una respuesta con sugerencia: el bloque debe aparecer.
    resolveWith(ADJUST)
    resolveWith(null)
    renderAnalysis()

    await clickAnalyze(user)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()

    // Segunda respuesta sin sugerencia: el texto se muestra y el bloque se va.
    await clickAnalyze(user)

    await waitFor(() =>
      expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    )
    expect(
      screen.getByText("Tu progreso va más lento que tu meta.")
    ).toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.7
  it("un error 503 muestra el mensaje y no el bloque", async () => {
    const user = userEvent.setup()
    resolveWith(ADJUST)
    analyzeMock.mockRejectedValueOnce(
      new ApiError(503, "No se pudo generar el analisis en este momento.")
    )
    renderAnalysis()

    await clickAnalyze(user)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()

    await clickAnalyze(user)

    expect(
      await screen.findByText(/No se pudo generar el analisis en este momento\./)
    ).toBeInTheDocument()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.7
  it("el límite alcanzado (429) muestra el mensaje y no el bloque", async () => {
    const user = userEvent.setup()
    const message =
      "Alcanzaste el límite de 2 análisis cada 24 horas. Vuelve a intentarlo más tarde."
    resolveWith(ADJUST)
    analyzeMock.mockRejectedValueOnce(new ApiError(429, message))
    renderAnalysis()

    await clickAnalyze(user)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()

    await clickAnalyze(user)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.7
  it("si un segundo análisis falla, el bloque anterior desaparece", async () => {
    const user = userEvent.setup()
    resolveWith(ADJUST)
    analyzeMock.mockRejectedValueOnce(new ApiError(503, "Fallo del proveedor."))
    renderAnalysis()

    await clickAnalyze(user)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()

    await clickAnalyze(user)

    expect(await screen.findByText(/Fallo del proveedor\./)).toBeInTheDocument()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.4
  it("el 409 sin perfil muestra el mensaje como aviso neutro y no el bloque", async () => {
    const user = userEvent.setup()
    analyzeMock.mockRejectedValueOnce(new ApiError(409, NO_PROFILE))
    renderAnalysis(null)

    await clickAnalyze(user)

    // Coincidencia exacta: sin el prefijo "Error (409):" de los fallos técnicos.
    expect(await screen.findByText(NO_PROFILE)).toBeInTheDocument()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  // SDD: REQ-007 AC-007.1
  it("envía la petición recibida por prop al pulsar el botón", async () => {
    const user = userEvent.setup()
    resolveWith(null)
    renderAnalysis()

    await clickAnalyze(user)
    await screen.findByText("Tu progreso va más lento que tu meta.")

    expect(analyzeMock).toHaveBeenCalledTimes(1)
    expect(firstArg()).toEqual(REQUEST)
  })

  // SDD: REQ-009 AC-009.4
  it("sin perfil envía null", async () => {
    const user = userEvent.setup()
    resolveWith(null)
    renderAnalysis(null)

    await clickAnalyze(user)
    await screen.findByText("Tu progreso va más lento que tu meta.")

    expect(firstArg()).toBeNull()
  })
})
