import { describe, expect, it } from "vitest"
import {
  FIRST_NAME_REQUIRED_MESSAGE,
  FIRST_NAME_TOO_LONG_MESSAGE,
  firstNameMessage,
  firstNameSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
} from "./schemas"

// Regla única del nombre (spec 033): se recorta y se cuentan caracteres, no
// unidades UTF-16.
describe("regla del nombre (spec 033)", () => {
  // SDD: 033 REQ-008 AC-008.1
  it("«  Ana  » es válido y el valor resultante es «Ana»", () => {
    expect(firstNameMessage("  Ana  ")).toBeNull()
    const result = firstNameSchema.safeParse("  Ana  ")
    expect(result.success).toBe(true)
    expect(result.data).toBe("Ana")
  })

  // SDD: 033 REQ-008 AC-008.2
  it.each(["", "   "])("%j no es válido: «El nombre es obligatorio»", (value) => {
    expect(firstNameMessage(value)).toBe("El nombre es obligatorio")
    expect(FIRST_NAME_REQUIRED_MESSAGE).toBe("El nombre es obligatorio")
    const result = firstNameSchema.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "El nombre es obligatorio"
    )
  })

  // SDD: 033 REQ-008 AC-008.3
  it("100 caracteres rodeados de espacios son válidos y 101 no", () => {
    const hundred = "a".repeat(100)
    expect(firstNameMessage(`  ${hundred}  `)).toBeNull()
    expect(firstNameSchema.safeParse(`  ${hundred}  `).data).toBe(hundred)

    const tooLong = "a".repeat(101)
    expect(FIRST_NAME_TOO_LONG_MESSAGE).toBe(
      "El nombre no puede superar los 100 caracteres"
    )
    expect(firstNameMessage(`  ${tooLong}  `)).toBe(
      "El nombre no puede superar los 100 caracteres"
    )
    const result = firstNameSchema.safeParse(tooLong)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "El nombre no puede superar los 100 caracteres"
    )
  })

  // SDD: 033 REQ-008 AC-008.4
  it("cuenta emojis como un carácter: 100 son válidos y 101 no", () => {
    const hundred = "😀".repeat(100)
    expect(hundred.length).toBeGreaterThan(100)
    expect(firstNameMessage(hundred)).toBeNull()
    expect(firstNameSchema.safeParse(hundred).success).toBe(true)

    expect(firstNameMessage("😀".repeat(101))).toBe(
      "El nombre no puede superar los 100 caracteres"
    )
    expect(firstNameSchema.safeParse("😀".repeat(101)).success).toBe(false)
  })

  // SDD: 033 REQ-002 AC-002.2
  it("el esquema de registro ya no lleva la fecha de nacimiento", () => {
    const result = registerSchema.safeParse({
      email: "ana@example.com",
      password: "Clave1234",
      first_name: "  Ana ",
      last_name: "Pérez",
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      email: "ana@example.com",
      password: "Clave1234",
      first_name: "Ana",
      last_name: "Pérez",
    })
  })
})

// jsdom (y los navegadores) ya recortan el valor de un <input type="email">,
// así que los tests de los formularios no distinguen si el esquema recorta o no.
// Estos tests ejercitan el esquema con el texto crudo que recibe zodResolver.
describe("esquemas de autenticación - correo con espacios (spec 014)", () => {
  const registro = {
    password: "Clave1234",
    first_name: "Ana",
    last_name: "Pérez",
  }

  // SDD: 014 REQ-013 AC-013.1
  it("el registro recorta el correo y conserva sus mayúsculas", () => {
    const result = registerSchema.safeParse({
      ...registro,
      email: "  Ana@Example.COM ",
    })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("Ana@Example.COM")
  })

  // SDD: 014 REQ-013 AC-013.2
  it("el login recorta el correo", () => {
    const result = loginSchema.safeParse({
      email: " ana@example.com  ",
      password: "Clave123",
    })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("ana@example.com")
  })

  // SDD: 014 REQ-013 AC-013.3
  it("la solicitud de restablecimiento recorta el correo y conserva sus mayúsculas", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  Ana@Example.com " })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("Ana@Example.com")
  })

  // SDD: 014 REQ-013 AC-013.4
  it("el registro rechaza un correo de solo espacios con Email inválido", () => {
    const result = registerSchema.safeParse({ ...registro, email: "   " })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain("Email inválido")
  })

  // SDD: 014 REQ-013 AC-013.5
  it("el registro rechaza ' no-es-un-correo ' con Email inválido", () => {
    const result = registerSchema.safeParse({
      ...registro,
      email: " no-es-un-correo ",
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain("Email inválido")
  })
})
