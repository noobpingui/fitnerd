// Test del diálogo «Añadir a {sección} con una foto» (spec 025): elegir y
// validar la foto, análisis, revisión de la propuesta, guardado y accesibilidad.
// La red se simula en los api.ts del diario y del catálogo, y el navegador
// (decodificar, canvas y URLs blob:) con FakePhotoProcessor, inyectado por prop.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/apiClient"
import { addMealItems, analyzeMealPhoto, getDiary } from "@/features/diary/api"
import { searchCatalog } from "@/features/catalog/api"
import { CHICKEN, RICE, TOMATO_SAUCE, makeAnalysis } from "@/test/analysisFixtures"
import { makeCatalogFood } from "@/test/catalogFixtures"
import { makeMeal } from "@/test/diaryFixtures"
import { FakePhotoProcessor, makePhotoFile } from "@/test/photoFixtures"
import { useDiary } from "../hooks"
import type { Meal, MealPhotoAnalysis } from "../types"
import { MealPhotoDialog } from "./MealPhotoDialog"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
  analyzeMealPhoto: vi.fn(),
}))
vi.mock("@/features/catalog/api", () => ({
  searchCatalog: vi.fn(),
}))

const addMock = vi.mocked(addMealItems)
const analyzeMock = vi.mocked(analyzeMealPhoto)
const getDiaryMock = vi.mocked(getDiary)
const searchMock = vi.mocked(searchCatalog)

const MB = 1024 * 1024
const RICE_PREVIEW = "195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa"
const RICE_200_PREVIEW = "260 kcal · 5,4 g proteína · 56,3 g carbohidratos · 0,6 g grasa"
const TOTAL_3 = "Total: 360 kcal · 35,0 g proteína · 42,3 g carbohidratos · 4,0 g grasa"
const TOTAL_RICE = "Total: 195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa"
const GALLO_PREVIEW = "320 kcal · 11,0 g proteína · 54,0 g carbohidratos · 6,4 g grasa"
const SAVE_FAILED = "No se pudo guardar. Vuelve a intentarlo."
const BUSY_503 =
  "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."
const LIMIT_429 = "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."
const UNMATCHED_NOTICE =
  "Los alimentos sin coincidencia no se guardan: búscalos en el catálogo, créalos como personalizados o quítalos."
const NO_SAVABLE_NOTICE = "Añade al menos un alimento para guardar."
const SEARCH_HELP = "Busca un alimento para ver sus calorías y macros por 100 g."

const AGUACATE = makeCatalogFood({
  id: "aguacate",
  name: "Aguacate",
  per_100g: { calories_kcal: 160, protein_g: 2, carbs_g: 8.5, fat_g: 14.7 },
})
const TOMATE = makeCatalogFood({
  id: "tomate",
  name: "Tomate",
  per_100g: { calories_kcal: 18, protein_g: 0.88, carbs_g: 3.89, fat_g: 0.2 },
})
const PECHUGA = makeCatalogFood()

const RICE_CHICKEN_SAUCE = makeAnalysis({ items: [RICE, CHICKEN], unmatched: [TOMATO_SAUCE] })
const GALLO_UNMATCHED = { name: "Gallo pinto", grams: 200, confidence: "medium" as const }

type User = ReturnType<typeof userEvent.setup>

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Lee el diario del día para comprobar que se vuelve a leer tras guardar.
function DiaryProbe() {
  useDiary("2026-10-22")
  return null
}

// Label de la tarjeta con la que se montó el último diálogo; los ayudantes lo usan por defecto.
let currentLabel = "Almuerzo"

function renderDialog({
  processor = new FakePhotoProcessor(),
  mealType = "lunch" as const,
  label = "Almuerzo",
}: {
  processor?: FakePhotoProcessor
  mealType?: "lunch" | "dinner"
  label?: string
} = {}) {
  currentLabel = label
  const onClose = vi.fn()
  const onRegisterManually = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <DiaryProbe />
      <MealPhotoDialog
        mealType={mealType}
        label={label}
        date="2026-10-22"
        onClose={onClose}
        onRegisterManually={onRegisterManually}
        photoProcessor={processor}
      />
    </QueryClientProvider>
  )
  return { onClose, onRegisterManually, processor, view }
}

function dialog(label = currentLabel) {
  return screen.getByRole("dialog", { name: `Añadir a ${label} con una foto` })
}

function button(name: string) {
  return within(dialog()).getByRole("button", { name })
}

// El selector de archivos: el de «Elegir una foto» al inicio y cualquiera en el resto.
function fileInput(): HTMLInputElement {
  const root = dialog()
  const input =
    root.querySelector<HTMLInputElement>('input[type="file"][data-testid="meal-photo-file-input"]') ??
    root.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("No hay ningún selector de archivos en el diálogo")
  return input
}

async function pick(user: User, file: File) {
  await user.upload(fileInput(), file)
}

async function toPreview(user: User, file: File = makePhotoFile()) {
  await pick(user, file)
  await within(dialog()).findByAltText("Vista previa de la foto")
}

async function clickAnalyze(user: User) {
  await user.click(button("Analizar foto"))
}

async function reachProposal(
  user: User,
  analysis: MealPhotoAnalysis = makeAnalysis(),
  file: File = makePhotoFile()
) {
  analyzeMock.mockResolvedValue(analysis)
  await toPreview(user, file)
  await clickAnalyze(user)
  await within(dialog()).findByRole("list", { name: "Alimentos de la propuesta" })
}

function proposalList() {
  return within(dialog()).getByRole("list", { name: "Alimentos de la propuesta" })
}

function rows() {
  return within(proposalList()).getAllByRole("listitem")
}

function gramsField(name: string) {
  return within(dialog()).getByLabelText(`Gramos de ${name}`) as HTMLInputElement
}

async function setGrams(user: User, name: string, text: string) {
  const field = gramsField(name)
  await user.clear(field)
  if (text) await user.type(field, text)
}

async function search(user: User, text: string) {
  await user.type(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" }), text)
  await user.click(button("Buscar"))
}

async function chooseFood(user: User, name: string) {
  await user.click(await within(dialog()).findByRole("button", { name: `Elegir ${name}` }))
}

async function save(user: User, label = currentLabel) {
  await user.click(button(`Guardar en ${label}`))
}

async function fillCustom(
  user: User,
  values: Partial<Record<"calories" | "protein" | "carbs" | "fat", string>> = {}
) {
  const all = { calories: "160", protein: "5,5", carbs: "27", fat: "3,2", ...values }
  const labels = {
    calories: "Calorías por 100 g (kcal)",
    protein: "Proteína por 100 g (g)",
    carbs: "Carbohidratos por 100 g (g)",
    fat: "Grasa por 100 g (g)",
  } as const
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    const field = within(dialog()).getByLabelText(labels[key])
    await user.clear(field)
    if (all[key]) await user.type(field, all[key])
  }
}

// Llega a la propuesta con «Gallo pinto» sin coincidencia y abre el formulario personalizado.
async function openCustomForGallo(user: User) {
  await reachProposal(user, makeAnalysis({ items: [RICE], unmatched: [GALLO_UNMATCHED] }))
  await user.click(button("Crear Gallo pinto como personalizado"))
}

function resetMocks() {
  addMock.mockReset()
  analyzeMock.mockReset()
  getDiaryMock.mockReset()
  searchMock.mockReset()
  searchMock.mockResolvedValue({ results: [] })
  addMock.mockResolvedValue(makeMeal({ meal_type: "lunch" }) as Meal)
  getDiaryMock.mockResolvedValue({
    date: "2026-10-22",
    meals: [],
    totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    incomplete: [],
  })
}

// ---------------------------------------------------------------------------
// REQ-001 y REQ-002: inicio, selectores y vista previa
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - inicio y vista previa", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-001 AC-001.2
  it("en Cena se abre con el título, los tres botones y el aviso de 10 fotos por hora", () => {
    renderDialog({ mealType: "dinner", label: "Cena" })

    const root = dialog("Cena")
    expect(within(root).getByText("Añadir a Cena con una foto")).toBeInTheDocument()
    for (const name of ["Hacer una foto", "Elegir una foto", "Cancelar"]) {
      expect(within(root).getByRole("button", { name })).toBeInTheDocument()
    }
    expect(within(root).getByText("Puedes analizar hasta 10 fotos por hora.")).toBeInTheDocument()
  })

  // SDD: 025 REQ-001 AC-001.3
  it("a menos de 640 px ocupa toda la pantalla y desde 640 px es un diálogo centrado", () => {
    renderDialog()

    const classes = dialog().className
    expect(classes).toContain("max-sm:h-dvh")
    expect(classes).toContain("max-sm:w-full")
    expect(classes).toContain("max-sm:max-w-none")
    expect(classes).toContain("sm:max-w-lg")
  })

  // SDD: 025 REQ-001 AC-001.4
  it("«Cancelar» cierra el diálogo sin hacer ninguna petición", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.click(button("Cancelar"))

    expect(onClose).toHaveBeenCalled()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-001 AC-001.4
  it("cerrar con Escape sin foto elegida tampoco hace ninguna petición", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-002 AC-002.1
  it("los dos selectores aceptan solo JPEG, PNG, WebP, HEIC y HEIF y no admiten varios archivos", () => {
    renderDialog()

    const camera = within(dialog()).getByTestId("meal-photo-camera-input") as HTMLInputElement
    const files = within(dialog()).getByTestId("meal-photo-file-input") as HTMLInputElement
    for (const input of [camera, files]) {
      expect(input).toHaveAttribute("type", "file")
      expect(input.multiple).toBe(false)
      const accept = input.getAttribute("accept") ?? ""
      for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
        expect(accept).toContain(type)
      }
      expect(accept).not.toContain("image/gif")
      expect(accept).not.toContain("application/pdf")
    }
  })

  // SDD: 025 REQ-002 AC-002.1
  it("«Hacer una foto» pide la cámara trasera y «Elegir una foto» no fuerza la cámara", () => {
    renderDialog()

    expect(within(dialog()).getByTestId("meal-photo-camera-input")).toHaveAttribute(
      "capture",
      "environment"
    )
    expect(within(dialog()).getByTestId("meal-photo-file-input")).not.toHaveAttribute("capture")
  })

  // SDD: 025 REQ-002 AC-002.2
  it("al elegir una foto JPEG válida muestra la vista previa con «Analizar foto» y «Cambiar foto» sin hacer peticiones", async () => {
    const user = userEvent.setup()
    const { processor } = renderDialog()

    await toPreview(user)

    expect(within(dialog()).getByAltText("Vista previa de la foto")).toBeInTheDocument()
    expect(button("Analizar foto")).toBeEnabled()
    expect(button("Cambiar foto")).toBeEnabled()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
    expect(processor.created).toEqual(["blob:preview-1"])
  })

  // SDD: 025 REQ-002 AC-002.2
  it("la foto elegida con la cámara también llega a la vista previa", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.upload(
      within(dialog()).getByTestId("meal-photo-camera-input") as HTMLInputElement,
      makePhotoFile()
    )

    expect(await within(dialog()).findByAltText("Vista previa de la foto")).toBeInTheDocument()
    expect(analyzeMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-002 AC-002.3
  it("«Cambiar foto» y elegir otra muestra la nueva vista previa y libera la anterior", async () => {
    const user = userEvent.setup()
    const { processor } = renderDialog()
    await toPreview(user, makePhotoFile({ name: "primera.jpg" }))
    const first = within(dialog()).getByAltText("Vista previa de la foto").getAttribute("src")

    await user.click(button("Cambiar foto"))
    await pick(user, makePhotoFile({ name: "segunda.jpg" }))

    await waitFor(() =>
      expect(within(dialog()).getByAltText("Vista previa de la foto")).not.toHaveAttribute(
        "src",
        first
      )
    )
    expect(within(dialog()).getByAltText("Vista previa de la foto")).toHaveAttribute(
      "src",
      "blob:preview-2"
    )
    expect(processor.revoked).toContain(first)
    expect(analyzeMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// REQ-003 y REQ-004: validación y límite de 3 MB
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - validación de la foto", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-003 AC-003.1
  it.each([
    ["un PDF", makePhotoFile({ name: "menu.pdf", type: "application/pdf" })],
    ["un GIF", makePhotoFile({ name: "plato.gif", type: "image/gif" })],
  ])("con %s muestra el mensaje de tipo, sin vista previa ni peticiones", async (_name, file) => {
    const user = userEvent.setup({ applyAccept: false })
    renderDialog()

    await pick(user, file)

    expect(
      await within(dialog()).findByText("Elige una foto JPEG, PNG, WebP o HEIC.")
    ).toBeInTheDocument()
    expect(within(dialog()).queryByAltText("Vista previa de la foto")).not.toBeInTheDocument()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-003 AC-003.2
  it("acepta una foto JPEG de exactamente 20 MB", async () => {
    const user = userEvent.setup()
    renderDialog()

    await toPreview(user, makePhotoFile({ bytes: 20 * MB }))

    expect(within(dialog()).queryByText("La foto no puede superar los 20 MB.")).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-003 AC-003.2
  it("con una foto de 20 MB y un byte muestra «La foto no puede superar los 20 MB.» sin peticiones", async () => {
    const user = userEvent.setup()
    renderDialog()

    await pick(user, makePhotoFile({ bytes: 20 * MB + 1 }))

    expect(
      await within(dialog()).findByText("La foto no puede superar los 20 MB.")
    ).toBeInTheDocument()
    expect(within(dialog()).queryByAltText("Vista previa de la foto")).not.toBeInTheDocument()
    expect(analyzeMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-003 AC-003.3
  it("una foto JPEG que el navegador no puede leer muestra «No se pudo leer la foto…» sin vista previa", async () => {
    const user = userEvent.setup()
    renderDialog({ processor: new FakePhotoProcessor({ unreadable: true }) })

    await pick(user, makePhotoFile())

    expect(
      await within(dialog()).findByText(
        "No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP."
      )
    ).toBeInTheDocument()
    expect(within(dialog()).queryByAltText("Vista previa de la foto")).not.toBeInTheDocument()
    expect(analyzeMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-003 AC-003.3
  it("una foto HEIC en un navegador que no la lee muestra el mismo mensaje", async () => {
    const user = userEvent.setup()
    renderDialog({ processor: new FakePhotoProcessor({ unreadable: true }) })

    await pick(user, makePhotoFile({ name: "iphone.heic", type: "image/heic" }))

    expect(
      await within(dialog()).findByText(
        "No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP."
      )
    ).toBeInTheDocument()
    expect(analyzeMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-003 AC-003.1
  it("tras un error deja elegir otra foto", async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderDialog()
    await pick(user, makePhotoFile({ name: "menu.pdf", type: "application/pdf" }))
    await within(dialog()).findByText("Elige una foto JPEG, PNG, WebP o HEIC.")

    expect(button("Hacer una foto")).toBeEnabled()
    expect(button("Elegir una foto")).toBeEnabled()
  })

  // SDD: 025 REQ-003 AC-003.4
  it("al elegir después una foto válida el mensaje desaparece y se ve la vista previa", async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderDialog()
    await pick(user, makePhotoFile({ name: "menu.pdf", type: "application/pdf" }))
    await within(dialog()).findByText("Elige una foto JPEG, PNG, WebP o HEIC.")

    await pick(user, makePhotoFile())

    expect(await within(dialog()).findByAltText("Vista previa de la foto")).toBeInTheDocument()
    expect(
      within(dialog()).queryByText("Elige una foto JPEG, PNG, WebP o HEIC.")
    ).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-004 AC-004.1
  it("«Analizar foto» envía al análisis un único JPEG reducido a 1600×1200", async () => {
    const user = userEvent.setup()
    const { processor } = renderDialog({
      processor: new FakePhotoProcessor({ size: { width: 4000, height: 3000 } }),
    })
    analyzeMock.mockReturnValue(new Promise(() => {}))
    await toPreview(user)

    await clickAnalyze(user)

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
    const sent = analyzeMock.mock.calls[0][0]
    expect(sent).toBeInstanceOf(Blob)
    expect(sent.type).toBe("image/jpeg")
    expect(processor.jpegCalls).toEqual([{ width: 1600, height: 1200 }])
  })

  // SDD: 025 REQ-004 AC-004.5
  it("con una imagen generada de más de 3 MB muestra «La imagen no puede superar los 3 MB.» y no hace la petición", async () => {
    const user = userEvent.setup()
    renderDialog({ processor: new FakePhotoProcessor({ jpegBytes: 3 * MB + 1 }) })
    await toPreview(user)

    await clickAnalyze(user)

    expect(
      await within(dialog()).findByText("La imagen no puede superar los 3 MB.")
    ).toBeInTheDocument()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(button("Cambiar foto")).toBeEnabled()
  })

  // SDD: 025 REQ-004 AC-004.5
  it("una imagen generada de exactamente 3 MB sí se envía", async () => {
    const user = userEvent.setup()
    renderDialog({ processor: new FakePhotoProcessor({ jpegBytes: 3 * MB }) })
    analyzeMock.mockReturnValue(new Promise(() => {}))
    await toPreview(user)

    await clickAnalyze(user)

    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(1))
  })
})

// ---------------------------------------------------------------------------
// REQ-005 y REQ-012: análisis y fallos
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - análisis", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-005 AC-005.1
  it("mientras analiza muestra «Analizando la foto…» y desactiva «Analizar foto» y «Cambiar foto»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockReturnValue(new Promise(() => {}))
    await toPreview(user)

    await clickAnalyze(user)

    expect(await within(dialog()).findByText("Analizando la foto…")).toBeInTheDocument()
    expect(button("Analizar foto")).toBeDisabled()
    expect(button("Cambiar foto")).toBeDisabled()
  })

  // SDD: 025 REQ-012 AC-012.1
  it("ante un 503 muestra el mensaje del servidor con «Reintentar» y «Registrar a mano»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new ApiError(503, BUSY_503))
    await toPreview(user)

    await clickAnalyze(user)

    expect(await within(dialog()).findByText(BUSY_503)).toBeInTheDocument()
    expect(button("Reintentar")).toBeInTheDocument()
    expect(button("Registrar a mano")).toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.2
  it("«Reintentar» vuelve a enviar la misma imagen y muestra «Analizando la foto…»", async () => {
    const user = userEvent.setup()
    const { processor } = renderDialog()
    analyzeMock.mockRejectedValueOnce(new ApiError(503, BUSY_503))
    await toPreview(user)
    await clickAnalyze(user)
    await within(dialog()).findByText(BUSY_503)
    const second = deferred<MealPhotoAnalysis>()
    analyzeMock.mockReturnValueOnce(second.promise)

    await user.click(button("Reintentar"))

    expect(await within(dialog()).findByText("Analizando la foto…")).toBeInTheDocument()
    expect(analyzeMock).toHaveBeenCalledTimes(2)
    expect(analyzeMock.mock.calls[1][0]).toBe(analyzeMock.mock.calls[0][0])
    expect(processor.jpegCalls).toHaveLength(1)
    await act(async () => second.resolve(makeAnalysis()))
  })

  // SDD: 025 REQ-012 AC-012.3
  it("ante un 429 muestra el mensaje del servidor con «Registrar a mano» y sin «Reintentar»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new ApiError(429, LIMIT_429))
    await toPreview(user)

    await clickAnalyze(user)

    expect(await within(dialog()).findByText(LIMIT_429)).toBeInTheDocument()
    expect(button("Registrar a mano")).toBeInTheDocument()
    expect(within(dialog()).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.4
  it("ante un fallo de red muestra «No se pudo analizar la foto. Vuelve a intentarlo.» con «Reintentar» y «Registrar a mano»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await toPreview(user)

    await clickAnalyze(user)

    expect(
      await within(dialog()).findByText("No se pudo analizar la foto. Vuelve a intentarlo.")
    ).toBeInTheDocument()
    expect(button("Reintentar")).toBeInTheDocument()
    expect(button("Registrar a mano")).toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.5
  it("una respuesta sin alimentos muestra «No reconocimos alimentos en la foto.» con «Cambiar foto» y «Registrar a mano»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockResolvedValue(makeAnalysis({ items: [], unmatched: [] }))
    await toPreview(user)

    await clickAnalyze(user)

    expect(
      await within(dialog()).findByText("No reconocimos alimentos en la foto.")
    ).toBeInTheDocument()
    expect(button("Cambiar foto")).toBeEnabled()
    expect(button("Registrar a mano")).toBeInTheDocument()
    expect(
      within(dialog()).queryByRole("list", { name: "Alimentos de la propuesta" })
    ).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.6
  it.each([
    [400, "La imagen debe ser JPEG, PNG o WebP."],
    [413, "La imagen no puede superar los 3 MB."],
  ])("ante un %d muestra el mensaje del servidor con «Cambiar foto»", async (status, message) => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new ApiError(status, message))
    await toPreview(user)

    await clickAnalyze(user)

    expect(await within(dialog()).findByText(message)).toBeInTheDocument()
    expect(button("Cambiar foto")).toBeEnabled()
    expect(within(dialog()).queryByRole("button", { name: "Registrar a mano" })).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.6
  it("tras un 400, «Cambiar foto» deja elegir otra foto y la muestra", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new ApiError(400, "La imagen debe ser JPEG, PNG o WebP."))
    await toPreview(user)
    await clickAnalyze(user)
    await within(dialog()).findByText("La imagen debe ser JPEG, PNG o WebP.")

    await user.click(button("Cambiar foto"))
    await pick(user, makePhotoFile({ name: "otra.jpg" }))

    expect(await within(dialog()).findByAltText("Vista previa de la foto")).toBeInTheDocument()
    expect(
      within(dialog()).queryByText("La imagen debe ser JPEG, PNG o WebP.")
    ).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.7
  it("«Registrar a mano» avisa a quien abrió el diálogo", async () => {
    const user = userEvent.setup()
    const { onRegisterManually } = renderDialog({ mealType: "dinner", label: "Cena" })
    analyzeMock.mockRejectedValue(new ApiError(503, BUSY_503))
    await toPreview(user)
    await clickAnalyze(user)
    await within(dialog("Cena")).findByText(BUSY_503)

    await user.click(within(dialog("Cena")).getByRole("button", { name: "Registrar a mano" }))

    expect(onRegisterManually).toHaveBeenCalledTimes(1)
  })

  // SDD: 025 REQ-012 AC-012.8
  it("una respuesta con items vacío y un alimento en unmatched muestra la propuesta, no el aviso de vacío", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, makeAnalysis({ items: [], unmatched: [TOMATO_SAUCE] }))

    expect(within(dialog()).getByText("Salsa de tomate")).toBeInTheDocument()
    expect(within(dialog()).getByText("Sin coincidencia en el catálogo")).toBeInTheDocument()
    expect(
      within(dialog()).queryByText("No reconocimos alimentos en la foto.")
    ).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REQ-006 a REQ-008: propuesta, gramos y quitar
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - propuesta", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-006 AC-006.1
  it("el arroz se muestra con nombre, «Gramos de Arroz blanco cocido» a 150, «Confianza alta» y su vista previa", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    expect(within(proposalList()).getByText("Arroz blanco cocido")).toBeInTheDocument()
    expect(gramsField("Arroz blanco cocido")).toHaveValue("150")
    expect(within(dialog()).getByText("Confianza alta")).toBeInTheDocument()
    expect(within(dialog()).getByText(RICE_PREVIEW)).toBeInTheDocument()
  })

  // SDD: 025 REQ-006 AC-006.1
  it("los alimentos de items se muestran en su orden", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, RICE_CHICKEN_SAUCE)

    const items = rows()
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent("Arroz blanco cocido")
    expect(items[1]).toHaveTextContent("Pechuga de pollo a la plancha")
    expect(items[2]).toHaveTextContent("Salsa de tomate")
  })

  // SDD: 025 REQ-006 AC-006.2
  it("la confianza se escribe en texto: alta, media y baja", async () => {
    const user = userEvent.setup()
    renderDialog()
    const banano = {
      ...CHICKEN,
      catalog_id: "banano",
      name: "Banano",
      confidence: "low" as const,
    }

    await reachProposal(user, makeAnalysis({ items: [RICE, CHICKEN, banano] }))

    expect(within(dialog()).getByText("Confianza alta")).toBeInTheDocument()
    expect(within(dialog()).getByText("Confianza media")).toBeInTheDocument()
    expect(within(dialog()).getByText("Confianza baja")).toBeInTheDocument()
  })

  // SDD: 025 REQ-006 AC-006.3
  it("la salsa sin coincidencia lleva su marca, «30 g», «Confianza baja», sin macros y con sus tres botones", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, RICE_CHICKEN_SAUCE)

    const row = within(dialog()).getByText("Salsa de tomate").closest("li") as HTMLElement
    expect(within(row).getByText("Sin coincidencia en el catálogo")).toBeInTheDocument()
    expect(within(row).getByText("30 g")).toBeInTheDocument()
    expect(within(row).getByText("Confianza baja")).toBeInTheDocument()
    expect(row.textContent).not.toContain("kcal")
    expect(within(row).queryByRole("textbox")).not.toBeInTheDocument()
    for (const name of [
      "Buscar Salsa de tomate en el catálogo",
      "Crear Salsa de tomate como personalizado",
      "Quitar Salsa de tomate",
    ]) {
      expect(within(row).getByRole("button", { name })).toBeInTheDocument()
    }
  })

  // SDD: 025 REQ-006 AC-006.4
  it("el total suma el arroz y el pollo y no cuenta la salsa sin coincidencia", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, RICE_CHICKEN_SAUCE)

    expect(within(dialog()).getByText(TOTAL_3)).toBeInTheDocument()
  })

  // SDD: 025 REQ-006 AC-006.5
  it("con un alimento sin coincidencia avisa de que no se guardan", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, RICE_CHICKEN_SAUCE)

    expect(within(dialog()).getByText(UNMATCHED_NOTICE)).toBeInTheDocument()
  })

  // SDD: 025 REQ-006 AC-006.5
  it("sin alimentos sin coincidencia no muestra ese aviso", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    expect(within(dialog()).queryByText(UNMATCHED_NOTICE)).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-007 AC-007.1
  it("al cambiar los gramos del arroz a 200 actualiza su vista previa y el total sin hacer peticiones", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await setGrams(user, "Arroz blanco cocido", "200")

    expect(within(dialog()).getByText(RICE_200_PREVIEW)).toBeInTheDocument()
    expect(
      within(dialog()).getByText(
        "Total: 260 kcal · 5,4 g proteína · 56,3 g carbohidratos · 0,6 g grasa"
      )
    ).toBeInTheDocument()
    expect(analyzeMock).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-007 AC-007.3
  it.each([
    ["", "Los gramos deben estar entre 1 y 2000."],
    ["0", "Los gramos deben estar entre 1 y 2000."],
    ["2001", "Los gramos deben estar entre 1 y 2000."],
    ["150,25", "Los gramos admiten como mucho un decimal."],
  ])("con los gramos %j avisa «%s» junto al campo y no guarda", async (grams, message) => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))
    await setGrams(user, "Arroz blanco cocido", grams)

    await save(user)

    expect(await within(dialog()).findByText(message)).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-008 AC-008.1
  it("«Quitar Pechuga de pollo a la plancha» la quita sin confirmar y recalcula el total", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, RICE_CHICKEN_SAUCE)

    await user.click(button("Quitar Pechuga de pollo a la plancha"))

    expect(within(dialog()).queryByText("Pechuga de pollo a la plancha")).not.toBeInTheDocument()
    expect(within(dialog()).getByText(TOTAL_RICE)).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(rows()).toHaveLength(2)
  })

  // SDD: 025 REQ-008 AC-008.2
  it("al quitar la salsa deja de verse y también el aviso de sin coincidencia", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, RICE_CHICKEN_SAUCE)

    await user.click(button("Quitar Salsa de tomate"))

    expect(within(dialog()).queryByText("Salsa de tomate")).not.toBeInTheDocument()
    expect(within(dialog()).queryByText(UNMATCHED_NOTICE)).not.toBeInTheDocument()
    expect(within(dialog()).getByText(TOTAL_3)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REQ-009 y REQ-010: añadir y resolver alimentos
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - añadir y resolver alimentos", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-009 AC-009.1
  it("«Añadir otro alimento» muestra la búsqueda del catálogo con su ayuda y «Volver a la propuesta»", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await user.click(button("Añadir otro alimento"))

    expect(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })).toBeInTheDocument()
    expect(button("Buscar")).toBeInTheDocument()
    expect(within(dialog()).getByText(SEARCH_HELP)).toBeInTheDocument()
    expect(button("Volver a la propuesta")).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-009 AC-009.1
  it("la búsqueda desde la propuesta valida igual que «Añadir a {sección}»", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))
    await user.click(button("Añadir otro alimento"))

    await user.click(button("Buscar"))

    expect(
      await within(dialog()).findByText("Escribe qué alimento quieres buscar.")
    ).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-009 AC-009.2
  it("al elegir «Aguacate» vuelve a la propuesta con 100 g, «Añadido por ti», su vista previa y el total", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))
    await user.click(button("Añadir otro alimento"))
    searchMock.mockResolvedValue({ results: [AGUACATE] })

    await search(user, "aguacate")
    await chooseFood(user, "Aguacate")

    const items = rows()
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent("Aguacate")
    expect(items[1]).toHaveTextContent("Añadido por ti")
    expect(gramsField("Aguacate")).toHaveValue("100")
    expect(
      within(items[1]).getByText("160 kcal · 2,0 g proteína · 8,5 g carbohidratos · 14,7 g grasa")
    ).toBeInTheDocument()
    expect(
      within(dialog()).getByText(
        "Total: 355 kcal · 6,0 g proteína · 50,8 g carbohidratos · 15,1 g grasa"
      )
    ).toBeInTheDocument()
    expect(searchMock.mock.calls[0][0]).toBe("aguacate")
  })

  // SDD: 025 REQ-009 AC-009.3
  it("«Volver a la propuesta» deja la propuesta igual, también lo que el usuario editó", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, RICE_CHICKEN_SAUCE)
    await setGrams(user, "Arroz blanco cocido", "200")
    await user.click(button("Añadir otro alimento"))

    await user.click(button("Volver a la propuesta"))

    expect(rows()).toHaveLength(3)
    expect(gramsField("Arroz blanco cocido")).toHaveValue("200")
    expect(within(dialog()).getByText("Salsa de tomate")).toBeInTheDocument()
    expect(within(dialog()).getByText(UNMATCHED_NOTICE)).toBeInTheDocument()
  })

  // SDD: 025 REQ-009 AC-009.4
  it("un alimento del catálogo que ya está en la propuesta aparece dos veces", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE, CHICKEN] }))
    await user.click(button("Añadir otro alimento"))
    searchMock.mockResolvedValue({ results: [PECHUGA] })

    await search(user, "pollo")
    await chooseFood(user, "Pechuga de pollo a la plancha")

    expect(within(dialog()).getAllByLabelText("Gramos de Pechuga de pollo a la plancha")).toHaveLength(2)
    expect(rows()).toHaveLength(3)
  })

  // SDD: 025 REQ-009 AC-009.4
  it("los dos repetidos se guardan", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE, CHICKEN] }))
    await user.click(button("Añadir otro alimento"))
    searchMock.mockResolvedValue({ results: [PECHUGA] })
    await search(user, "pollo")
    await chooseFood(user, "Pechuga de pollo a la plancha")

    await save(user)

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0].items).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150 },
      { catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 100 },
      { catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 100 },
    ])
  })

  // SDD: 025 REQ-010 AC-010.1
  it("«Buscar Salsa de tomate en el catálogo» abre la búsqueda con el nombre ya escrito y buscado, y «Elegir Tomate» lo sustituye en su posición con 30 g", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(
      user,
      makeAnalysis({ items: [RICE, CHICKEN], unmatched: [TOMATO_SAUCE] })
    )
    searchMock.mockResolvedValue({ results: [TOMATE] })

    await user.click(button("Buscar Salsa de tomate en el catálogo"))

    expect(within(dialog()).getByRole("searchbox", { name: "Buscar alimento" })).toHaveValue(
      "Salsa de tomate"
    )
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1))
    expect(searchMock.mock.calls[0][0]).toBe("Salsa de tomate")

    await chooseFood(user, "Tomate")

    const items = rows()
    expect(items).toHaveLength(3)
    expect(items[2]).toHaveTextContent("Tomate")
    expect(items[2]).toHaveTextContent("Añadido por ti")
    expect(gramsField("Tomate")).toHaveValue("30")
    expect(within(items[2]).getByText("5 kcal · 0,3 g proteína · 1,2 g carbohidratos · 0,1 g grasa")).toBeInTheDocument()
    expect(within(dialog()).queryByText("Sin coincidencia en el catálogo")).not.toBeInTheDocument()
    expect(within(dialog()).queryByText("Salsa de tomate")).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-010 AC-010.1
  it("el alimento que sustituye a uno sin coincidencia ocupa su misma posición, aunque no sea el último", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(
      user,
      makeAnalysis({
        items: [RICE],
        unmatched: [TOMATO_SAUCE, GALLO_UNMATCHED],
      })
    )
    searchMock.mockResolvedValue({ results: [TOMATE] })

    await user.click(button("Buscar Salsa de tomate en el catálogo"))
    await chooseFood(user, "Tomate")

    const items = rows()
    expect(items[1]).toHaveTextContent("Tomate")
    expect(items[2]).toHaveTextContent("Gallo pinto")
    expect(items[2]).toHaveTextContent("Sin coincidencia en el catálogo")
    expect(within(dialog()).getByText(UNMATCHED_NOTICE)).toBeInTheDocument()
  })

  // SDD: 025 REQ-010 AC-010.1
  it("el alimento sustituido cuenta en el total", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE], unmatched: [TOMATO_SAUCE] }))
    searchMock.mockResolvedValue({ results: [TOMATE] })

    await user.click(button("Buscar Salsa de tomate en el catálogo"))
    await chooseFood(user, "Tomate")

    expect(
      within(dialog()).getByText(
        "Total: 200 kcal · 4,3 g proteína · 43,4 g carbohidratos · 0,5 g grasa"
      )
    ).toBeInTheDocument()
  })

  // SDD: 025 REQ-010 AC-010.2
  it("«Crear Gallo pinto como personalizado» muestra el formulario con nombre y gramos rellenos y los valores por 100 g vacíos", async () => {
    const user = userEvent.setup()
    renderDialog()

    await openCustomForGallo(user)

    expect(within(dialog()).getByLabelText("Nombre")).toHaveValue("Gallo pinto")
    expect(within(dialog()).getByLabelText("Gramos")).toHaveValue("200")
    for (const label of [
      "Calorías por 100 g (kcal)",
      "Proteína por 100 g (g)",
      "Carbohidratos por 100 g (g)",
      "Grasa por 100 g (g)",
    ]) {
      expect(within(dialog()).getByLabelText(label)).toHaveValue("")
    }
    expect(button("Añadir a la propuesta")).toBeInTheDocument()
    expect(button("Volver a la propuesta")).toBeInTheDocument()
  })

  // SDD: 025 REQ-010 AC-010.3
  it("«Añadir a la propuesta» sustituye el alimento por el personalizado en su posición, con «Personalizado», 200 g, su vista previa y el total", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForGallo(user)
    await fillCustom(user)

    await user.click(button("Añadir a la propuesta"))

    const items = rows()
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent("Gallo pinto")
    expect(items[1]).toHaveTextContent("Personalizado")
    expect(items[1]).not.toHaveTextContent("Sin coincidencia en el catálogo")
    expect(gramsField("Gallo pinto")).toHaveValue("200")
    expect(within(items[1]).getByText(GALLO_PREVIEW)).toBeInTheDocument()
    expect(
      within(dialog()).getByText(
        "Total: 515 kcal · 15,0 g proteína · 96,3 g carbohidratos · 6,8 g grasa"
      )
    ).toBeInTheDocument()
    expect(within(dialog()).queryByText(UNMATCHED_NOTICE)).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-010 AC-010.4
  it.each([
    [{ calories: "" }, "Indica las calorías, proteína, carbohidratos y grasa por 100 g."],
    [{ calories: "901" }, "Las calorías por 100 g deben estar entre 0 y 900."],
    [{ protein: "101" }, "Los macros por 100 g deben estar entre 0 y 100 g."],
  ])("con %j avisa «%s» y la propuesta no cambia", async (values, message) => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForGallo(user)
    await fillCustom(user, values)

    await user.click(button("Añadir a la propuesta"))

    expect(await within(dialog()).findByText(message)).toBeInTheDocument()
    await user.click(button("Volver a la propuesta"))
    const items = rows()
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent("Sin coincidencia en el catálogo")
  })

  // SDD: 025 REQ-010 AC-010.5
  it("«Volver a la propuesta» desde la búsqueda deja el alimento sin coincidencia en su posición", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE], unmatched: [TOMATO_SAUCE] }))
    await user.click(button("Buscar Salsa de tomate en el catálogo"))

    await user.click(button("Volver a la propuesta"))

    const items = rows()
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent("Salsa de tomate")
    expect(items[1]).toHaveTextContent("Sin coincidencia en el catálogo")
  })

  // SDD: 025 REQ-010 AC-010.5
  it("«Volver a la propuesta» desde el formulario personalizado deja el alimento sin coincidencia en su posición", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForGallo(user)

    await user.click(button("Volver a la propuesta"))

    const items = rows()
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent("Gallo pinto")
    expect(items[1]).toHaveTextContent("Sin coincidencia en el catálogo")
  })
})

// ---------------------------------------------------------------------------
// REQ-011 y REQ-013: guardado y cierre
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - guardado y cierre", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-011 AC-011.1
  it("«Guardar en Almuerzo» hace una sola petición con la fecha, el tipo y los alimentos guardables en orden, cierra y relee el diario", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await waitFor(() => expect(getDiaryMock).toHaveBeenCalledTimes(1))
    await reachProposal(user, RICE_CHICKEN_SAUCE)

    await save(user)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock).toHaveBeenCalledWith({
      date: "2026-10-22",
      meal_type: "lunch",
      items: [
        { catalog_id: "arroz-blanco-cocido", grams: 150 },
        { catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 100 },
      ],
    })
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 025 REQ-011 AC-011.1
  it("usa el tipo de comida de la tarjeta", async () => {
    const user = userEvent.setup()
    renderDialog({ mealType: "dinner", label: "Cena" })
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await save(user, "Cena")

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0].meal_type).toBe("dinner")
  })

  // SDD: 025 REQ-007 AC-007.2
  it("unos gramos «150,5» se envían como 150.5", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))
    await setGrams(user, "Arroz blanco cocido", "150,5")

    await save(user)

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0].items).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150.5 },
    ])
  })

  // SDD: 025 REQ-011 AC-011.2
  it("un alimento personalizado se envía con nombre, gramos y per_100g, tras el del catálogo", async () => {
    const user = userEvent.setup()
    renderDialog()
    await openCustomForGallo(user)
    await fillCustom(user)
    await user.click(button("Añadir a la propuesta"))

    await save(user)

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(addMock.mock.calls[0][0].items).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150 },
      {
        name: "Gallo pinto",
        grams: 200,
        per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
      },
    ])
  })

  // SDD: 025 REQ-011 AC-011.4
  it("si se quitan todos los alimentos, «Guardar en Almuerzo» queda desactivado con el aviso", async () => {
    const user = userEvent.setup()
    renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await user.click(button("Quitar Arroz blanco cocido"))

    expect(button("Guardar en Almuerzo")).toBeDisabled()
    expect(within(dialog()).getByText(NO_SAVABLE_NOTICE)).toBeInTheDocument()
  })

  // SDD: 025 REQ-011 AC-011.4
  it("con solo alimentos sin coincidencia, «Guardar en Almuerzo» queda desactivado con el aviso", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, makeAnalysis({ items: [], unmatched: [TOMATO_SAUCE] }))

    expect(button("Guardar en Almuerzo")).toBeDisabled()
    expect(within(dialog()).getByText(NO_SAVABLE_NOTICE)).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-011 AC-011.4
  it("con algún alimento guardable no muestra el aviso y el botón está activo", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, RICE_CHICKEN_SAUCE)

    expect(button("Guardar en Almuerzo")).toBeEnabled()
    expect(within(dialog()).queryByText(NO_SAVABLE_NOTICE)).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-011 AC-011.5
  it("mientras guarda, el botón muestra «Guardando…» desactivado y el diálogo no se puede cerrar", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    addMock.mockReturnValue(new Promise<Meal>(() => {}))
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await save(user)

    const saving = await within(dialog()).findByRole("button", { name: "Guardando…" })
    expect(saving).toBeDisabled()
    await user.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog()).toBeInTheDocument()
    expect(addMock).toHaveBeenCalledTimes(1)
  })

  // SDD: 025 REQ-011 AC-011.6
  it("si guardar responde 400 sigue abierto con la propuesta intacta y muestra el mensaje del servidor", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    addMock.mockRejectedValue(new ApiError(400, "Una comida no puede tener más de 50 alimentos."))
    await reachProposal(user, RICE_CHICKEN_SAUCE)
    await setGrams(user, "Arroz blanco cocido", "180")

    await save(user)

    const alert = await within(dialog()).findByRole("alert")
    expect(alert).toHaveTextContent("Una comida no puede tener más de 50 alimentos.")
    expect(onClose).not.toHaveBeenCalled()
    expect(rows()).toHaveLength(3)
    expect(gramsField("Arroz blanco cocido")).toHaveValue("180")
  })

  // SDD: 025 REQ-011 AC-011.6
  it("ante cualquier otro error muestra «No se pudo guardar. Vuelve a intentarlo.» y sigue abierto", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    addMock.mockRejectedValue(new ApiError(500, "boom"))
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await save(user)

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
    expect(onClose).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-011 AC-011.6
  it("ante un error de red al guardar muestra el mensaje genérico", async () => {
    const user = userEvent.setup()
    renderDialog()
    addMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await save(user)

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(SAVE_FAILED)
  })

  // SDD: 025 REQ-013 AC-013.1
  it("«Cancelar» con una propuesta cierra sin guardar y sin pedir confirmación", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await reachProposal(user, RICE_CHICKEN_SAUCE)

    await user.click(button("Cancelar"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-013 AC-013.1
  it("cerrar con Escape con una propuesta tampoco guarda nada", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await reachProposal(user, RICE_CHICKEN_SAUCE)

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// NFR-001 y NFR-002: la foto no sale del flujo y accesibilidad
// ---------------------------------------------------------------------------

describe("MealPhotoDialog - privacidad de la foto y accesibilidad", () => {
  beforeEach(resetMocks)

  // SDD: 025 NFR-001 AC-N001.1
  it("un flujo completo no deja claves nuevas en el almacenamiento y el guardado no lleva datos de la imagen", async () => {
    const user = userEvent.setup()
    const localBefore = Object.keys(localStorage).sort()
    const sessionBefore = Object.keys(sessionStorage).sort()
    const { onClose } = renderDialog()
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await save(user)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(Object.keys(localStorage).sort()).toEqual(localBefore)
    expect(Object.keys(sessionStorage).sort()).toEqual(sessionBefore)
    expect(addMock).toHaveBeenCalledTimes(1)
    const payload = addMock.mock.calls[0][0]
    expect(Object.keys(payload).sort()).toEqual(["date", "items", "meal_type"])
    expect(JSON.stringify(payload)).not.toMatch(/image|blob|jpeg|data:/i)
  })

  // SDD: 025 NFR-001 AC-N001.2
  it("al cambiar de foto libera la vista previa anterior", async () => {
    const user = userEvent.setup()
    const { processor } = renderDialog()
    await toPreview(user, makePhotoFile({ name: "primera.jpg" }))
    expect(processor.revoked).toEqual([])

    await user.click(button("Cambiar foto"))
    await pick(user, makePhotoFile({ name: "segunda.jpg" }))

    await waitFor(() => expect(processor.created).toHaveLength(2))
    expect(processor.revoked).toContain("blob:preview-1")
    expect(processor.revoked).not.toContain("blob:preview-2")
  })

  // SDD: 025 NFR-001 AC-N001.2
  it("al cerrar el diálogo (desmontarlo) libera la vista previa", async () => {
    const user = userEvent.setup()
    const { processor, view } = renderDialog()
    await toPreview(user)

    view.unmount()

    expect(processor.revoked).toContain("blob:preview-1")
  })

  // SDD: 025 NFR-001 AC-N001.2
  it("una foto nueva que no es válida libera la vista previa de la anterior", async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { processor } = renderDialog()
    await toPreview(user)

    await pick(user, makePhotoFile({ name: "menu.pdf", type: "application/pdf" }))

    await within(dialog()).findByText("Elige una foto JPEG, PNG, WebP o HEIC.")
    expect(processor.revoked).toContain("blob:preview-1")
  })

  // SDD: 025 NFR-002 AC-N002.1
  it("es un diálogo con nombre; los campos de gramos y los botones Quitar, Buscar y Crear llevan el nombre del alimento", async () => {
    const user = userEvent.setup()
    renderDialog()

    await reachProposal(user, RICE_CHICKEN_SAUCE)

    expect(
      screen.getByRole("dialog", { name: "Añadir a Almuerzo con una foto" })
    ).toBeInTheDocument()
    expect(gramsField("Arroz blanco cocido")).toBeInTheDocument()
    expect(gramsField("Pechuga de pollo a la plancha")).toBeInTheDocument()
    for (const name of [
      "Quitar Arroz blanco cocido",
      "Quitar Pechuga de pollo a la plancha",
      "Quitar Salsa de tomate",
      "Buscar Salsa de tomate en el catálogo",
      "Crear Salsa de tomate como personalizado",
    ]) {
      expect(button(name)).toBeInTheDocument()
    }
  })

  // SDD: 025 NFR-002 AC-N002.2
  it("«Analizando la foto…» se anuncia en una región de estado", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockReturnValue(new Promise(() => {}))
    await toPreview(user)

    await clickAnalyze(user)

    const text = await within(dialog()).findByText("Analizando la foto…")
    expect(text.closest('[role="status"], [role="alert"]')).not.toBeNull()
  })

  // SDD: 025 NFR-002 AC-N002.2
  it("un error de validación de la foto se anuncia en una región", async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderDialog()

    await pick(user, makePhotoFile({ name: "menu.pdf", type: "application/pdf" }))

    const text = await within(dialog()).findByText("Elige una foto JPEG, PNG, WebP o HEIC.")
    expect(text.closest('[role="status"], [role="alert"]')).not.toBeNull()
  })

  // SDD: 025 NFR-002 AC-N002.2
  it("un error del análisis se anuncia en una región", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new ApiError(503, BUSY_503))
    await toPreview(user)

    await clickAnalyze(user)

    const text = await within(dialog()).findByText(BUSY_503)
    expect(text.closest('[role="status"], [role="alert"]')).not.toBeNull()
  })

  // SDD: 025 NFR-002 AC-N002.2
  it("el error al guardar se anuncia en una región con rol alert", async () => {
    const user = userEvent.setup()
    renderDialog()
    addMock.mockRejectedValue(new ApiError(500, "boom"))
    await reachProposal(user, makeAnalysis({ items: [RICE] }))

    await save(user)

    const alert = await within(dialog()).findByRole("alert")
    expect(alert).toHaveTextContent(SAVE_FAILED)
  })
})

// ---------------------------------------------------------------------------
// Review 025, hallazgos F1 a F4
// ---------------------------------------------------------------------------

// Procesador cuyas operaciones asíncronas esperan a que el test las libere.
class GatedPhotoProcessor extends FakePhotoProcessor {
  gateRead = false
  gateJpeg = false
  private readRelease: (() => void) | null = null
  private jpegRelease: (() => void) | null = null
  private readGate = new Promise<void>((resolve) => {
    this.readRelease = resolve
  })
  private jpegGate = new Promise<void>((resolve) => {
    this.jpegRelease = resolve
  })

  releaseAll() {
    this.readRelease?.()
    this.jpegRelease?.()
  }

  async readSize(file: Blob) {
    if (this.gateRead) await this.readGate
    return super.readSize(file)
  }

  async toJpeg(file: Blob, size: { width: number; height: number }) {
    if (this.gateJpeg) await this.jpegGate
    return super.toJpeg(file, size)
  }
}

describe("MealPhotoDialog - cierre durante operaciones asíncronas (F1)", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-005 AC-005.2
  it("si se cierra el diálogo mientras se prepara el JPEG, la foto no se envía al analizar", async () => {
    const user = userEvent.setup()
    const processor = new GatedPhotoProcessor()
    const { view } = renderDialog({ processor })
    await toPreview(user)
    processor.gateJpeg = true

    await clickAnalyze(user)
    view.unmount()
    await act(async () => {
      processor.releaseAll()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(analyzeMock).not.toHaveBeenCalled()
  })

  // SDD: 025 NFR-001 AC-N001.2
  it("si se cierra el diálogo mientras se comprueba la foto, la URL de vista previa no queda sin liberar", async () => {
    const user = userEvent.setup()
    const processor = new GatedPhotoProcessor()
    processor.gateRead = true
    const { view } = renderDialog({ processor })

    await pick(user, makePhotoFile())
    view.unmount()
    await act(async () => {
      processor.releaseAll()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect.hasAssertions()
    expect(processor.revoked.length).toBe(processor.created.length)
    for (const url of processor.created) expect(processor.revoked).toContain(url)
  })

  // SDD: 025 NFR-001 AC-N001.2
  it("si se eligen dos fotos seguidas mientras se comprueba la primera, la URL de vista previa de la primera se libera", async () => {
    const user = userEvent.setup()
    const processor = new GatedPhotoProcessor()
    processor.gateRead = true
    const { view } = renderDialog({ processor })

    await pick(user, makePhotoFile({ name: "primera.jpg" }))
    await pick(user, makePhotoFile({ name: "segunda.jpg" }))
    await act(async () => {
      processor.releaseAll()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    view.unmount()

    expect(processor.created.length).toBeGreaterThan(0)
    for (const url of processor.created) expect(processor.revoked).toContain(url)
  })
})

describe("MealPhotoDialog - acciones según el error (F2, F3, F4)", () => {
  beforeEach(resetMocks)

  // SDD: 025 REQ-012 AC-012.3
  it.each([
    [429, LIMIT_429],
    [503, BUSY_503],
  ])("ante un %i no se ofrece «Cambiar foto»", async (status, message) => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new ApiError(status, message))
    await toPreview(user)

    await clickAnalyze(user)

    await within(dialog()).findByText(message)
    expect(within(dialog()).queryByRole("button", { name: "Cambiar foto" })).not.toBeInTheDocument()
    expect(button("Registrar a mano")).toBeInTheDocument()
  })

  // SDD: 025 REQ-012 AC-012.4
  it("ante un fallo de red no se ofrece «Cambiar foto»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await toPreview(user)

    await clickAnalyze(user)

    await within(dialog()).findByText("No se pudo analizar la foto. Vuelve a intentarlo.")
    expect(within(dialog()).queryByRole("button", { name: "Cambiar foto" })).not.toBeInTheDocument()
  })

  // SDD: 025 REQ-004 AC-004.5
  it("con el error de 3 MB no se muestra «Analizar foto» y sí «Cambiar foto»", async () => {
    const user = userEvent.setup()
    renderDialog({ processor: new FakePhotoProcessor({ jpegBytes: 3 * MB + 1 }) })
    await toPreview(user)

    await clickAnalyze(user)

    await within(dialog()).findByText("La imagen no puede superar los 3 MB.")
    expect(within(dialog()).queryByRole("button", { name: "Analizar foto" })).not.toBeInTheDocument()
    expect(button("Cambiar foto")).toBeEnabled()
  })

  // SDD: 025 NFR-002 AC-N002.2
  it("la región de estado ya existe antes de analizar y es la misma que anuncia «Analizando la foto…»", async () => {
    const user = userEvent.setup()
    renderDialog()
    analyzeMock.mockReturnValue(new Promise(() => {}))
    await toPreview(user)

    const region = within(dialog()).getByRole("status")
    expect(region).not.toHaveTextContent("Analizando la foto…")

    await clickAnalyze(user)

    await within(dialog()).findByText("Analizando la foto…")
    expect(within(dialog()).getByRole("status")).toBe(region)
    expect(region).toHaveTextContent("Analizando la foto…")
  })
})
