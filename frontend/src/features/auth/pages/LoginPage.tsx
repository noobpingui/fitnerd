import { AuthLayout } from "@/features/auth/components/AuthLayout"
import { LoginForm } from "@/features/auth/components/LoginForm"
import { Logo } from "@/components/layout/Logo"
import logo from "@/assets/logo.png"

export function LoginPage() {
  return (
    <AuthLayout
      title={
        // justify-between: wordmark a la izquierda, imagen a la derecha,
        // dentro del mismo ancho de la Card - no agrega una fila nueva ni
        // empuja el resto del form, solo comparten la fila del titulo.
        <div className="flex items-center justify-between">
          <Logo />
          {/* h-10 (40px) x1.75 = 70px, el aumento pedido */}
          <img src={logo} alt="" className="h-[70px] w-[70px] object-contain" />
        </div>
      }
      description="Entrena de forma segura e inteligente"
    >
      <LoginForm />
    </AuthLayout>
  )
}
