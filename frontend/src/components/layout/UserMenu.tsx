import { useNavigate } from "react-router"
import { LogOut, User as UserIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearToken } from "@/lib/authToken"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/features/auth/hooks"

// Paleta fija de colores reales (no la escala de grises del tema) para el
// fondo del avatar cuando se muestra la inicial. "Random" pero
// DETERMINISTICO: el mismo email siempre cae en el mismo color (via hash),
// en vez de sortear uno nuevo en cada render/refresh - eso ultimo se
// sentiria como un bug ("por que cambio de color solo?").
const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
]

function colorForEmail(email: string) {
  let hash = 0
  for (const char of email) {
    hash = (hash * 31 + char.charCodeAt(0)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

// avatarUrl no lo llena nadie todavia - no hay Single Sign-On implementado
// asi que no hay de donde sacar una foto real. Dejamos el prop listo a
// proposito: el dia que se implemente login con Google, alcanza con
// pasar la URL de la foto de esa cuenta aca (ej. desde useCurrentUser())
// y el AvatarFallback (inicial + color) de abajo deja de mostrarse solo,
// sin tocar el resto de este componente.
export function UserMenu({ avatarUrl }: { avatarUrl?: string }) {
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()

  function handleLogout() {
    clearToken()
    navigate("/login", { replace: true })
  }

  // Mientras no haya foto real: mostramos la inicial del email en vez de
  // un icono 100% generico - es "gratis" (el dato ya esta disponible via
  // /api/auth/me) y se siente un poco mas personal.
  const initial = user?.email?.[0]?.toUpperCase()
  const avatarColor = user?.email ? colorForEmail(user.email) : undefined

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu de usuario"
          // hover: se agranda un poco + le aparece un anillo de color -
          // asi se lee como un boton "vivo", no solo una foto de perfil
          // decorativa. active: se achica levemente al clickear, el
          // mismo feedback de "presionaste algo" que da cualquier boton
          // fisico. transition-transform es lo que hace que el cambio de
          // tamano se sienta como una animacion suave en vez de un salto.
          className="rounded-full outline-none transition-transform duration-200 hover:scale-110 hover:ring-2 hover:ring-primary/50 hover:ring-offset-2 hover:ring-offset-background active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* size-8 (2rem) es el tamano "default" del Avatar - size-16
              (4rem) es el doble. */}
          <Avatar className="size-16">
            <AvatarImage src={avatarUrl} alt="" />
            <AvatarFallback
              className={cn(
                "text-2xl",
                // El color solo aplica al fallback de la inicial. Cuando
                // haya una foto real, Radix ni siquiera renderiza este
                // Fallback (solo se muestra si AvatarImage no tiene src o
                // no pudo cargar) - no hace falta ninguna condicion extra
                // para "apagar" el color en ese caso, ya viene resuelto.
                avatarColor && `${avatarColor} text-white`
              )}
            >
              {initial ?? <UserIcon className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {user?.email && (
          <>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
