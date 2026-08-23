import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { login, register } from "@/features/auth/api"
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
