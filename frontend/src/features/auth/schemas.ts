import { z } from "zod"

// Reglas de validación para el FORMULARIO (UX). Login no exige largo mínimo
// (la contraseña ya existe, no la estamos creando). Registro y restablecimiento
// comparten newPasswordSchema, que repite las reglas del backend
// (services/credential_rules.py). Login, registro y restablecimiento comparten
// emailSchema, que recorta los espacios del correo.

// Mínimo 8 caracteres (puntos de código, igual que len() en Python) y máximo
// 72 bytes UTF-8 (límite de bcrypt), igual que el backend.
export const newPasswordSchema = z
  .string()
  .refine((v) => Array.from(v).length >= 8, "Mínimo 8 caracteres")
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Contraseña demasiado larga",
  )

// El correo se recorta antes de validarlo; las mayúsculas se conservan (el
// servidor las normaliza).
export const emailSchema = z.string().trim().pipe(z.email("Email inválido"))

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es obligatoria"),
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  first_name: z.string().min(1, "Campo obligatorio"),
  last_name: z.string().min(1, "Campo obligatorio"),
  date_of_birth: z.iso.date("Fecha inválida"),
})
export type RegisterFormValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema,
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
