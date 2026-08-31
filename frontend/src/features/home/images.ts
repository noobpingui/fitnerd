// Junta automaticamente las imagenes de fondo para el hover de las cards de
// /home. Cada card tiene su propia carpeta en src/assets/home/<slug>/ (el
// slug lo define HomePage.tsx). import.meta.glob es una funcion de Vite:
// en build-time escanea el filesystem con ese patron y arma un objeto
// { ruta: url } por cada archivo que matchee - "eager" hace que las traiga
// ya resueltas (no como funciones lazy), asi no hay que hacer import por
// archivo a mano.
//
// Gracias a esto, agregar/quitar imagenes de una card despues es solo
// copiar/borrar archivos en la carpeta correspondiente - no hay que tocar
// este archivo ni HomePage.tsx.
const modules = import.meta.glob("../../assets/home/*/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>

function groupBySlug(): Record<string, string[]> {
  const bySlug: Record<string, { file: string; url: string }[]> = {}

  for (const [path, url] of Object.entries(modules)) {
    const match = path.match(/assets\/home\/([^/]+)\/([^/]+)\.png$/)
    if (!match) continue

    const [, slug, file] = match
    bySlug[slug] ??= []
    bySlug[slug].push({ file, url })
  }

  const result: Record<string, string[]> = {}
  for (const [slug, files] of Object.entries(bySlug)) {
    // Orden numerico (1, 2, 10) en vez de alfabetico (1, 10, 2), para que
    // el ciclo del slideshow siga el orden esperado por el nombre de archivo.
    result[slug] = files
      .sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }))
      .map((f) => f.url)
  }
  return result
}

export const homeCardImages = groupBySlug()
