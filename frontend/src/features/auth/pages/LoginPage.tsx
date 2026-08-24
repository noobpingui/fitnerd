import { AuthLayout } from "@/features/auth/components/AuthLayout"
import { LoginForm } from "@/features/auth/components/LoginForm"
import { Logo } from "@/components/layout/Logo"

export function LoginPage() {
  return (
    <AuthLayout
      title={<Logo />}
      description="Entrená de forma segura e inteligente"
    >
      <LoginForm />
    </AuthLayout>
  )
}
