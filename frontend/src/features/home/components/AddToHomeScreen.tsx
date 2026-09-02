import { useState } from "react"
import { Apple, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Platform = "android" | "ios"

// lucide-react es una libreria de iconos GENERICOS, no de logos de marca -
// no tiene un robot de Android. Para no agregar una libreria nueva solo
// para dos logos, usamos su icono "Apple" (una manzana, suficientemente
// reconocible) para iPhone, y el generico "Smartphone" + la palabra
// "Android" al lado para el otro caso.
const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  android: {
    title: "Agregar en Android",
    steps: [
      "Tocá el menú (los tres puntos ⋮) arriba a la derecha de Chrome.",
      'Elegí "Agregar a pantalla de inicio" o "Instalar app".',
      'Confirmá tocando "Agregar" o "Instalar".',
    ],
  },
  ios: {
    title: "Agregar en iPhone",
    steps: [
      "Tocá el ícono de Compartir (el cuadrado con la flecha hacia arriba) en la barra inferior de Safari.",
      'Deslizá hacia abajo en el menú y elegí "Agregar a inicio".',
      'Tocá "Agregar" arriba a la derecha.',
    ],
  },
}

// Solo en /home (montado directamente en HomePage.tsx, no en un layout
// compartido) - a proposito informativo/discreto: va al final del
// contenido, despues del slideshow, en vez de un banner arriba que
// compita con las 4 cards principales por atencion.
export function AddToHomeScreen() {
  const [platform, setPlatform] = useState<Platform | null>(null)

  return (
    <div className="mt-10 flex flex-col items-center gap-3 border-t pt-8 text-center">
      <p className="text-sm font-medium">¿Te gusta fitnerd?</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Agregá un acceso directo a tu pantalla de inicio para entrar más
        rápido la próxima vez, sin tener que buscar el link.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={() => setPlatform("android")}>
          <Smartphone className="h-4 w-4" />
          Android
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPlatform("ios")}>
          <Apple className="h-4 w-4" />
          iPhone
        </Button>
      </div>

      {/* Un solo Dialog compartido por las dos plataformas - el contenido
          cambia segun "platform" en vez de tener dos Dialogs separados
          (mismo elemento, menos duplicacion). onOpenChange se dispara al
          cerrar (X, Esc, click afuera) - ahi volvemos platform a null. */}
      <Dialog
        open={platform !== null}
        onOpenChange={(open) => !open && setPlatform(null)}
      >
        <DialogContent>
          {platform && (
            <>
              <DialogHeader>
                <DialogTitle>{STEPS[platform].title}</DialogTitle>
              </DialogHeader>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {STEPS[platform].steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
