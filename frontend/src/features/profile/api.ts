import { apiFetch } from "@/lib/apiClient"
import {
  profileResponseSchema,
  saveProfilePayloadSchema,
} from "@/features/profile/schemas"
import type { ProfileResponse, SaveProfilePayload } from "@/features/profile/types"

export async function getProfile(): Promise<ProfileResponse> {
  return profileResponseSchema.parse(await apiFetch<unknown>("/api/profile"))
}

export async function saveProfile(payload: SaveProfilePayload): Promise<ProfileResponse> {
  const body = saveProfilePayloadSchema.parse(payload)
  return profileResponseSchema.parse(
    await apiFetch<unknown>("/api/profile", { method: "PUT", body })
  )
}
