// Test de PÁGINA del home (feature 006): se calcula con el perfil del
// servidor. La red se simula en api.ts de profile (vi.mock).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { getProfile } from "@/features/profile/api"
import { HomePage } from "./HomePage"
import { makeProfileResponse } from "@/test/profileFixtures"

vi.mock("@/features/profile/api", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("HomePage - perfil del servidor", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-012 AC-012.1
  it("muestra la meta y el objetivo calórico del perfil, sin las tarjetas de peso y actividad", async () => {
    // Hombre, 27 años (nació el 12-10-1998), 175 cm, 160 lb (72,57 kg),
    // actividad moderada, perder peso (x0,8):
    // (725,75 + 1093,75 - 135 + 5) * 1,375 * 0,8 = 1858 kcal.
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1998-10-12" },
        { weight_unit: "lb", weight: 160, goal: "lose", activity_level: "moderate" }
      )
    )
    renderPage()

    expect(await screen.findByText("Meta: Perder peso")).toBeInTheDocument()
    expect(screen.getByText(/1\.?858/)).toBeInTheDocument()
    // Las tarjetas de peso actual y actividad ya no están en el home.
    expect(screen.queryByText("Peso actual")).not.toBeInTheDocument()
    expect(screen.queryByText("Actividad")).not.toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.4
  it("muestra 3379 kcal y los gramos con el tope de proteína a 120 kg", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1996-01-01" },
        { height_cm: 180, weight: 120, activity_level: "high", goal: "maintain" }
      )
    )
    renderPage()

    const card = (await screen.findByText("Objetivo de hoy")).parentElement
    expect(card).toHaveTextContent(/3\.?379/)
    expect(screen.getByText("459 g")).toBeInTheDocument()
    expect(screen.getByText("175 g")).toBeInTheDocument()
    expect(screen.getByText("94 g")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.5
  it("muestra 1200 kcal cuando se aplica el suelo calórico", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1976-01-01" },
        {
          gender: "female",
          height_cm: 160,
          weight: 60,
          activity_level: "low",
          goal: "lose",
        }
      )
    )
    renderPage()

    const card = (await screen.findByText("Objetivo de hoy")).parentElement
    expect(card).toHaveTextContent(/1\.?200/)
  })
})

// Nota: el AC-009.4 de la 033 (saludo actualizado tras guardar el nombre en
// /profile sin otra lectura del perfil) se prueba en
// features/profile/pages/ProfilePage.test.tsx (marcador «SDD: 033 REQ-009 AC-009.4»).
describe("HomePage - saludo con el nombre (spec 033)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
  })

  // SDD: 033 REQ-009 AC-009.1
  it("el encabezado principal dice «Hola de nuevo, Ana» con first_name «Ana»", async () => {
    getProfileMock.mockResolvedValue(makeProfileResponse({ first_name: "Ana" }))
    renderPage()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo, Ana" })
    ).toBeInTheDocument()
  })

  // SDD: 033 REQ-009 AC-009.2
  it("con first_name null dice «Hola de nuevo» sin coma ni nombre", async () => {
    getProfileMock.mockResolvedValue(makeProfileResponse({ first_name: null }))
    const first = renderPage()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo" })
    ).toBeInTheDocument()
    // Contraste: el mismo home con nombre sí lo añade tras la coma.
    first.unmount()
    getProfileMock.mockResolvedValue(makeProfileResponse({ first_name: "Ana" }))
    renderPage()
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo, Ana" })
    ).toBeInTheDocument()
  })

  // SDD: 033 REQ-009 AC-009.3
  it("con first_name de solo espacios dice «Hola de nuevo»", async () => {
    getProfileMock.mockResolvedValue(makeProfileResponse({ first_name: "   " }))
    const first = renderPage()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo" })
    ).toBeInTheDocument()
    // Contraste: con espacios alrededor de un nombre real, saluda con el nombre recortado.
    first.unmount()
    getProfileMock.mockResolvedValue(makeProfileResponse({ first_name: "  Beatriz  " }))
    renderPage()
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola de nuevo, Beatriz" })
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Lo que antes era la pantalla /macros (feature 006, specs 007 y 009), ahora
// parte del home.
// ---------------------------------------------------------------------------
// Hombre, 72,5 kg, 175 cm, actividad moderada, mantener, nacido el
// 12-10-1998: 27 años el 11-10-2026 (2322 kcal) y 28 el 12-10-2026 (2315).
const response = makeProfileResponse({ date_of_birth: "1998-10-12" })

describe("HomePage - objetivo y reparto de macros", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(response)
    vi.useFakeTimers({ toFake: ["Date"] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-012 AC-012.2
  it("muestra el objetivo diario y los gramos de cada macronutriente", async () => {
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
    renderPage()

    expect(await screen.findByText("Objetivo de hoy")).toBeInTheDocument()
    expect(screen.getByText("Objetivo de hoy").parentElement).toHaveTextContent(
      /2\.?322/
    )
    expect(screen.getByText("145 g")).toBeInTheDocument()
    expect(screen.getByText("65 g")).toBeInTheDocument()
    expect(screen.getByText("290 g")).toBeInTheDocument()
  })

  // SDD: REQ-012 AC-012.4
  it("el día antes del cumpleaños calcula con 27 años", async () => {
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0))
    renderPage()

    await screen.findByText("Objetivo de hoy")

    expect(screen.getByText("Objetivo de hoy").parentElement).toHaveTextContent(
      /2\.?322/
    )
  })

  // SDD: REQ-012 AC-012.4
  it("el día del cumpleaños calcula con 28 años sin que el usuario edite nada", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    renderPage()

    await screen.findByText("Objetivo de hoy")

    expect(screen.getByText("Objetivo de hoy").parentElement).toHaveTextContent(
      /2\.?315/
    )
  })
})

// ---------------------------------------------------------------------------
// Spec 007: presentación cálculo con límites. Fecha fija 12-10-2026; nacer el
// 1 de enero de (2026 - edad) da exactamente esa edad.
// ---------------------------------------------------------------------------
function macroItem(label: string) {
  const item = screen
    .getAllByText(label)
    .map((el) => el.closest("li"))
    .find((li) => li !== null)
  if (!item) throw new Error(`no hay tarjeta de ${label}`)
  return within(item)
}

describe("HomePage - cálculo con límites (spec 007)", () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // SDD: REQ-009 AC-009.1
  it("con 120 kg muestra 3379 kcal y la proteína con tope de IMC 27", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1996-01-01" },
        { height_cm: 180, weight: 120, activity_level: "high", goal: "maintain" }
      )
    )
    renderPage()

    await screen.findByText("Objetivo de hoy")

    expect(screen.getByText("Objetivo de hoy").parentElement).toHaveTextContent(
      /3\.?379/
    )
    expect(macroItem("Proteínas").getByText("175 g")).toBeInTheDocument()
    expect(macroItem("Grasas").getByText("94 g")).toBeInTheDocument()
    expect(macroItem("Carbohidratos").getByText("459 g")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.2
  it("con el mínimo de carbohidratos muestra gramos y porcentajes del reparto", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1946-01-01" },
        {
          gender: "female",
          height_cm: 175,
          weight: 80,
          activity_level: "low",
          goal: "lose",
        }
      )
    )
    renderPage()

    await screen.findByText("Objetivo de hoy")

    const carbs = macroItem("Carbohidratos")
    expect(carbs.getByText("100 g")).toBeInTheDocument()
    expect(carbs.getByText("31 % del total")).toBeInTheDocument()
    const protein = macroItem("Proteínas")
    expect(protein.getByText("156 g")).toBeInTheDocument()
    expect(protein.getByText("49 % del total")).toBeInTheDocument()
    const fat = macroItem("Grasas")
    expect(fat.getByText("28 g")).toBeInTheDocument()
    expect(fat.getByText("20 % del total")).toBeInTheDocument()
  })

  // SDD: REQ-009 AC-009.3
  it("al cambiar a kJ el objetivo diario se muestra como 7150 kJ", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1996-01-01" },
        { height_cm: 180, weight: 80, activity_level: "low", goal: "lose" }
      )
    )
    renderPage()
    await screen.findByText("Objetivo de hoy")

    fireEvent.click(screen.getByRole("button", { name: "kJ" }))

    expect(screen.getByText("Objetivo de hoy").parentElement).toHaveTextContent(
      /7\.?150/
    )
  })

  // SDD: REQ-009 AC-009.5
  it("con el suelo calórico muestra 1200 kcal y el mantenimiento sin suelo", async () => {
    getProfileMock.mockResolvedValue(
      makeProfileResponse(
        { date_of_birth: "1976-01-01" },
        {
          gender: "female",
          height_cm: 160,
          weight: 60,
          activity_level: "low",
          goal: "lose",
        }
      )
    )
    renderPage()

    await screen.findByText("Objetivo de hoy")

    const card = screen.getByText("Objetivo de hoy").parentElement
    expect(card).toHaveTextContent(/1\.?200/)
    expect(card).toHaveTextContent(/Mantenimiento: 1\.?427 kcal/)
  })

  describe("nota informativa", () => {
    async function findNote() {
      getProfileMock.mockResolvedValue(response)
      renderPage()
      const strong = await screen.findByText("Mifflin-St Jeor")
      return strong.closest("p")!
    }

    // SDD: REQ-010 AC-010.1
    it("explica el tope de proteína por IMC 27 y el mínimo de 100 g", async () => {
      const note = await findNote()

      expect(note).toHaveTextContent(
        "si tu peso supera el que corresponde a un IMC de 27 para tu altura, se usa ese peso"
      )
      expect(note).toHaveTextContent("con un mínimo de 100 g")
    })

    // SDD: REQ-010 AC-010.2
    it("sigue mencionando Mifflin-St Jeor", async () => {
      const note = await findNote()

      expect(note).toHaveTextContent("Mifflin-St Jeor")
    })

    // SDD: REQ-010 AC-010.3
    it("explica el suelo calórico para mujeres y hombres", async () => {
      const note = await findNote()

      expect(note).toHaveTextContent(
        "sin bajar de 1200 kcal en mujeres ni de 1500 kcal en hombres"
      )
    })
  })
})
