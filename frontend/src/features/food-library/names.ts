// Regla de nombres de la 028: sin mayúsculas ni tildes, sin espacios en los extremos y con los repetidos como uno.
export function customFoodNameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part !== "")
    .join(" ")
}
