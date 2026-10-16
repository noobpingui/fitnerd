import { z } from "zod"

// Reglas de validación para el FORMULARIO (UX). Login no exige largo mínimo
// (la contraseña ya existe, no la estamos creando). Registro y restablecimiento
// comparten newPasswordSchema, que repite las reglas del backend
// (services/credential_rules.py).

// Mínimo 8 caracteres (puntos de código, igual que len() en Python) y máximo
// 72 bytes UTF-8 (límite de bcrypt), igual que el backend.
export const newPasswordSchema = z
  .string()
  .refine((v) => Array.from(v).length >= 8, "Mínimo 8 caracteres")
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Contraseña demasiado larga",
  )

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  email: z.email("Email inválido"),
  password: newPasswordSchema,
  first_name: z.string().min(1, "Campo obligatorio"),
  last_name: z.string().min(1, "Campo obligatorio"),
  date_of_birth: z.iso.date("Fecha inválida"),
})
export type RegisterFormValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.email("Email inválido"),
})
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
