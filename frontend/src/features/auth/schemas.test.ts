import { describe, expect, it } from "vitest"
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
} from "./schemas"

// jsdom (y los navegadores) ya recortan el valor de un <input type="email">,
// así que los tests de los formularios no distinguen si el esquema recorta o no.
// Estos tests ejercitan el esquema con el texto crudo que recibe zodResolver.
describe("esquemas de autenticación - correo con espacios (spec 014)", () => {
  const registro = {
    password: "Clave1234",
    first_name: "Ana",
    last_name: "Pérez",
    date_of_birth: "1990-01-01",
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
