// Esquema del formulario de búsqueda de alimentos (spec 021).
import { describe, expect, it } from "vitest"
import {
  EMPTY_QUERY_MESSAGE,
  FOOD_QUERY_MAX_LENGTH,
  LONG_QUERY_MESSAGE,
  SHORT_QUERY_MESSAGE,
  foodSearchFormSchema,
} from "./schemas"

function messageFor(query: string): string | undefined {
  const result = foodSearchFormSchema.safeParse({ query })
  return result.success ? undefined : result.error.issues[0].message
}

describe("foodSearchFormSchema", () => {
  // SDD: 021 REQ-013 AC-013.1
  it("rechaza la consulta vacía con el mensaje de vacío", () => {
    expect(messageFor("")).toBe(EMPTY_QUERY_MESSAGE)
    expect(EMPTY_QUERY_MESSAGE).toBe("Escribe qué alimento quieres buscar.")
  })

  // SDD: 021 REQ-013 AC-013.1
  it("rechaza la consulta con solo espacios con el mensaje de vacío", () => {
    expect(messageFor("     ")).toBe(EMPTY_QUERY_MESSAGE)
  })

  // SDD: 021 REQ-013 AC-013.2
  it("rechaza un solo carácter con el mensaje de longitud mínima", () => {
    expect(messageFor("a")).toBe(SHORT_QUERY_MESSAGE)
    expect(SHORT_QUERY_MESSAGE).toBe("La búsqueda debe tener al menos 2 caracteres.")
  })

  // SDD: 021 REQ-013 AC-013.2
  it("cuenta la longitud sin los espacios de los extremos", () => {
    expect(messageFor("  a  ")).toBe(SHORT_QUERY_MESSAGE)
  })

  // SDD: 021 REQ-013 AC-013.2
  it("acepta 2 caracteres", () => {
    expect(messageFor("a")).toBe(SHORT_QUERY_MESSAGE)
    expect(foodSearchFormSchema.safeParse({ query: "ab" }).success).toBe(true)
  })

  // SDD: 021 REQ-013 AC-013.3
  it("acepta 100 caracteres y rechaza 101 con el mensaje de longitud máxima", () => {
    expect(FOOD_QUERY_MAX_LENGTH).toBe(100)
    expect(foodSearchFormSchema.safeParse({ query: "a".repeat(100) }).success).toBe(true)
    expect(messageFor("a".repeat(101))).toBe(LONG_QUERY_MESSAGE)
    expect(LONG_QUERY_MESSAGE).toBe("La búsqueda no puede superar los 100 caracteres.")
  })

  // SDD: 021 REQ-013 AC-013.1
  it("recorta los espacios de los extremos del valor validado", () => {
    const result = foodSearchFormSchema.safeParse({ query: "  chicken  " })

    expect(result.success && result.data.query).toBe("chicken")
  })
})
