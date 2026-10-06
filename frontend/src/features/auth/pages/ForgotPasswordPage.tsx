import { AuthLayout } from "@/features/auth/components/AuthLayout"
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm"

export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Recuperar contraseña"
      description="Te enviaremos un enlace para restablecerla"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
