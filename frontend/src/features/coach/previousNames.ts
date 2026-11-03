export const MAX_PREVIOUS_NAMES = 5
export const MAX_NAME_LENGTH = 100

// Spec 034 (REQ-013): nombres que el usuario tuvo durante la conversación, para que el
// servidor los anonimice en la traza. Funciones puras; la lista que sale cumple siempre
// la regla del servidor (1 a 5 textos de 1 a 100 caracteres).
export function rememberName(seen: readonly string[], name: string | null | undefined): string[] {
  const trimmed = name?.trim()
  if (!trimmed || Array.from(trimmed).length > MAX_NAME_LENGTH) return [...seen]
  return [...seen.filter((item) => item !== trimmed), trimmed].slice(-(MAX_PREVIOUS_NAMES + 1))
}

export function previousNamesFor(
  seen: readonly string[],
  current: string | null | undefined
): string[] {
  const trimmed = current?.trim()
  return seen.filter((item) => item !== trimmed).slice(-MAX_PREVIOUS_NAMES)
}
