import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getProfile, saveProfile } from "@/features/profile/api"

export const profileKeys = {
  detail: ["profile"] as const,
}

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.detail,
    queryFn: getProfile,
    // Sin staleTime, cada pantalla que monta volvería a pedir el perfil y
    // pisaría lo recién guardado; el perfil solo lo cambia esta misma app.
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveProfile,
    // Se escribe la caché (en vez de invalidarla): el guard ve el onboarding
    // completado antes de navegar, y home/Macros muestran los datos nuevos
    // sin pedirlos otra vez.
    onSuccess: (data) => {
      queryClient.setQueryData(profileKeys.detail, data)
    },
  })
}
