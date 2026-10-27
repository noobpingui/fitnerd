import type { LibraryFood, RecentFood } from "./types"

export async function searchFoodLibrary(_query: string): Promise<LibraryFood[]> {
  throw new Error("not implemented")
}

export async function getRecentFoods(): Promise<RecentFood[]> {
  throw new Error("not implemented")
}

export async function getFavoriteFoods(): Promise<LibraryFood[]> {
  throw new Error("not implemented")
}

export async function setFoodFavorite(
  _food: Pick<LibraryFood, "kind" | "id">,
  _favorite: boolean
): Promise<void> {
  throw new Error("not implemented")
}

export async function deleteCustomFood(_customFoodId: number): Promise<void> {
  throw new Error("not implemented")
}
