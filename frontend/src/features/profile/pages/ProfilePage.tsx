import { useMemo } from "react"
import { KeyRound, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  useCurrentUser,
  useLogout,
  useRequestPasswordReset,
} from "@/features/auth/hooks"
import { useBodyMetrics } from "@/features/body-metrics/hooks"
import {
  ProfileLoadError,
  ProfileLoading,
} from "@/features/profile/components/ProfileLoadState"
import { useProfile } from "@/features/profile/hooks"
import { answersFromProfile } from "@/features/profile/mappers"
import { ProfileSection } from "@/features/profile/components/ProfileSection"
import { PhysicalDataForm } from "@/features/profile/components/PhysicalDataForm"

export function ProfilePage() {
  const { data: user } = useCurrentUser()
  const passwordReset = useRequestPasswordReset()
  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
    refetch,
  } = useProfile()
  const answers = useMemo(
    () => (profile ? answersFromProfile(profile) : null),
    [profile]
  )
  const handleLogout = useLogout()
  const { data: metrics, isLoading: metricsLoading } = useBodyMetrics()

  // Último valor conocido de cada campo (pueden venir de mediciones
  // distintas: un día solo se registra el peso, otro la grasa).
  const latestBody = useMemo(() => {
    const sorted = [...(metrics ?? [])].sort((a, b) =>
      b.recorded_at.localeCompare(a.recorded_at)
    )
    const fat = sorted.find((m) => m.body_fat_percentage !== null)
    const muscle = sorted.find((m) => m.muscle_mass_percentage !== null)
    return {
      fat: fat ? String(fat.body_fat_percentage) : "",
      muscle: muscle ? String(muscle.muscle_mass_percentage) : "",
    }
  }, [metrics])

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">Mi perfil</h1>
      <p className="mb-6 text-muted-foreground">
        Gestiona tus datos y tu cuenta.
      </p>

      <div className="flex flex-col gap-4">
        <ProfileSection
          title="Datos físicos"
          description="Se usan para calcular tus calorías y macros. Cada cambio de peso o composición se guarda como la medición de hoy en tu progreso; si ya hay una de hoy, se actualiza."
        >
          {/* Se espera al historial para precargar la última grasa y
              músculo conocidos; si falla, el formulario arranca vacío. */}
          {profilePending && <ProfileLoading className="min-h-40" />}
          {profileError && (
            <ProfileLoadError className="min-h-40" onRetry={() => refetch()} />
          )}
          {answers && !metricsLoading && (
            <PhysicalDataForm initial={answers} initialBody={latestBody} />
          )}
        </ProfileSection>

        <ProfileSection title="Cuenta">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Correo</div>
              <div className="font-medium">{user?.email ?? "—"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Reutiliza la recuperación por correo (ADR-0014): para
                  cambiar la contraseña hace falta acceso al correo, así que
                  una sesión abierta en un equipo ajeno no basta. También
                  sirve a quien entró con Google y aún no tiene contraseña. */}
              <Button
                variant="outline"
                disabled={!user?.email || passwordReset.isPending}
                onClick={() =>
                  user?.email && passwordReset.mutate({ email: user.email })
                }
              >
                <KeyRound className="h-4 w-4" />
                {passwordReset.isPending ? "Enviando…" : "Cambiar contraseña"}
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>

          {passwordReset.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              Te enviamos un enlace a {user?.email} para cambiar tu
              contraseña. Caduca en 5 minutos.
            </p>
          )}
          {passwordReset.isError && (
            <p role="alert" className="text-sm text-destructive">
              No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.
            </p>
          )}
        </ProfileSection>
      </div>
    </div>
  )
}
