import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { getCurrentUser, login, register } from "@/features/auth/api"
import { setToken } from "@/lib/authToken"

// useMutation es el otro lado de la moneda de useQuery: se usa para
// operaciones que ESCRIBEN (POST/PUT/DELETE) y que dispara una accion del
// usuario (submit de un form), no algo que se auto-ejecuta al montar el
// componente. No cachea nada - te da { mutate, isPending, isError, error }
// y ejecutas la mutacion vos mismo llamando mutate(valores).

export function useLogin() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setToken(data.token)
      navigate("/", { replace: true })
    },
  })
}

// Usado por UserMenu (navbar) para saber que mostrar en el avatar - hoy
// solo el email, pero /api/auth/me es el lugar natural donde el backend
// va a devolver mas datos de perfil (nombre, foto de Google, etc.) el dia
// que exista SSO, sin tener que agregar un endpoint nuevo.
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
  })
}

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      // /api/auth/register ya devuelve un token (igual que login) - el
      // backend loguea automaticamente al usuario recien creado.
      setToken(data.token)
      navigate("/", { replace: true })
    },
  })
}
