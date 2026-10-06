import { Link, useSearchParams } from "react-router"
import { AuthLayout } from "@/features/auth/components/AuthLayout"
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get("token") ?? "").trim()

  if (!token) {
    return (
      <AuthLayout title="Nueva contraseña" description="Restablece tu contraseña">
        <div className="space-y-2">
          <p className="text-sm text-destructive">
            El enlace no es válido o ha caducado. Solicita uno nuevo.
          </p>
          <Link
            to="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Solicitar un enlace nuevo
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Nueva contraseña" description="Elige tu nueva contraseña">
      <ResetPasswordForm token={token} />
    </AuthLayout>
  )
}
