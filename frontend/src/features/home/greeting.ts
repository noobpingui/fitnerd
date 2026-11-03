export function homeGreeting(firstName: string | null | undefined): string {
  const name = firstName?.trim()
  return name ? `Hola de nuevo, ${name}` : "Hola de nuevo"
}
