import type { ProfileResponse, SaveProfilePayload } from "@/features/profile/types"

export async function getProfile(): Promise<ProfileResponse> {
  throw new Error("not implemented")
}

export async function saveProfile(_payload: SaveProfilePayload): Promise<ProfileResponse> {
  throw new Error("not implemented")
}
