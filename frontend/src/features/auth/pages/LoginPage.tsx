import { AuthLayout } from "@/features/auth/components/AuthLayout"
import { LoginForm } from "@/features/auth/components/LoginForm"

export function LoginPage() {
  return (
    <AuthLayout title="fitnerd" description="Entrena de forma segura e inteligente">
      <LoginForm />
    </AuthLayout>
  )
}
