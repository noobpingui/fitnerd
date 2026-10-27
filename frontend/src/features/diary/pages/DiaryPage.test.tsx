// Test de PÁGINA del «Diario» (spec 022). La red se simula en los api.ts del
// diario, de los alimentos y del perfil; la fecha de hoy se fija con
// `vi.useFakeTimers({ toFake: ["Date"] })` (martes 20 de octubre de 2026).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router"
import { ApiError } from "@/lib/apiClient"
import {
  addMealItems,
  analyzeMealPhoto,
  deleteMeal,
  getDiary,
  removeMealItem,
  restoreMealItem,
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
import type { Diary, Meal, MealItem } from "../types"
import { DiaryPage } from "./DiaryPage"

vi.mock("@/features/diary/api", () => ({
  getDiary: vi.fn(),
  addMealItems: vi.fn(),
  updateMealItemGrams: vi.fn(),
  removeMealItem: vi.fn(),
  analyzeMealPhoto: vi.fn(),
  restoreMealItem: vi.fn(),
  deleteMeal: vi.fn(),
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
const restoreMock = vi.mocked(restoreMealItem)
const deleteMock = vi.mocked(deleteMeal)
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
    removeMock.mockResolvedValue(null)
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
  // SDD: 026 REQ-009 AC-009.2
  it("tras cerrar el diálogo con una propuesta, al volver a abrirlo empieza sin foto", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(makeDiary())
    analyzeMock.mockResolvedValue(makeAnalysis({ items: [RICE], unmatched: [TOMATO_SAUCE] }))
    renderPage()
    const first = await openPhotoDialog(user, "Cena")
    await chooseAndAnalyze(user, first)
    await within(first).findByRole("list", { name: "Alimentos de la propuesta" })
    await user.click(within(first).getByRole("button", { name: "Cancelar" }))
    const confirmation = await screen.findByRole("alertdialog", {
      name: "¿Descartar la propuesta?",
    })
    await user.click(within(confirmation).getByRole("button", { name: "Descartar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

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

// ---------------------------------------------------------------------------
// Spec 026: navegar entre días, editar días pasados, borrar, deshacer y barras
// ---------------------------------------------------------------------------

// Hoy es el lunes 26 de octubre de 2026 en todos los tests de esta parte.
const TODAY = "2026-10-26"

function dayOf(date: string, meals: Meal[] = []): Diary {
  return makeDiary(meals, { date })
}

function mealOn(date: string, overrides: Partial<Meal> = {}): Meal {
  return makeMeal({ date, ...overrides })
}

type TestRouter = ReturnType<typeof createMemoryRouter>

// La pantalla bajo un router de verdad, para leer y cambiar la dirección.
function renderAt(entries: string[] = ["/diary"], initialIndex?: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      { path: "/diary", element: <DiaryPage /> },
      { path: "/home", element: <p>Inicio</p> },
    ],
    { initialEntries: entries, initialIndex }
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router }
}

function whereIs(router: TestRouter): string {
  return `${router.state.location.pathname}${router.state.location.search}`
}

// Con `setInterval` falso, `findBy` y `waitFor` se cuelgan: se deja pasar el tiempo real.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
}

function setUpDay26() {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 26, 12, 0))
  getDiaryMock.mockReset()
  addMock.mockReset()
  updateMock.mockReset()
  removeMock.mockReset()
  restoreMock.mockReset()
  deleteMock.mockReset()
  searchMock.mockReset()
  analyzeMock.mockReset()
  getProfileMock.mockReset()
  getProfileMock.mockResolvedValue(makeProfileResponse())
  getDiaryMock.mockImplementation(async (date) => dayOf(date))
  photoHolder.processor = new FakePhotoProcessor()
}

describe("DiaryPage - navegar entre días (REQ-002)", () => {
  beforeEach(setUpDay26)

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 026 REQ-002 AC-002.1
  it("«Día anterior» muestra «domingo, 25 de octubre», pide ese día y pinta sus comidas y totales", async () => {
    const user = userEvent.setup()
    const goal = targets()
    getDiaryMock.mockImplementation(async (date) =>
      date === "2026-10-25" ? dayOf(date, [mealOn(date)]) : dayOf(date)
    )
    renderAt()
    await screen.findByText("lunes, 26 de octubre")
    await screen.findByText("Todavía no has registrado nada hoy.")

    await user.click(screen.getByRole("button", { name: "Día anterior" }))

    expect(await screen.findByText("domingo, 25 de octubre")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-25")
    expect(await screen.findByText(CHICKEN_NAME)).toBeInTheDocument()
    expect(screen.getByText(`248 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
  })

  // SDD: 026 REQ-002 AC-002.2
  it("«Día siguiente» desde el 25 muestra «lunes, 26 de octubre» y pide el 26", async () => {
    const user = userEvent.setup()
    renderAt(["/diary?date=2026-10-25"])
    await screen.findByText("domingo, 25 de octubre")
    await screen.findByText("No hay nada registrado este día.")

    await user.click(screen.getByRole("button", { name: "Día siguiente" }))

    expect(await screen.findByText("lunes, 26 de octubre")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-26")
  })

  // SDD: 026 REQ-002 AC-002.4
  it("«Hoy» vuelve al día de hoy y desaparece", async () => {
    const user = userEvent.setup()
    renderAt(["/diary?date=2026-10-20"])
    await screen.findByText("martes, 20 de octubre")

    await user.click(await screen.findByRole("button", { name: "Hoy" }))

    expect(await screen.findByText("lunes, 26 de octubre")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledWith(TODAY)
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Día siguiente" })).toBeDisabled()
  })

  // SDD: 026 REQ-002 AC-002.7
  it("un día del año pasado se ve con el año y los del año en curso, sin él", async () => {
    renderAt(["/diary?date=2025-12-31"])

    expect(await screen.findByText("miércoles, 31 de diciembre de 2025")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledWith("2025-12-31")
    expect(screen.queryByText("lunes, 26 de octubre")).not.toBeInTheDocument()
  })

  // SDD: 026 REQ-002 AC-002.8
  it("un día pasado sin comidas dice «No hay nada registrado este día.» y no el texto de hoy", async () => {
    renderAt(["/diary?date=2026-10-20"])

    expect(await screen.findByText("No hay nada registrado este día.")).toBeInTheDocument()
    expect(screen.queryByText("Todavía no has registrado nada hoy.")).not.toBeInTheDocument()
  })

  // Guarda de regresión de la 022: pasa sin implementar la 026.
  // SDD: 026 REQ-002 AC-002.8
  it("hoy sin comidas sigue diciendo «Todavía no has registrado nada hoy.»", async () => {
    renderAt()

    expect(await screen.findByText("Todavía no has registrado nada hoy.")).toBeInTheDocument()
    expect(screen.queryByText("No hay nada registrado este día.")).not.toBeInTheDocument()
  })

  // SDD: 026 REQ-002 AC-002.9
  it("si la respuesta de un día llega tarde, nunca se pintan sus datos en otro día", async () => {
    const user = userEvent.setup()
    const late = deferred<Diary>()
    const early = deferred<Diary>()
    getDiaryMock.mockImplementation((date) => {
      if (date === "2026-10-25") return late.promise
      if (date === "2026-10-24") return early.promise
      return Promise.resolve(dayOf(date))
    })
    renderAt(["/diary?date=2026-10-25"])
    await screen.findByText("Cargando el diario…")

    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await waitFor(() => expect(getDiaryMock).toHaveBeenCalledWith("2026-10-24"))
    await act(async () => early.resolve(dayOf("2026-10-24", [mealOn("2026-10-24")])))
    expect(await screen.findByText(CHICKEN_NAME)).toBeInTheDocument()
    await act(async () =>
      late.resolve(
        dayOf("2026-10-25", [mealOn("2026-10-25", { items: [makeCustomItem()] })])
      )
    )

    expect(screen.getByText("sábado, 24 de octubre")).toBeInTheDocument()
    expect(screen.getByText(CHICKEN_NAME)).toBeInTheDocument()
    expect(screen.queryByText("Gallo pinto")).not.toBeInTheDocument()
    expect(screen.queryByText("domingo, 25 de octubre")).not.toBeInTheDocument()
  })

  // SDD: 026 REQ-002 AC-002.10
  it("mientras carga, el título, la fecha y los controles de navegación siguen visibles y usables", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockReturnValue(new Promise<Diary>(() => {}))
    renderAt(["/diary?date=2026-10-20"])

    expect(await screen.findByText("Cargando el diario…")).toBeInTheDocument()

    expect(screen.getByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(screen.getByText("martes, 20 de octubre")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Día anterior" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Día siguiente" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Hoy" })).toBeEnabled()
    expect(screen.getByLabelText("Elegir día")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-19")
  })

  // SDD: 026 REQ-002 AC-002.10
  it("si la carga falla, los controles siguen visibles junto al error y a «Reintentar»", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockRejectedValue(new ApiError(500, "boom"))
    renderAt(["/diary?date=2026-10-20"])

    expect(await screen.findByText("No se pudo cargar el diario.")).toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument()
    expect(screen.getByText("martes, 20 de octubre")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Día anterior" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await waitFor(() => expect(getDiaryMock).toHaveBeenCalledWith("2026-10-19"))
    expect(await screen.findByText("lunes, 19 de octubre")).toBeInTheDocument()
  })
})

describe("DiaryPage - el día en la dirección (REQ-003)", () => {
  beforeEach(setUpDay26)

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 026 REQ-003 AC-003.1
  it("`/diary?date=2026-10-20` abre el martes 20 de octubre y pide ese día", async () => {
    renderAt(["/diary?date=2026-10-20"])

    expect(await screen.findByText("martes, 20 de octubre")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-20")
    expect(getDiaryMock).not.toHaveBeenCalledWith(TODAY)
  })

  // SDD: 026 REQ-003 AC-003.2
  it("al cambiar de día la dirección lleva `?date=`, y al volver a hoy queda `/diary` sin parámetro", async () => {
    const user = userEvent.setup()
    const { router } = renderAt()
    await screen.findByText("lunes, 26 de octubre")
    expect(whereIs(router)).toBe("/diary")

    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await screen.findByText("domingo, 25 de octubre")
    expect(whereIs(router)).toBe("/diary?date=2026-10-25")

    await user.click(screen.getByRole("button", { name: "Día siguiente" }))
    await screen.findByText("lunes, 26 de octubre")
    expect(whereIs(router)).toBe("/diary")
  })

  // SDD: 026 REQ-003 AC-003.2
  it("«Hoy» deja la dirección en `/diary`", async () => {
    const user = userEvent.setup()
    const { router } = renderAt(["/diary?date=2026-10-20"])
    await screen.findByText("martes, 20 de octubre")

    await user.click(screen.getByRole("button", { name: "Hoy" }))

    await screen.findByText("lunes, 26 de octubre")
    expect(whereIs(router)).toBe("/diary")
  })

  // SDD: 026 REQ-003 AC-003.3
  it.each(["2026-02-30", "ayer", "2026-10-27", "2025-10-25", "2026-10-26"])(
    "`?date=%s` (inválido, fuera del intervalo o igual a hoy) muestra hoy y deja la dirección en `/diary`",
    async (param) => {
      const { router } = renderAt([`/diary?date=${param}`])

      expect(await screen.findByText("lunes, 26 de octubre")).toBeInTheDocument()
      await waitFor(() => expect(whereIs(router)).toBe("/diary"))
      expect(getDiaryMock).toHaveBeenCalledWith(TODAY)
      expect(getDiaryMock).toHaveBeenCalledTimes(1)
    }
  )

  // SDD: 026 REQ-003 AC-003.4
  it("cambiar de día no añade entradas al historial: «Atrás» sale del diario", async () => {
    const user = userEvent.setup()
    const { router } = renderAt(["/home", "/diary?date=2026-10-20"], 1)
    await screen.findByText("martes, 20 de octubre")

    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await screen.findByText("lunes, 19 de octubre")
    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await screen.findByText("domingo, 18 de octubre")
    expect(whereIs(router)).toBe("/diary?date=2026-10-18")
    await act(async () => {
      await router.navigate(-1)
    })

    expect(router.state.location.pathname).toBe("/home")
    expect(await screen.findByText("Inicio")).toBeInTheDocument()
  })
})

describe("DiaryPage - editar un día pasado (REQ-004)", () => {
  beforeEach(setUpDay26)

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 026 REQ-004 AC-004.1
  it("añadir un alimento del catálogo a Cena de un día pasado guarda con esa fecha y relee ese día", async () => {
    const user = userEvent.setup()
    const goal = targets()
    const dinner = mealOn("2026-10-20", { id: 21, meal_type: "dinner", items: [CATALOG_CHICKEN_ITEM] })
    getDiaryMock.mockResolvedValueOnce(dayOf("2026-10-20"))
    getDiaryMock.mockResolvedValue(dayOf("2026-10-20", [dinner]))
    addMock.mockResolvedValue(dinner)
    searchMock.mockResolvedValue({ results: [CATALOG_CHICKEN] })
    renderAt(["/diary?date=2026-10-20"])
    await screen.findByText(`0 / ${intFormat.format(goal.kcal)} kcal`)

    await user.click(screen.getAllByRole("button", { name: "Añadir alimento" })[2])
    const dialog = await screen.findByRole("dialog", { name: "Añadir a Cena" })
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
        meal_type: "dinner",
        items: [{ catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 150 }],
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await screen.findByText(CATALOG_CHICKEN_NAME)).toBeInTheDocument()
    expect(screen.getByText(`248 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
    expect(getDiaryMock.mock.calls.every(([date]) => date === "2026-10-20")).toBe(true)
    expect(getDiaryMock).toHaveBeenCalledTimes(2)
  })

  // SDD: 026 REQ-004 AC-004.2
  it("guardar la propuesta de una foto en Almuerzo de un día pasado la guarda en ese día", async () => {
    const user = userEvent.setup()
    const lunch = mealOn("2026-10-20", { items: [makeCatalogItem()] })
    getDiaryMock.mockResolvedValueOnce(dayOf("2026-10-20"))
    getDiaryMock.mockResolvedValue(dayOf("2026-10-20", [lunch]))
    addMock.mockResolvedValue(lunch)
    analyzeMock.mockResolvedValue(makeAnalysis({ items: [RICE] }))
    renderAt(["/diary?date=2026-10-20"])
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
    expect(await screen.findByText("Arroz blanco cocido")).toBeInTheDocument()
  })

  // SDD: 026 REQ-004 AC-004.3
  it("editar los gramos de un alimento de un día pasado cambia solo ese día", async () => {
    const user = userEvent.setup()
    const edited = makeMealItem({
      grams: 200,
      nutrients: { calories_kcal: 330, protein_g: 62, carbs_g: 0, fat_g: 7.14 },
    })
    getDiaryMock.mockResolvedValueOnce(dayOf("2026-10-20", [mealOn("2026-10-20")]))
    getDiaryMock.mockResolvedValue(dayOf("2026-10-20", [mealOn("2026-10-20", { items: [edited] })]))
    updateMock.mockResolvedValue(mealOn("2026-10-20", { items: [edited] }))
    renderAt(["/diary?date=2026-10-20"])
    await screen.findByText(CHICKEN_NAME)

    await user.click(screen.getByRole("button", { name: `Editar ${CHICKEN_NAME}` }))
    const dialog = await screen.findByRole("dialog", { name: "Editar gramos" })
    const grams = within(dialog).getByLabelText("Gramos")
    await user.clear(grams)
    await user.type(grams, "200")
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(12, 31, 200))
    expect(await screen.findByText("200 g")).toBeInTheDocument()
    expect(getDiaryMock.mock.calls.every(([date]) => date === "2026-10-20")).toBe(true)
    expect(getDiaryMock).not.toHaveBeenCalledWith(TODAY)
  })

  // SDD: 026 REQ-004 AC-004.3
  it("quitar un alimento de un día pasado relee solo ese día", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValueOnce(dayOf("2026-10-20", [mealOn("2026-10-20")]))
    getDiaryMock.mockResolvedValue(dayOf("2026-10-20"))
    removeMock.mockResolvedValue(null)
    renderAt(["/diary?date=2026-10-20"])
    await screen.findByText(CHICKEN_NAME)

    await user.click(screen.getByRole("button", { name: `Quitar ${CHICKEN_NAME}` }))

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith(12, 31))
    await waitFor(() => expect(screen.queryByText(CHICKEN_NAME)).not.toBeInTheDocument())
    expect(getDiaryMock.mock.calls.every(([date]) => date === "2026-10-20")).toBe(true)
    expect(getDiaryMock).not.toHaveBeenCalledWith(TODAY)
  })

  // SDD: 026 REQ-004 AC-004.4
  it("si el servidor rechaza la fecha, el diálogo muestra el mensaje del servidor y no se cierra", async () => {
    const user = userEvent.setup()
    const message = "Solo puedes registrar comidas de hoy o del último año."
    addMock.mockRejectedValue(new ApiError(400, message))
    searchMock.mockResolvedValue({ results: [CATALOG_CHICKEN] })
    renderAt(["/diary?date=2026-10-20"])
    await screen.findByText("No hay nada registrado este día.")

    await user.click(screen.getAllByRole("button", { name: "Añadir alimento" })[2])
    const dialog = await screen.findByRole("dialog", { name: "Añadir a Cena" })
    await user.type(within(dialog).getByRole("searchbox", { name: "Buscar alimento" }), "pollo")
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }))
    await user.click(
      await within(dialog).findByRole("button", { name: `Elegir ${CATALOG_CHICKEN_NAME}` })
    )
    const grams = within(dialog).getByLabelText("Gramos")
    await user.clear(grams)
    await user.type(grams, "150")
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }))

    expect(await within(dialog).findByText(message)).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Añadir a Cena" })).toBeInTheDocument()
  })
})

describe("DiaryPage - cambio de día a medianoche (REQ-005)", () => {
  beforeEach(() => {
    setUpDay26()
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    vi.setSystemTime(new Date(2026, 9, 26, 23, 59, 30))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function pastMidnight() {
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    await settle()
  }

  // SDD: 026 REQ-005 AC-005.1
  it("viendo hoy, al pasar la medianoche muestra el martes 27 y pide ese día", async () => {
    renderAt()
    await settle()
    expect(screen.getByText("lunes, 26 de octubre")).toBeInTheDocument()

    await pastMidnight()

    expect(screen.getByText("martes, 27 de octubre")).toBeInTheDocument()
    expect(getDiaryMock).toHaveBeenCalledWith("2026-10-27")
  })

  // SDD: 026 REQ-005 AC-005.3
  it("viendo otro día, se queda en él y «Día siguiente» llega hasta el nuevo hoy", async () => {
    const user = userEvent.setup()
    renderAt(["/diary?date=2026-10-25"])
    await settle()
    expect(screen.getByText("domingo, 25 de octubre")).toBeInTheDocument()

    await pastMidnight()

    expect(screen.getByText("domingo, 25 de octubre")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Día siguiente" }))
    await settle()
    expect(screen.getByText("lunes, 26 de octubre")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Día siguiente" }))
    await settle()
    expect(screen.getByText("martes, 27 de octubre")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Día siguiente" })).toBeDisabled()
  })

  // SDD: 026 REQ-005 AC-005.4
  it("con «Añadir a Cena» abierto, la medianoche no lo cierra y guarda con la fecha en que se abrió", async () => {
    const user = userEvent.setup()
    const dinner = mealOn(TODAY, { id: 21, meal_type: "dinner", items: [CATALOG_CHICKEN_ITEM] })
    addMock.mockResolvedValue(dinner)
    searchMock.mockResolvedValue({ results: [CATALOG_CHICKEN] })
    renderAt()
    await settle()
    await user.click(screen.getAllByRole("button", { name: "Añadir alimento" })[2])
    await settle()
    expect(screen.getByRole("dialog", { name: "Añadir a Cena" })).toBeInTheDocument()

    await pastMidnight()

    const dialog = screen.getByRole("dialog", { name: "Añadir a Cena" })
    expect(dialog).toBeInTheDocument()
    expect(addMock).not.toHaveBeenCalled()
    await user.type(within(dialog).getByRole("searchbox", { name: "Buscar alimento" }), "pollo")
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }))
    await settle()
    await user.click(within(dialog).getByRole("button", { name: `Elegir ${CATALOG_CHICKEN_NAME}` }))
    const grams = within(dialog).getByLabelText("Gramos")
    await user.clear(grams)
    await user.type(grams, "150")
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }))
    await settle()

    expect(addMock).toHaveBeenCalledWith({
      date: "2026-10-26",
      meal_type: "dinner",
      items: [{ catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 150 }],
    })

    // Al cerrarse el diálogo, la página pasa al nuevo día (depende de useToday).
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Añadir a Cena" })).not.toBeInTheDocument())
    await settle()
    expect(screen.getByText("martes, 27 de octubre")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REQ-006: borrar una comida entera
// ---------------------------------------------------------------------------

const ARROZ = makeCustomItem({ id: 51, name: "Arroz con pollo" })
const ENSALADA = makeCustomItem({ id: 52, name: "Ensalada mixta" })
const FLAN = makeCustomItem({ id: 53, name: "Flan de huevo" })

describe("DiaryPage - borrar una comida (REQ-006)", () => {
  beforeEach(setUpDay26)

  afterEach(() => {
    vi.useRealTimers()
  })

  function dinnerWithThree(): Meal {
    return mealOn(TODAY, { id: 30, meal_type: "dinner", items: [ARROZ, ENSALADA, FLAN] })
  }

  // SDD: 026 REQ-006 AC-006.1
  it("una sección con alimentos tiene «Borrar comida» llamado «Borrar Cena»; las vacías no", async () => {
    getDiaryMock.mockResolvedValue(dayOf(TODAY, [dinnerWithThree()]))
    renderAt()
    await screen.findByText("Arroz con pollo")

    const button = screen.getByRole("button", { name: "Borrar Cena" })

    expect(button).toHaveTextContent("Borrar comida")
    expect(screen.getAllByRole("button", { name: /^Borrar / })).toHaveLength(1)
  })

  // SDD: 026 REQ-006 AC-006.1
  it("un día sin comidas no muestra ningún «Borrar comida»", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockImplementation(async (date) =>
      date === "2026-10-25" ? dayOf(date, [dinnerWithThree()]) : dayOf(date)
    )
    renderAt()
    await screen.findByText("Todavía no has registrado nada hoy.")

    expect(screen.queryByRole("button", { name: /^Borrar / })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await screen.findByText("Arroz con pollo")
    expect(screen.getByRole("button", { name: "Borrar Cena" })).toBeInTheDocument()
  })

  // SDD: 026 REQ-006 AC-006.3
  it("confirmar el borrado vacía la sección y pone los totales a cero", async () => {
    const user = userEvent.setup()
    const goal = targets()
    getDiaryMock.mockResolvedValueOnce(dayOf(TODAY, [dinnerWithThree()]))
    getDiaryMock.mockResolvedValue(dayOf(TODAY))
    deleteMock.mockResolvedValue(undefined)
    renderAt()
    await screen.findByText(`${intFormat.format(1200)} / ${intFormat.format(goal.kcal)} kcal`)

    await user.click(screen.getByRole("button", { name: "Borrar Cena" }))
    const confirmation = await screen.findByRole("alertdialog", { name: "¿Borrar Cena?" })
    await user.click(within(confirmation).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(30))
    await waitFor(() => expect(screen.queryByText("Arroz con pollo")).not.toBeInTheDocument())
    expect(screen.getAllByText("Sin alimentos.")).toHaveLength(4)
    expect(screen.getByText(`0 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  // SDD: 026 REQ-006 AC-006.3
  it("cancelar la confirmación no borra nada", async () => {
    const user = userEvent.setup()
    getDiaryMock.mockResolvedValue(dayOf(TODAY, [dinnerWithThree()]))
    renderAt()
    await screen.findByText("Arroz con pollo")

    await user.click(screen.getByRole("button", { name: "Borrar Cena" }))
    const confirmation = await screen.findByRole("alertdialog", { name: "¿Borrar Cena?" })
    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(deleteMock).not.toHaveBeenCalled()
    expect(screen.getByText("Arroz con pollo")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REQ-007: deshacer al quitar un alimento
// ---------------------------------------------------------------------------

const AVENA = makeCustomItem({
  id: 41,
  name: "Avena cocida",
  grams: 100,
  nutrients: { calories_kcal: 150, protein_g: 5, carbs_g: 27, fat_g: 3 },
})
const PLATANO = makeCustomItem({
  id: 42,
  name: "Plátano",
  grams: 120,
  nutrients: { calories_kcal: 105, protein_g: 1, carbs_g: 27, fat_g: 0.4 },
})
const LECHE = makeCustomItem({
  id: 43,
  name: "Leche entera",
  grams: 200,
  nutrients: { calories_kcal: 120, protein_g: 6, carbs_g: 9, fat_g: 6 },
})

// Un servidor de mentira con estado: «quitar» saca el alimento y «deshacer» devuelve los originales.
function setUpUndo(initial: MealItem[], mealType: Meal["meal_type"] = "breakfast") {
  const state = { items: [...initial] }
  const meal = () =>
    state.items.length > 0
      ? [mealOn(TODAY, { id: 20, meal_type: mealType, items: state.items })]
      : []
  getDiaryMock.mockImplementation(async (date) => dayOf(date, date === TODAY ? meal() : []))
  removeMock.mockImplementation(async (_mealId, itemId) => {
    state.items = state.items.filter((item) => item.id !== itemId)
    return `tok-${itemId}`
  })
  restoreMock.mockImplementation(async () => {
    state.items = [...initial]
    return mealOn(TODAY, { id: 20, meal_type: mealType, items: initial })
  })
  return state
}

function noticeRegion(text: string): HTMLElement {
  return screen.getByText(text).closest('[role="status"]') as HTMLElement
}

describe("DiaryPage - deshacer al quitar (REQ-007)", () => {
  beforeEach(setUpDay26)

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 026 REQ-007 AC-007.1
  // SDD: 026 NFR-001 AC-N001.2
  it("quitar un alimento lo saca de la lista, actualiza los totales y avisa «Quitaste Plátano.» con «Deshacer» sin mover el foco", async () => {
    const user = userEvent.setup()
    const goal = targets()
    setUpUndo([AVENA, PLATANO, LECHE])
    renderAt()
    await screen.findByText(`375 / ${intFormat.format(goal.kcal)} kcal`)

    await user.click(screen.getByRole("button", { name: "Quitar Plátano" }))

    expect(await screen.findByText("Quitaste Plátano.")).toBeInTheDocument()
    const status = noticeRegion("Quitaste Plátano.")
    expect(status).not.toBeNull()
    expect(within(status).getByRole("button", { name: "Deshacer" })).toBeEnabled()
    expect(status.closest('[data-slot="card"]')).toHaveTextContent("Desayuno")
    await waitFor(() =>
      expect(screen.getByText(`270 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
    )
    const list = screen.getByRole("list", { name: "Alimentos de Desayuno" })
    expect(within(list).queryByText("Plátano")).not.toBeInTheDocument()
    expect(status.contains(document.activeElement)).toBe(false)
    expect(removeMock).toHaveBeenCalledWith(20, 42)
  })

  // SDD: 026 REQ-007 AC-007.2
  it("el alimento sigue quitado al volver a leer el diario del servidor", async () => {
    const user = userEvent.setup()
    setUpUndo([AVENA, PLATANO, LECHE])
    renderAt()
    await screen.findByText("Plátano")

    await user.click(screen.getByRole("button", { name: "Quitar Plátano" }))
    await screen.findByText("Quitaste Plátano.")
    await user.click(screen.getByRole("button", { name: "Día anterior" }))
    await screen.findByText("domingo, 25 de octubre")
    await user.click(screen.getByRole("button", { name: "Hoy" }))

    await screen.findByText("Avena cocida")
    expect(screen.queryByText("Plátano")).not.toBeInTheDocument()
    expect(restoreMock).not.toHaveBeenCalled()
  })

  // SDD: 026 REQ-007 AC-007.3
  it("«Deshacer» devuelve el alimento entre sus vecinos, restaura los totales y retira el aviso", async () => {
    const user = userEvent.setup()
    const goal = targets()
    setUpUndo([AVENA, PLATANO, LECHE])
    renderAt()
    await screen.findByText(`375 / ${intFormat.format(goal.kcal)} kcal`)
    await user.click(screen.getByRole("button", { name: "Quitar Plátano" }))
    await screen.findByText("Quitaste Plátano.")

    await user.click(screen.getByRole("button", { name: "Deshacer" }))

    await waitFor(() => expect(restoreMock).toHaveBeenCalledWith("tok-42"))
    await waitFor(() => expect(screen.queryByText("Quitaste Plátano.")).not.toBeInTheDocument())
    const items = within(screen.getByRole("list", { name: "Alimentos de Desayuno" })).getAllByRole(
      "listitem"
    )
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent("Avena cocida")
    expect(items[1]).toHaveTextContent("Plátano")
    expect(items[1]).toHaveTextContent("120 g")
    expect(items[2]).toHaveTextContent("Leche entera")
    expect(screen.getByText(`375 / ${intFormat.format(goal.kcal)} kcal`)).toBeInTheDocument()
  })

  // SDD: 026 REQ-007 AC-007.5
  it("quitar el único alimento de Cena y deshacer vuelve a mostrar la cena con ese alimento", async () => {
    const user = userEvent.setup()
    setUpUndo([makeCustomItem({ id: 60 })], "dinner")
    renderAt()
    await screen.findByText("Gallo pinto")

    await user.click(screen.getByRole("button", { name: "Quitar Gallo pinto" }))

    expect(await screen.findByText("Quitaste Gallo pinto.")).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Alimentos de Cena" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Deshacer" }))

    const list = await screen.findByRole("list", { name: "Alimentos de Cena" })
    expect(within(list).getByText("Gallo pinto")).toBeInTheDocument()
    expect(restoreMock).toHaveBeenCalledWith("tok-60")
  })

  // SDD: 026 REQ-007 AC-007.7
  it("quitar un segundo alimento sustituye el aviso y solo queda un «Deshacer»", async () => {
    const user = userEvent.setup()
    setUpUndo([AVENA, PLATANO, LECHE])
    renderAt()
    await screen.findByText("Plátano")
    await user.click(screen.getByRole("button", { name: "Quitar Plátano" }))
    await screen.findByText("Quitaste Plátano.")

    await user.click(screen.getByRole("button", { name: "Quitar Leche entera" }))

    expect(await screen.findByText("Quitaste Leche entera.")).toBeInTheDocument()
    expect(screen.queryByText("Quitaste Plátano.")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Deshacer" })).toHaveLength(1)
  })

  // SDD: 026 REQ-007 AC-007.8
  it("cambiar de día retira el aviso y el alimento queda quitado", async () => {
    const user = userEvent.setup()
    setUpUndo([AVENA, PLATANO, LECHE])
    renderAt()
    await screen.findByText("Plátano")
    await user.click(screen.getByRole("button", { name: "Quitar Plátano" }))
    await screen.findByText("Quitaste Plátano.")

    await user.click(screen.getByRole("button", { name: "Día anterior" }))

    await screen.findByText("domingo, 25 de octubre")
    expect(screen.queryByText("Quitaste Plátano.")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument()
    expect(restoreMock).not.toHaveBeenCalled()
  })

  // SDD: 026 REQ-007 AC-007.10
  it("si la comida ya tiene 50 alimentos, «Deshacer» muestra el mensaje del servidor y conserva el aviso", async () => {
    const user = userEvent.setup()
    setUpUndo([AVENA, PLATANO, LECHE])
    restoreMock.mockRejectedValue(
      new ApiError(400, "Una comida no puede tener más de 50 alimentos.")
    )
    renderAt()
    await screen.findByText("Plátano")
    await user.click(screen.getByRole("button", { name: "Quitar Plátano" }))
    await screen.findByText("Quitaste Plátano.")

    await user.click(screen.getByRole("button", { name: "Deshacer" }))

    expect(
      await screen.findByText("Una comida no puede tener más de 50 alimentos.")
    ).toBeInTheDocument()
    expect(screen.getByText("Quitaste Plátano.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// REQ-008: barras en ámbar al superar el objetivo
// ---------------------------------------------------------------------------

const BAR_NAMES = ["Calorías", "Proteína", "Carbohidratos", "Grasa"] as const

function bar(name: string): HTMLElement {
  return screen.getByRole("progressbar", { name })
}

function indicator(name: string): HTMLElement {
  return bar(name).firstElementChild as HTMLElement
}

describe("DiaryPage - barras al superar el objetivo (REQ-008)", () => {
  beforeEach(setUpDay26)

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: 026 REQ-008 AC-008.1
  // SDD: 026 REQ-008 AC-008.2
  it("superar el objetivo marca las cuatro barras llenas y en ámbar, con su texto «por encima del objetivo»", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: {
          calories_kcal: goal.kcal + 150,
          protein_g: goal.protein + 10,
          carbs_g: goal.carbs + 10,
          fat_g: goal.fat + 3,
        },
      })
    )
    renderAt()

    expect(
      await screen.findByText(
        `${intFormat.format(goal.kcal + 150)} / ${intFormat.format(goal.kcal)} kcal`
      )
    ).toBeInTheDocument()

    expect(screen.getByText("150 kcal por encima del objetivo")).toBeInTheDocument()
    expect(screen.getAllByText(/por encima del objetivo/)).toHaveLength(4)
    for (const name of BAR_NAMES) {
      expect(bar(name)).toHaveAttribute("data-over", "true")
      expect(bar(name)).toHaveAttribute("aria-valuenow", "100")
      expect(indicator(name)).toHaveClass("bg-amber-500")
      expect(indicator(name)).not.toHaveClass("bg-primary")
    }
  })

  // Guarda de regresión de la 022: pasa sin implementar la 026.
  // SDD: 026 REQ-008 AC-008.3
  it("igualar el objetivo usa el color principal y dice «Quedan 0 kcal»", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: { calories_kcal: goal.kcal, protein_g: goal.protein, carbs_g: 1, fat_g: 1 },
      })
    )
    renderAt()

    expect(
      await screen.findByText(`${intFormat.format(goal.kcal)} / ${intFormat.format(goal.kcal)} kcal`)
    ).toBeInTheDocument()

    expect(screen.getByText("Quedan 0 kcal")).toBeInTheDocument()
    expect(screen.queryByText(/por encima del objetivo/)).not.toBeInTheDocument()
    for (const name of BAR_NAMES) {
      expect(bar(name)).not.toHaveAttribute("data-over", "true")
      expect(indicator(name)).toHaveClass("bg-primary")
      expect(indicator(name)).not.toHaveClass("bg-amber-500")
    }
  })

  // Guarda de regresión de la 022: pasa sin implementar la 026.
  // SDD: 026 REQ-008 AC-008.3
  it("por debajo del objetivo las cuatro barras usan el color principal", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: { calories_kcal: 650, protein_g: 45, carbs_g: 80.5, fat_g: 20 },
      })
    )
    renderAt()
    await screen.findByText(`650 / ${intFormat.format(goal.kcal)} kcal`)

    for (const name of BAR_NAMES) {
      expect(indicator(name)).toHaveClass("bg-primary")
      expect(indicator(name)).not.toHaveClass("bg-amber-500")
    }
  })

  // SDD: 026 REQ-008 AC-008.1
  it("solo la barra del nutriente que supera el objetivo se pone en ámbar", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: { calories_kcal: 650, protein_g: goal.protein + 10, carbs_g: 80, fat_g: 20 },
      })
    )
    renderAt()
    await screen.findByText(`650 / ${intFormat.format(goal.kcal)} kcal`)

    expect(indicator("Proteína")).toHaveClass("bg-amber-500")
    expect(bar("Proteína")).toHaveAttribute("data-over", "true")
    for (const name of ["Calorías", "Carbohidratos", "Grasa"]) {
      expect(indicator(name)).toHaveClass("bg-primary")
    }
  })

  // Guarda de regresión de la 022: pasa sin implementar la 026.
  // SDD: 026 REQ-008 AC-008.4
  it("superar el objetivo no crea ninguna alerta ni usa el color de error", async () => {
    const goal = targets()
    getDiaryMock.mockResolvedValue(
      makeDiary([makeMeal()], {
        totals: {
          calories_kcal: goal.kcal + 150,
          protein_g: goal.protein + 10,
          carbs_g: goal.carbs + 10,
          fat_g: goal.fat + 3,
        },
      })
    )
    renderAt()
    await screen.findByText("150 kcal por encima del objetivo")

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(document.body.querySelector(".text-destructive")).toBeNull()
    expect(document.body.querySelector(".bg-destructive")).toBeNull()
    for (const name of BAR_NAMES) {
      expect(indicator(name).className).not.toMatch(/destructive|red-/)
    }
  })
})
