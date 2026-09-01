import { z } from "zod"

// Reglas de validacion para el FORMULARIO (UX). No son necesariamente las
// mismas que valida el backend - login no exige largo minimo (la password
// ya existe, no la estamos creando), y el minimo de 8 en registro es una
// regla que puse yo del lado del cliente: el backend hoy no exige ningun
// largo minimo (services/auth_service.py solo hashea con bcrypt, sin
// validar longitud) - vale la pena agregarlo alli tambien en algun momento.

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  first_name: z.string().min(1, "Campo obligatorio"),
  last_name: z.string().min(1, "Campo obligatorio"),
  date_of_birth: z.iso.date("Fecha inválida"),
})
export type RegisterFormValues = z.infer<typeof registerSchema>
