// Escaneo del código de la propuesta (spec 028, NFR-003): `form.watch` es lo que
// el lint marca como `react(incompatible-library)` y lo que dejó los totales
// desactualizados en la 025. El `verifier` además ejecuta `npm run lint`.
import { describe, expect, it } from "vitest"

const sources = import.meta.glob("/src/features/diary/components/PhotoReview.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const SOURCE = sources["/src/features/diary/components/PhotoReview.tsx"]

// Quita los comentarios para que una explicación no dispare el escaneo.
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

describe("PhotoReview - código sin form.watch", () => {
  const code = withoutComments(SOURCE)

  // SDD: 028 NFR-003 AC-N003.1
  it("existe el archivo de la propuesta", () => {
    expect(SOURCE).toBeTruthy()
    // Y es la propuesta de la 028: observa sus valores con `useWatch`.
    expect(code).toMatch(/useWatch\s*\(/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("no llama a `form.watch`", () => {
    expect(code).not.toMatch(/form\.watch/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("no llama a ningún `.watch(`", () => {
    expect(code).not.toMatch(/\.watch\s*\(/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("no desactiva el aviso de compatibilidad con un comentario del lint", () => {
    expect(SOURCE).not.toMatch(/incompatible-library/)
    // Sin `watch`, la alternativa es `useWatch` (028): el archivo cambio de enfoque.
    expect(code).toMatch(/useWatch\s*\(/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("lee los valores con `useWatch` de react-hook-form", () => {
    expect(code).toMatch(/useWatch\s*\(/)
    expect(code).toMatch(/from "react-hook-form"/)
  })

  // SDD: 028 REQ-019 AC-019.3
  it("empareja lo observado con las filas por clave mediante `mergeProposalEntries`", () => {
    expect(code).toMatch(/mergeProposalEntries\s*\(/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("usa `proposalReviewSchema`, con `key` obligatoria, como resolver del formulario", () => {
    expect(code).toMatch(/proposalReviewSchema/)
    expect(code).toMatch(/zodResolver\(\s*proposalReviewSchema\s*\)/)
    expect(code).not.toMatch(/proposalFormSchema/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("no usa `as never` (el esquema y los valores del formulario ya casan)", () => {
    expect(code).toMatch(/proposalReviewSchema/)
    expect(code).not.toMatch(/as\s+never/)
  })

  // SDD: 028 NFR-003 AC-N003.1
  it("no usa `as unknown as` para convertir los campos del formulario", () => {
    expect(code).toMatch(/proposalReviewSchema/)
    expect(code).not.toMatch(/as\s+unknown\s+as/)
  })
})
