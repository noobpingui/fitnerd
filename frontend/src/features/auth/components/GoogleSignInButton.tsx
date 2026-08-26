import { useEffect, useRef } from "react"
import { useGoogleLogin } from "@/features/auth/hooks"

// Google Identity Services (GIS) no es un paquete de npm - se carga como
// un <script> externo que agrega window.google.accounts.id al cargar.
// TypeScript no conoce esa forma por defecto (window no tiene "google"),
// asi que declaramos a mano el pedacito minimo que realmente usamos.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined
const SCRIPT_SRC = "https://accounts.google.com/gsi/client"

// El script es el mismo para toda la app (Login y Register lo usan por
// separado) - si ya se agrego una vez no hace falta volver a pedirlo.
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${SCRIPT_SRC}"]`
  )
  if (existing) {
    return new Promise((resolve) =>
      existing.addEventListener("load", () => resolve())
    )
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error("No se pudo cargar Google Identity Services"))
    document.head.appendChild(script)
  })
}

// El boton que se ve es 100% de Google (renderButton dibuja un iframe
// propio) - nosotros no armamos el look, solo le damos un <div> donde
// pararse. Por eso no hay clases de estilo propias que ponerle al boton
// en si, mas alla del contenedor.
export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { mutate } = useGoogleLogin()

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn(
        "VITE_GOOGLE_CLIENT_ID no esta configurado - el boton de Google no se va a mostrar."
      )
      return
    }

    let cancelled = false

    loadGoogleScript().then(() => {
      if (cancelled || !containerRef.current || !window.google) return

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        // response.credential es el ID token de Google (un JWT firmado
        // por Google, no el nuestro) - se lo pasamos tal cual a
        // useGoogleLogin, que se lo manda al backend para que lo verifique.
        callback: (response) => mutate(response.credential),
      })

      // width en pixeles, no "100%" - la API de Google no soporta
      // porcentajes. Medimos el ancho real del contenedor (que ya tiene
      // w-full via className) para que el boton quede del mismo ancho
      // que el resto del formulario, en vez de un valor fijo a ojo.
      const width = containerRef.current.offsetWidth || 320

      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: String(width),
        text: "continue_with",
      })
    })

    return () => {
      cancelled = true
    }
  }, [mutate])

  // Sin client_id configurado (todavia no se creo en Google Cloud
  // Console) no hay nada que mostrar - mejor ocultarlo que mostrar un
  // boton roto.
  if (!GOOGLE_CLIENT_ID) return null

  return <div ref={containerRef} className="w-full" />
}
