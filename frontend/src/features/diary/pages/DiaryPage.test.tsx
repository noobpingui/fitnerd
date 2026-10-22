// Test de PÁGINA del «Diario» (spec 022). La red se simula en los api.ts del
// diario, de los alimentos y del perfil; la fecha de hoy se fija con
// `vi.useFakeTimers({ toFake: ["Date"] })` (martes 20 de octubre de 2026).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { ApiError } from "@/lib/apiClient"
import {
  addMealItems,
  analyzeMealPhoto,
  getDiary,
  removeMealItem,
  updateMealItemGrams,
} from "@/features/diary/api"
import type { PhotoProcessor } from "@/features/diary/photo"
import { searchCatalog } from "@/features/catalog/api"
import { getProfile } from "@/features/profile/api"
import { answersFromProfile } from "@/features/profile/mappers"
import { calculateMacros, type MacroKey } from "@/features/macros/calculations"
import { RICE, TOMATO_SAUCE, makeAnalysis } from "@/test/analysisFixtures"
import { makeCatalogFood } from "@/test/catalogFixtures"
import { FakePhotoProcessor, makePhotoFile } from "@/test/photoFixtures"
import {
  makeCatalogItem,
  makeCustomItem,
  makeDiary,
  makeMeal,
  makeMealItem,
  ZERO_TOTALS,
} from "@/test/diaryFixtures"
import { makeProfileResponse } from "@/test/profileFixtures"
import type { Diary } from "../types"
import { DiaryPage } from "./DiaryPage"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
  analyzeMealPhoto: vi.fn(),
}))
// El procesador del navegador (decodificar, canvas y URLs blob:) no se puede
// ejecutar en jsdom: la pantalla usa `browserPhotoProcessor`, que aquí delega en
// un doble escrito a mano que cada test fija en `photoHolder`.
const photoHolder = vi.hoisted(() => ({ processor: null as PhotoProcessor | null }))
vi.mock("@/features/diary/photo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/diary/photo")>()
  const current = () => photoHolder.processor as PhotoProcessor
  return {
    ...original,
    browserPhotoProcessor: {
      readSize: (file: Blob) => current().readSize(file),
      toJpeg: (file: Blob, size: { width: number; height: number }) =>
        current().toJpeg(file, size),
      createPreviewUrl: (file: Blob) => current().createPreviewUrl(file),
      revokePreviewUrl: (url: string) => current().revokePreviewUrl(url),
    },
  }
})
vi.mock("@/features/catalog/api", () => ({
  searchCatalog: vi.fn(),
}))
vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getDiaryMock = vi.mocked(getDiary)
const addMock = vi.mocked(addMealItems)
const updateMock = vi.mocked(updateMealItemGrams)
const removeMock = vi.mocked(removeMealItem)
const searchMock = vi.mocked(searchCatalog)
const analyzeMock = vi.mocked(analyzeMealPhoto)
const getProfileMock = vi.mocked(getProfile)

const CHICKEN_NAME = "Chicken, broilers or fryers, breast, meat only, cooked, roasted"
const CATALOG_CHICKEN = makeCatalogFood()
const CATALOG_CHICKEN_NAME = "Pechuga de pollo a la plancha"
// La pechuga del catálogo registrada con 150 g: 247,5 kcal.
const CATALOG_CHICKEN_ITEM = makeCatalogItem({
  id: 40,
  catalog_id: "pechuga-de-pollo-a-la-plancha",
  name: CATALOG_CHICKEN_NAME,
  per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
  nutrients: { calories_kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.36 },
})
const INCOMPLETE_NOTICE = "Algún alimento no tiene este dato: el total puede ser mayor."

const intFormat = new Intl.NumberFormat("es-ES")
const gramFormat = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

// Los objetivos que calcula Macros para el mismo perfil y la misma fecha.
function targets() {
  const summary = calculateMacros(answersFromProfile(makeProfileResponse()), new Date())
  const grams = (key: MacroKey) => summary.macros.find((m) => m.key === key)!.grams
  return {
    kcal: summary.targetKcal,
    protein: grams("protein"),
    carbs: grams("carbs"),
    fat: grams("fat"),
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DiaryPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function lunchDiary(): Diary {
  return makeDiary([makeMeal()])
}

describe("DiaryPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0))
    getDiaryMock.mockReset()
    addMock.mockReset()
    updateMock.mockReset()
    removeMock.mockReset()
    searchMock.mockReset()
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(makeProfileResponse())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // REQ-010: contenido de la pantalla
  // -------------------------------------------------------------------------

  // SDD: 022 REQ-010 AC-010.1
  it("muestra el título, la fecha larga, las cuatro secciones en orden y el alimento del almuerzo", async () => {
    getDiaryMock.mockResolvedValue(lunchDiary())
    renderPage()

    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(screen.getByText("martes, 20 de octubre")).toBeInTheDocument()
    const labels = ["Desayuno", "Almuerzo", "Cena", "Meriendas"].map((label) =>
      screen.getByText(label)
    )
    for (let i = 0; i < labels.length - 1; i++) {
      expect(
        labels[i].compareDocumentPosition(labels[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }
    expect(screen.getByText(CHICKEN_NAME)).toBeInTheDocument()
    expect(screen.getByText("150 g")).toBeInTheDocument()
    // La fila del alimento y el subtotal de la sección.
    expect(screen.getAllByText("248 kcal")).toHaveLength(2)
    expect(screen.getAllByText("Sin alimentos.")).toHaveLength(3)
    expect(screen.getAllByRole("button", { name: "Añadir alimento" })).toHaveLength(4)
  })

  // SDD: 022 REQ-010 AC-010.2
  it("pide el diario con la fecha local del dispositivo en formato AAAA-MM-DD", async () => {
    getDiaryMock.mockResolvedValue(makeDiary())
    renderPage()

    await screen.findByRole("heading", { level: 1, name: "Diario" })

    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-20")
  })

  // SDD: 022 REQ-010 AC-010.2
  it("a las 23:30 locales sigue pidiendo el día local, no el UTC", async () => {
    vi.setSystemTime(new Date(2026, 9, 20, 23, 30))
    getDiaryMock.mockResolvedValue(makeDiary())
    renderPage()

    await screen.findByRole("heading", { level: 1, name: "Diario" })

    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-20")
  })

  // SDD: 022 REQ-010 AC-010.3
  it("sin comidas muestra «Sin alimentos.» en cada sección y el texto de día vacío", async () => {
    getDiaryMock.mockResolvedValue(makeDiary())
    renderPage()

    expect(await screen.findByText("Todavía no has registrado nada hoy.")).toBeInTheDocument()
    expect(screen.getAllByText("Sin alimentos.")).toHaveLength(4)
    expect(screen.getAllByRole("button", { name: "Añadir alimento" })).toHaveLength(4)
  })

  // SDD: 022 REQ-010 AC-010.3
  it("con alguna comida no muestra el texto de día vacío", async () => {
    getDiaryMock.mockResolvedValue(lunchDiary())
    renderPage()

    await screen.findByText(CHICKEN_NAME)

    expect(screen.queryByText("Todavía no has registrado nada hoy.")).not.toBeInTheDocument()
  })

  // SDD: 022 REQ-010 AC-010.4
  it("mientras carga muestra «Cargando el diario…»", async () => {
    getDiaryMock.mockReturnValue(new Promise<Diary>(() => {}))
    renderPage()

    expect(await screen.findByText("Cargando el diario…")).toBeInTheDocument()
  })

  // SDD: 022 REQ-010 AC-010.5
  it("si la carga falla muestra el aviso y «Reintentar» vuelve a pedirlo", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockRejectedValueOnce(new ApiError(500, "boom"))
    getDiaryMock.mockResolvedValueOnce(lunchDiary())
    renderPage()

    expect(await screen.findByText("No se pudo cargar el diario.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText(CHICKEN_NAME)).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByText("No se pudo cargar el diario.")).not.toBeInTheDocument()
  })

  // SDD: 022 REQ-010 AC-010.6
  it("un alimento de USDA muestra su descripción y su origen; uno personalizado, su nombre y «Personalizado»", async () => {
    getDiaryMock.mockResolvedValue(
      makeDiary([
        makeMeal({
          items: [
            makeMealItem({ data_type: "foundation", name: "Rice, white" }),
            makeCustomItem(),
          ],
        }),
      ])
    )
    renderPage()

    expect(await screen.findByText("Rice, white")).toBeInTheDocument()
    expect(screen.getByText("Foundation")).toBeInTheDocument()
    expect(screen.getByText("Gallo pinto")).toBeInTheDocument()
    expect(screen.getByText("Personalizado")).toBeInTheDocument()
  })

  // SDD: 023 REQ-010 AC-010.1
  it("un alimento del catálogo muestra su nombre, «150 g» y «195 kcal» y su fila no tiene etiqueta de origen", async () => {
    getDiaryMock.mockResolvedValue(makeDiary([makeMeal({ items: [makeCatalogItem()] })]))
    renderPage()

    const name = await screen.findByText("Arroz blanco cocido")
    const row = name.closest("li") as HTMLElement
    expect(within(row).getByText("150 g")).toBeInTheDocument()
    expect(within(row).getByText("195 kcal")).toBeInTheDocument()
    for (const label of ["Foundation", "SR Legacy", "Personalizado", "USDA", "Catálogo"]) {
      expect(within(row).queryByText(label)).not.toBeInTheDocument()
    }
    expect(within(row).getByRole("button", { name: "Editar Arroz blanco cocido" })).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Quitar Arroz blanco cocido" })).toBeInTheDocument()
  })

  // SDD: 023 REQ-010 AC-010.2
  it("un alimento de SR Legacy y uno personalizado siguen mostrando «SR Legacy» y «Personalizado»", async () => {
    getDiaryMock.mockResolvedValue(
      makeDiary([
        makeMeal({
          items: [
            makeMealItem({ data_type: "sr_legacy", name: "Rice, white" }),
            makeCustomItem(),
            makeCatalogItem(),
          ],
        }),
      ])
    )
    renderPage()

    expect(await screen.findByText("Rice, white")).toBeInTheDocument()
    expect(screen.getByText("SR Legacy")).toBeInTheDocument()
    expect(screen.getByText("Personalizado")).toBeInTheDocument()
    expect(screen.getAllByText(/^(Foundation|SR Legacy|Personalizado)$/)).toHaveLength(2)
  })

  // SDD: 022 NFR-002 AC-N002.3
  it("«Cargando el diario…» se anuncia en una región de estado", async () => {
    getDiaryMock.mockReturnValue(new Promise<Diary>(() => {}))
    renderPage()

    const text = await screen.findByText("Cargando el diario…")

    expect(text.closest('[role="status"], [role="alert"]')).not.toBeNull()
  })

  // SDD: 022 NFR-002 AC-N002.3
  it("«No se pudo cargar el diario.» se anuncia en una región de estado", async () => {
    getDiaryMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPage()

    const text = await screen.findByText("No se pudo cargar el diario.")

    expect(text.closest('[role="status"], [role="alert"]')).not.toBeNull()
  })

  // -------------------------------------------------------------------------
  // REQ-014: totales frente al objetivo de Macros
  // -------------------------------------------------------------------------

  // SDD: 022 REQ-014 AC-014.1
  it("muestra el consumido frente al objetivo y lo que queda de cada nutriente", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: { calories_kcal: 650, protein_g: 45, carbs_g: 80.5, fat_g: 20 },
      })
    )
    renderPage()

    expect(await screen.findByText(`650 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
    expect(screen.getByText(`Quedan ${intFormat.format(goal.kcal - 650)} kcal`)).toBeInTheDocument()
    expect(screen.getByText(`${gramFormat.format(45)} / ${goal.protein} g`)).toBeInTheDocument()
    expect(
      screen.getByText(`Quedan ${gramFormat.format(goal.protein - 45)} g`)
    ).toBeInTheDocument()
    expect(screen.getByText(`${gramFormat.format(80.5)} / ${goal.carbs} g`)).toBeInTheDocument()
    expect(
      screen.getByText(`Quedan ${gramFormat.format(goal.carbs - 80.5)} g`)
    ).toBeInTheDocument()
    expect(screen.getByText(`${gramFormat.format(20)} / ${goal.fat} g`)).toBeInTheDocument()
    expect(screen.getByText(`Quedan ${gramFormat.format(goal.fat - 20)} g`)).toBeInTheDocument()
  })

  // SDD: 022 REQ-014 AC-014.2
  it("por encima del objetivo muestra el exceso y la barra de calorías llena", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: { calories_kcal: goal.kcal + 150, protein_g: 1, carbs_g: 1, fat_g: 1 },
      })
    )
    renderPage()

    expect(
      await screen.findByText(
        `${intFormat.format(goal.kcal + 150)} / ${intFormat.format(goal.kcal)} kcal`
      )
    ).toBeInTheDocument()
    expect(screen.getByText("150 kcal por encima del objetivo")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Calorías" })).toHaveAttribute(
      "aria-valuenow",
      "100"
    )
  })

  // SDD: 022 REQ-014 AC-014.3
  it("los objetivos son exactamente los que calcula Macros para el mismo perfil", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(makeDiary())
    renderPage()

    await screen.findByText(`0 / ${intFormat.format(goal.kcal)} kcal`)

    expect(screen.getByText(`${gramFormat.format(0)} / ${goal.protein} g`)).toBeInTheDocument()
    expect(screen.getByText(`${gramFormat.format(0)} / ${goal.carbs} g`)).toBeInTheDocument()
    expect(screen.getByText(`${gramFormat.format(0)} / ${goal.fat} g`)).toBeInTheDocument()
  })

  // SDD: 022 REQ-014 AC-014.4
  it("junto a un total incompleto avisa de que puede ser mayor", async () => {
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], { incomplete: ["carbs_g"] })
    )
    renderPage()

    expect(await screen.findByText(INCOMPLETE_NOTICE)).toBeInTheDocument()
    expect(screen.getAllByText(INCOMPLETE_NOTICE)).toHaveLength(1)
  })

  // SDD: 022 REQ-014 AC-014.4
  it("sin datos incompletos no muestra el aviso", async () => {
    getDiaryMock.mockResolvedValue(lunchDiary())
    renderPage()

    await screen.findByText(CHICKEN_NAME)

    expect(screen.queryByText(INCOMPLETE_NOTICE)).not.toBeInTheDocument()
  })

  // SDD: 022 REQ-014 AC-014.5
  it("un diario sin comidas muestra todo a 0, quedan las calorías del objetivo y las barras vacías", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(makeDiary([], { totals: ZERO_TOTALS }))
    renderPage()

    expect(await screen.findByText(`0 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
    expect(screen.getByText(`Quedan ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
    for (const name of ["Calorías", "Proteína", "Carbohidratos", "Grasa"]) {
      expect(screen.getByRole("progressbar", { name })).toHaveAttribute("aria-valuenow", "0")
    }
  })

  // SDD: 022 NFR-002 AC-N002.2
  it("cada barra de progreso se llama como su nutriente", async () => {
    getDiaryMock.mockResolvedValue(lunchDiary())
    renderPage()

    await screen.findByText(CHICKEN_NAME)

    const bars = screen.getAllByRole("progressbar")
    expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "Calorías",
      "Proteína",
      "Carbohidratos",
      "Grasa",
    ])
    for (const bar of bars) {
      expect(bar).toHaveAttribute("aria-valuemin", "0")
      expect(bar).toHaveAttribute("aria-valuemax", "100")
    }
  })

  // -------------------------------------------------------------------------
  // REQ-011, REQ-012, REQ-013: relectura tras añadir, editar y quitar
  // -------------------------------------------------------------------------

  // SDD: 022 REQ-011 AC-011.4
  // SDD: 022 REQ-014 AC-014.6
  it("tras añadir un alimento a Desayuno envía la petición, cierra el diálogo y relee el diario con los totales nuevos", async () => {
    const user = userEvent.setup()
    const goal = targets()
    const breakfast = makeMeal({ id: 20, meal_type: "breakfast", items: [CATALOG_CHICKEN_ITEM] })
    getDiaryMock.mockResolvedValueOnce(makeDiary())
    getDiaryMock.mockResolvedValue(makeDiary([breakfast]))
    addMock.mockResolvedValue(breakfast)
    searchMock.mockResolvedValue({ results: [CATALOG_CHICKEN] })
    renderPage()
    await screen.findByText(`0 / ${intFormat.format(goal.kcal)} kcal`)

    await user.click(screen.getAllByRole("button", { name: "Añadir alimento" })[0])
    const dialog = await screen.findByRole("dialog", { name: "Añadir a Desayuno" })
    await user.type(within(dialog).getByRole("searchbox", { name: "Buscar alimento" }), "pollo")
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }))
    await user.click(
      await within(dialog).findByRole("button", { name: `Elegir ${CATALOG_CHICKEN_NAME}` })
    )
    const grams = within(dialog).getByLabelText("Gramos")
    await user.clear(grams)
    await user.type(grams, "150")
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }))

    await waitFor(() =>
      expect(addMock).toHaveBeenCalledWith({
        date: "2026-10-20",
        meal_type: "breakfast",
        items: [{ catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 150 }],
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await screen.findByText(CATALOG_CHICKEN_NAME)).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
    expect(
      screen.getByText(`248 / ${intFormat.format(goal.kcal)} kcal`)
    ).toBeInTheDocument()
  })

  // SDD: 022 REQ-012 AC-012.2
  it("tras añadir un alimento personalizado relee el diario", async () => {
    const user = userEvent.setup()
    const dinner = makeMeal({ id: 21, meal_type: "dinner", items: [makeCustomItem()] })
    getDiaryMock.mockResolvedValueOnce(makeDiary())
    getDiaryMock.mockResolvedValue(makeDiary([dinner]))
    addMock.mockResolvedValue(dinner)
    renderPage()
    await screen.findByText("Todavía no has registrado nada hoy.")

    await user.click(screen.getAllByRole("button", { name: "Añadir alimento" })[2])
    const dialog = await screen.findByRole("dialog", { name: "Añadir a Cena" })
    await user.click(within(dialog).getByRole("button", { name: "Crear alimento personalizado" }))
    await user.type(within(dialog).getByLabelText("Nombre"), "Gallo pinto")
    await user.type(within(dialog).getByLabelText("Gramos"), "250")
    await user.type(within(dialog).getByLabelText("Calorías por 100 g (kcal)"), "160")
    await user.type(within(dialog).getByLabelText("Proteína por 100 g (g)"), "5,5")
    await user.type(within(dialog).getByLabelText("Carbohidratos por 100 g (g)"), "27")
    await user.type(within(dialog).getByLabelText("Grasa por 100 g (g)"), "3,2")
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }))

    await waitFor(() =>
      expect(addMock).toHaveBeenCalledWith({
        date: "2026-10-20",
        meal_type: "dinner",
        items: [
          {
            name: "Gallo pinto",
            grams: 250,
            per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
          },
        ],
      })
    )
    expect(await screen.findByText("Personalizado")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 022 REQ-013 AC-013.2
  // SDD: 022 REQ-014 AC-014.6
  it("tras editar los gramos de un alimento guarda el cambio y relee el diario", async () => {
    const user = userEvent.setup()
    const edited = makeMealItem({
      grams: 200,
      nutrients: { calories_kcal: 330, protein_g: 62, carbs_g: 0, fat_g: 7.14 },
    })
    getDiaryMock.mockResolvedValueOnce(lunchDiary())
    getDiaryMock.mockResolvedValue(makeDiary([makeMeal({ items: [edited] })]))
    updateMock.mockResolvedValue(makeMeal({ items: [edited] }))
    renderPage()
    await screen.findByText(CHICKEN_NAME)

    await user.click(screen.getByRole("button", { name: `Editar ${CHICKEN_NAME}` }))
    const dialog = await screen.findByRole("dialog", { name: "Editar gramos" })
    const grams = within(dialog).getByLabelText("Gramos")
    await user.clear(grams)
    await user.type(grams, "200")
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(12, 31, 200))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await screen.findByText("200 g")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 023 REQ-010 AC-010.3
  it("tras editar un alimento del catálogo a 200 g envía el cambio de gramos y relee el diario", async () => {
    const user = userEvent.setup()
    const edited = makeCatalogItem({
      grams: 200,
      nutrients: { calories_kcal: 260, protein_g: 5.4, carbs_g: 56.4, fat_g: 0.6 },
    })
    getDiaryMock.mockResolvedValueOnce(makeDiary([makeMeal({ items: [makeCatalogItem()] })]))
    getDiaryMock.mockResolvedValue(makeDiary([makeMeal({ items: [edited] })]))
    updateMock.mockResolvedValue(makeMeal({ items: [edited] }))
    renderPage()
    await screen.findByText("Arroz blanco cocido")

    await user.click(screen.getByRole("button", { name: "Editar Arroz blanco cocido" }))
    const dialog = await screen.findByRole("dialog", { name: "Editar gramos" })
    const grams = within(dialog).getByLabelText("Gramos")
    await user.clear(grams)
    await user.type(grams, "200")
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(12, 33, 200))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await screen.findByText("200 g")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
    // El alimento del catálogo no lleva etiqueta de origen, tampoco tras editarlo.
    expect(screen.queryByText("Personalizado")).not.toBeInTheDocument()
  })

  // SDD: 022 REQ-013 AC-013.4
  // SDD: 022 REQ-014 AC-014.6
  it("«Quitar» quita el alimento sin pedir confirmación y relee el diario", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValueOnce(lunchDiary())
    getDiaryMock.mockResolvedValue(makeDiary())
    removeMock.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText(CHICKEN_NAME)

    await user.click(screen.getByRole("button", { name: `Quitar ${CHICKEN_NAME}` }))

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith(12, 31))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(CHICKEN_NAME)).not.toBeInTheDocument())
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 022 REQ-013 AC-013.5
  it("si quitar falla avisa y el diario no cambia", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(lunchDiary())
    removeMock.mockRejectedValue(new ApiError(500, "boom"))
    renderPage()
    await screen.findByText(CHICKEN_NAME)

    await user.click(screen.getByRole("button", { name: `Quitar ${CHICKEN_NAME}` }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("No se pudo quitar el alimento. Vuelve a intentarlo.")
    expect(screen.getByText(CHICKEN_NAME)).toBeInTheDocument()
  })

  // SDD: 022 REQ-013 AC-013.6
  it("los botones «Editar» y «Quitar» se llaman con el nombre del alimento", async () => {
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal({ items: [makeMealItem(), makeCustomItem()] })])
    )
    renderPage()
    await screen.findByText(CHICKEN_NAME)

    expect(screen.getByRole("button", { name: `Editar ${CHICKEN_NAME}` })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: `Quitar ${CHICKEN_NAME}` })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Editar Gallo pinto" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Quitar Gallo pinto" })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Spec 025: registro de una comida con foto desde las tarjetas del diario
// ---------------------------------------------------------------------------

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

type User = ReturnType<typeof userEvent.setup>

async function openPhotoDialog(user: User, label: string) {
  await user.click(await screen.findByRole("button", { name: `Cargar imagen en ${label}` }))
  return screen.findByRole("dialog", { name: `Añadir a ${label} con una foto` })
}

async function chooseAndAnalyze(user: User, dialog: HTMLElement) {
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, makePhotoFile())
  await within(dialog).findByAltText("Vista previa de la foto")
  await user.click(within(dialog).getByRole("button", { name: "Analizar foto" }))
}

describe("DiaryPage - registro con foto", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0))
    getDiaryMock.mockReset()
    addMock.mockReset()
    searchMock.mockReset()
    analyzeMock.mockReset()
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(makeProfileResponse())
    photoHolder.processor = new FakePhotoProcessor()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 025 REQ-001 AC-001.1
  it("cada una de las cuatro tarjetas tiene «Cargar imagen» además de «Añadir alimento», con su nombre accesible", async () => {
    getDiaryMock.mockResolvedValue(makeDiary())
    renderPage()

    await screen.findByRole("heading", { level: 1, name: "Diario" })

    for (const label of ["Desayuno", "Almuerzo", "Cena", "Meriendas"]) {
      expect(screen.getByRole("button", { name: `Cargar imagen en ${label}` })).toBeInTheDocument()
    }
    expect(screen.getAllByRole("button", { name: /^Cargar imagen en / })).toHaveLength(4)
    expect(screen.getAllByRole("button", { name: "Añadir alimento" })).toHaveLength(4)
    for (const button of screen.getAllByRole("button", { name: /^Cargar imagen en / })) {
      expect(button).toHaveTextContent("Cargar imagen")
    }
  })

  // SDD: 025 REQ-001 AC-001.2
  it("«Cargar imagen en Cena» abre el diálogo de la foto de esa tarjeta", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(makeDiary())
    renderPage()

    const dialog = await openPhotoDialog(user, "Cena")

    expect(within(dialog).getByText("Añadir a Cena con una foto")).toBeInTheDocument()
    expect(within(dialog).getByText("Puedes analizar hasta 10 fotos por hora.")).toBeInTheDocument()
  })

  // SDD: 025 REQ-005 AC-005.2
  it("si se cierra con el análisis pendiente y la respuesta llega después, el diálogo sigue cerrado y no se guarda nada", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(makeDiary())
    const pending = deferred<ReturnType<typeof makeAnalysis>>()
    analyzeMock.mockReturnValue(pending.promise)
    renderPage()
    const dialog = await openPhotoDialog(user, "Cena")
    await chooseAndAnalyze(user, dialog)
    await within(dialog).findByText("Analizando la foto…")

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await act(async () => pending.resolve(makeAnalysis({ items: [RICE] })))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
    expect(getDiaryMock).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText("Sin alimentos.")).toHaveLength(4)
  })

  // SDD: 025 REQ-011 AC-011.3
  it("tras guardar la propuesta, Almuerzo muestra los dos alimentos que ya tenía y el nuevo", async () => {
    const user = userEvent.setup()
    const before = makeMeal({ items: [makeMealItem(), makeCustomItem()] })
    const after = makeMeal({ items: [makeMealItem(), makeCustomItem(), makeCatalogItem()] })
    getDiaryMock.mockResolvedValueOnce(makeDiary([before]))
    getDiaryMock.mockResolvedValue(makeDiary([after]))
    addMock.mockResolvedValue(after)
    analyzeMock.mockResolvedValue(makeAnalysis({ items: [RICE] }))
    renderPage()
    await screen.findByText(CHICKEN_NAME)
    const list = () => screen.getByRole("list", { name: "Alimentos de Almuerzo" })
    expect(within(list()).getAllByRole("listitem")).toHaveLength(2)
    const dialog = await openPhotoDialog(user, "Almuerzo")
    await chooseAndAnalyze(user, dialog)
    await within(dialog).findByRole("list", { name: "Alimentos de la propuesta" })

    await user.click(within(dialog).getByRole("button", { name: "Guardar en Almuerzo" }))

    await waitFor(() =>
      expect(addMock).toHaveBeenCalledWith({
        date: "2026-10-20",
        meal_type: "lunch",
        items: [{ catalog_id: "arroz-blanco-cocido", grams: 150 }],
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(within(list()).getAllByRole("listitem")).toHaveLength(3))
    expect(within(list()).getByText("Arroz blanco cocido")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 025 REQ-012 AC-012.7
  it.each([
    ["503", () => Promise.reject(new ApiError(503, "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."))],
    ["429", () => Promise.reject(new ApiError(429, "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."))],
    ["una respuesta sin alimentos", () => Promise.resolve(makeAnalysis({ items: [], unmatched: [] }))],
  ])("con %s, «Registrar a mano» cierra el diálogo de la foto y abre «Añadir a Cena»", async (_name, respond) => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(makeDiary())
    analyzeMock.mockImplementation(respond)
    renderPage()
    const dialog = await openPhotoDialog(user, "Cena")
    await chooseAndAnalyze(user, dialog)

    await user.click(await within(dialog).findByRole("button", { name: "Registrar a mano" }))

    expect(
      screen.queryByRole("dialog", { name: "Añadir a Cena con una foto" })
    ).not.toBeInTheDocument()
    expect(await screen.findByRole("dialog", { name: "Añadir a Cena" })).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
  })

  // SDD: 025 REQ-013 AC-013.2
  it("tras cerrar el diálogo con una propuesta, al volver a abrirlo empieza sin foto", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(makeDiary())
    analyzeMock.mockResolvedValue(makeAnalysis({ items: [RICE], unmatched: [TOMATO_SAUCE] }))
    renderPage()
    const first = await openPhotoDialog(user, "Cena")
    await chooseAndAnalyze(user, first)
    await within(first).findByRole("list", { name: "Alimentos de la propuesta" })
    await user.click(within(first).getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const second = await openPhotoDialog(user, "Cena")

    expect(within(second).queryByAltText("Vista previa de la foto")).not.toBeInTheDocument()
    expect(
      within(second).queryByRole("list", { name: "Alimentos de la propuesta" })
    ).not.toBeInTheDocument()
    expect(within(second).getByRole("button", { name: "Hacer una foto" })).toBeInTheDocument()
    expect(within(second).getByRole("button", { name: "Elegir una foto" })).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
  })
})
