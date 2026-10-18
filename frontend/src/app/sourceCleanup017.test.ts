// Escaneo del código fuente del frontend (spec 017, pulido): regla de rango
// compartida, supresiones de lint justificadas, textos de los tests de
// autenticación, tests duplicados del onboarding y carga de pantallas bajo
// demanda. Sigue el patrón de sourceCleanup013.test.ts: las cadenas buscadas
// se construyen por partes y este archivo se excluye del barrido para no
// encontrarse a sí mismo.
import { describe, expect, it } from "vitest"

const SELF = "/src/app/sourceCleanup017.test.ts"

const all = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const viteConfig = import.meta.glob("/vite.config.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const oxlintConfig = import.meta.glob("/.oxlintrc.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

function source(path: string): string {
  const content = all[path]
  expect(content, `no existe ${path}`).toBeDefined()
  return content.replace(/\r\n/g, "\n")
}

const ONBOARDING_SCHEMAS = "/src/features/onboarding/schemas.ts"
const PROFILE_SCHEMAS = "/src/features/profile/schemas.ts"
const BODY_METRICS_SCHEMAS = "/src/features/body-metrics/schemas.ts"
const BUTTON = "/src/components/ui/button.tsx"
const FORM = "/src/components/ui/form.tsx"
const ROUTER = "/src/app/router.tsx"
const LOGIN_TEST = "/src/features/auth/components/LoginForm.test.tsx"
const FORGOT_TEST = "/src/features/auth/components/ForgotPasswordForm.test.tsx"
const ONBOARDING_PAGE_TEST = "/src/features/onboarding/pages/OnboardingPage.test.tsx"

const RULE = "only-export" + "-components"

describe("regla de rango compartida (spec 017)", () => {
  // SDD: 017 NFR-001 AC-N001.3
  it("el esquema del onboarding no define ni reexporta inRange", () => {
    const content = source(ONBOARDING_SCHEMAS)

    expect(content).not.toMatch(/function\s+inRange\b/)
    expect(content).not.toMatch(/(?:const|let)\s+inRange\b/)
    expect(content).not.toMatch(/export\s*\{[^}]*\binRange\b/)
    expect(content).not.toMatch(/export\s*\*/)
  })

  // SDD: 017 NFR-001 AC-N001.3
  it("ningún archivo importa inRange del esquema del onboarding", () => {
    const importedFromOnboarding =
      /import\s*(?:type\s*)?\{[^}]*\binRange\b[^}]*\}\s*from\s*["'][^"']*onboarding\/schemas["']/

    const offenders = Object.entries(all)
      .filter(([file]) => file !== SELF)
      .filter(([, content]) => importedFromOnboarding.test(content))
      .map(([file]) => file)

    expect(Object.keys(all)).toContain(ONBOARDING_SCHEMAS)
    expect(offenders).toEqual([])
  })

  // SDD: 017 NFR-001 AC-N001.3
  it("los esquemas de onboarding, perfil y métricas importan inRange de @/lib/inRange", () => {
    const fromShared =
      /import\s*\{[^}]*\binRange\b[^}]*\}\s*from\s*["']@\/lib\/inRange["']/

    for (const file of [ONBOARDING_SCHEMAS, PROFILE_SCHEMAS, BODY_METRICS_SCHEMAS]) {
      expect(source(file), file).toMatch(fromShared)
    }
  })

  // SDD: 017 NFR-001 AC-N001.4
  it("siguen existiendo los tests de esquemas y páginas de onboarding, perfil y métricas con sus marcadores", () => {
    const files = [
      "/src/features/onboarding/schemas.test.ts",
      "/src/features/profile/schemas.test.ts",
      "/src/features/body-metrics/schemas.test.ts",
      "/src/features/onboarding/pages/OnboardingPage.test.tsx",
      "/src/features/profile/pages/ProfilePage.test.tsx",
      "/src/features/body-metrics/pages/BodyMetricsPage.test.tsx",
    ]

    for (const file of files) {
      expect(source(file), file).toMatch(/\/\/ SDD: /)
    }
  })
})

describe("componentes de UI sin warnings de only-export-components (spec 017)", () => {
  // SDD: 017 NFR-002 AC-N002.2
  it("button y form conservan los nombres que exportan", async () => {
    const button = await import("@/components/ui/button")
    const form = await import("@/components/ui/form")

    expect(Object.keys(button)).toEqual(
      expect.arrayContaining(["Button", "buttonVariants"])
    )
    expect(Object.keys(form)).toEqual(
      expect.arrayContaining([
        "useFormField",
        "Form",
        "FormItem",
        "FormLabel",
        "FormControl",
        "FormDescription",
        "FormMessage",
        "FormField",
      ])
    )
  })

  // SDD: 017 NFR-002 AC-N002.3
  it("siguen existiendo los tests de los formularios que usan esos componentes", () => {
    const files = [
      "/src/features/auth/components/LoginForm.test.tsx",
      "/src/features/auth/components/RegisterForm.test.tsx",
      "/src/features/auth/components/ForgotPasswordForm.test.tsx",
      "/src/features/auth/components/ResetPasswordForm.test.tsx",
    ]

    for (const file of files) {
      expect(all[file], `no existe ${file}`).toBeDefined()
    }
  })

  // El formulario de feedback no tiene archivo de test propio: la guarda
  // comprueba que el formulario sigue existiendo y usando los componentes de UI.
  // SDD: 017 NFR-002 AC-N002.3
  it("el formulario de feedback sigue existiendo y usa los componentes de UI", () => {
    const content = source("/src/features/feedback/components/FeedbackForm.tsx")

    expect(content).toMatch(/components\/ui\/form/)
    expect(content).toMatch(/components\/ui\/button/)
  })

  // SDD: 017 NFR-002 AC-N002.1 AC-N002.4
  it.each([BUTTON, FORM])(
    "%s tiene una sola supresión de la regla, precedida de un comentario con el motivo",
    (file) => {
      const lines = source(file).split("\n")
      const suppressed = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.includes(RULE))

      expect(suppressed).toHaveLength(1)
      const previous = lines[suppressed[0].index - 1].trim()
      expect(previous.startsWith("//")).toBe(true)
      expect(previous.replace(/^\/\/\s*/, "").length).toBeGreaterThan(10)
      expect(previous).not.toContain(RULE)
    }
  )

  // SDD: 017 NFR-002 AC-N002.4
  it("la configuración de lint no desactiva la regla", () => {
    const content = oxlintConfig["/.oxlintrc.json"]
    expect(content, "no existe .oxlintrc.json").toBeDefined()
    const rules = JSON.parse(content).rules as Record<string, unknown>
    const rule = rules["react/" + RULE]

    expect(rule).toBeDefined()
    const level = Array.isArray(rule) ? rule[0] : rule
    expect(["off", 0]).not.toContain(level)
  })
})

describe("textos de los tests de autenticación (spec 017)", () => {
  const WORDS = [
    "validacion",
    "vacio",
    "implementacion",
    "funcion",
    "podria",
    "asi",
    "aca",
    "proximo",
    "redireccion",
    "redirigio",
    "despues",
    "Tambien",
    "recuperacion",
    "exito",
    "envia",
    "peticion",
    "limite",
    "envio",
    "boton",
    "via",
  ]
  const PHRASES = ["esta en " + "curso", "SI " + "hay"]

  // SDD: 017 NFR-003 AC-N003.1
  it.each([LOGIN_TEST, FORGOT_TEST])(
    "%s no contiene palabras sin tilde ni regionalismos señalados",
    (file) => {
      const content = source(file)

      for (const word of WORDS) {
        expect(content, `${file}: ${word}`).not.toMatch(new RegExp(`\\b${word}\\b`))
      }
      for (const phrase of PHRASES) {
        expect(content, `${file}: ${phrase}`).not.toContain(phrase)
      }
    }
  )

  // SDD: 017 NFR-003 AC-N003.2
  it("LoginForm.test.tsx conserva sus 14 tests y sus marcadores", () => {
    const content = source(LOGIN_TEST)

    expect(content.match(/^\s*it(?:\.each\(.*?\))?\(/gm)).toHaveLength(14)
    expect(content.match(/^\s*\/\/ SDD: .*$/gm)?.map((l) => l.trim())).toEqual([
      "// SDD: REQ-001 AC-001.1",
      "// SDD: REQ-011 AC-011.4",
      "// SDD: REQ-011 AC-011.4",
      "// SDD: 014 REQ-011 AC-011.1",
      "// SDD: 014 REQ-011 AC-011.2",
      "// SDD: 014 REQ-011 AC-011.2",
      "// SDD: 014 REQ-011 AC-011.3",
      "// SDD: 014 REQ-011 AC-011.4",
      "// SDD: 014 REQ-011 AC-011.5",
      "// SDD: 014 REQ-013 AC-013.2",
    ])
  })

  // SDD: 017 NFR-003 AC-N003.2
  it("ForgotPasswordForm.test.tsx conserva sus 8 tests y sus marcadores", () => {
    const content = source(FORGOT_TEST)

    expect(content.match(/^\s*it(?:\.each\(.*?\))?\(/gm)).toHaveLength(8)
    expect(content.match(/^\s*\/\/ SDD: .*$/gm)?.map((l) => l.trim())).toEqual([
      "// SDD: REQ-005 AC-005.3",
      "// SDD: REQ-010 AC-010.1",
      "// SDD: REQ-010 AC-010.2",
      "// SDD: REQ-010 AC-010.2",
      "// SDD: REQ-010 AC-010.2",
      "// SDD: REQ-010 AC-010.3",
      "// SDD: REQ-010 AC-010.4",
      "// SDD: 014 REQ-013 AC-013.3",
    ])
  })
})

describe("tests de fecha prerrellenada del onboarding sin duplicados (spec 017)", () => {
  // Trozos de archivo que empiezan en cada it( o it.each(.
  function chunks(): string[] {
    return source(ONBOARDING_PAGE_TEST).split(/^\s*(?=it(?:\.each)?\()/m).slice(1)
  }

  // SDD: 017 NFR-004 AC-N004.1
  it("hay un solo test de la fecha prerrellenada 1995-05-20 que deja 'Siguiente' habilitado", () => {
    const matching = chunks().filter(
      (chunk) =>
        chunk.includes('makePendingResponse("1995-05-20")') &&
        chunk.includes("toBeEnabled()") &&
        !chunk.includes("fromDateToGoal")
    )

    expect(matching).toHaveLength(1)
  })

  // SDD: 017 NFR-004 AC-N004.1
  it("hay un solo test de la fecha prerrellenada 1900-01-01 que muestra el aviso de rango", () => {
    const matching = chunks().filter((chunk) =>
      chunk.includes('makePendingResponse("1900-01-01")')
    )

    expect(matching).toHaveLength(1)
    expect(matching[0]).toMatch(/Debes tener entre 14 y 100 años|RANGE_MESSAGE/)
  })

  // SDD: 017 NFR-004 AC-N004.2
  it("los marcadores de los dos tests conservados listan la spec 006 y la 015", () => {
    const content = source(ONBOARDING_PAGE_TEST)
    const markers = content.match(/^\s*\/\/ SDD: .*$/gm)?.map((l) => l.trim()) ?? []
    const first = "// SDD: REQ-009 AC-009.1 · 015 REQ-007 AC-007.5"
    const second = "// SDD: REQ-009 AC-009.4 · 015 REQ-007 AC-007.5"

    expect(markers.filter((m) => m === first)).toHaveLength(1)
    expect(markers.filter((m) => m === second)).toHaveLength(1)
    expect(markers.filter((m) => m.includes("AC-009.1"))).toHaveLength(1)
    expect(markers.filter((m) => m.includes("AC-007.5"))).toHaveLength(2)
    expect(content).toContain('it("con fecha en la cuenta')
    expect(content).toContain('it("una fecha prerrellenada de más de 100 años')
  })

  // Guarda de existencia: que los tests pasen lo comprueba la ejecución de
  // OnboardingPage.test.tsx dentro de la suite; aquí solo se fija que siguen ahí.
  // SDD: 017 NFR-004 AC-N004.3
  it("OnboardingPage.test.tsx conserva sus tests de la 017 y de la fecha (su ejecución completa la cubre la suite)", () => {
    const content = source(ONBOARDING_PAGE_TEST)
    expect(content).toContain("// SDD: 017 REQ-001 AC-001.6")
    expect(content).toContain('it("con fecha en la cuenta')
  })
})

describe("carga de pantallas bajo demanda (spec 017)", () => {
  // SDD: 017 NFR-005 AC-N005.1
  it("vite.config.ts no cambia el umbral de aviso ni define manualChunks", () => {
    const content = viteConfig["/vite.config.ts"]
    expect(content, "no existe vite.config.ts").toBeDefined()

    expect(content).not.toContain("chunkSize" + "WarningLimit")
    expect(content).not.toContain("manual" + "Chunks")
  })

  // SDD: 017 NFR-005 AC-N005.2
  it("router.tsx no importa de forma estática ningún módulo de features/*/pages/", () => {
    const staticPageImport =
      /import\s+(?:type\s+)?[^"';]*?from\s*["'][^"']*features\/[^"']*\/pages\/[^"']*["']/

    expect(source(ROUTER)).not.toMatch(staticPageImport)
  })
})
