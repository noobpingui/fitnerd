import type { ReactNode } from "react"
import { motion } from "motion/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AuthHero } from "@/features/auth/components/AuthHero"

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: ReactNode
  description: string
  children: ReactNode
}) {
  return (
    // min-h-dvh en vez de min-h-screen: mismo motivo que el fix de CoachPage
    // (dvh se ajusta al espacio realmente visible, sin el salto que da vh
    // cuando la barra de direcciones del navegador movil aparece/desaparece) -
    // aca importa mas todavia porque el video de fondo tiene que cubrir
    // exactamente ese alto sin dejar franjas vacias.
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4 py-12">
      {/* isolate en el div de arriba: fuerza a que ESTE div cree su propio
          "stacking context". Sin esto, position:relative solo (sin
          z-index) no alcanza para crear uno, y los hijos con z-index
          negativo (video/overlay/blob) se "escapan" hacia el stacking
          context del ancestro mas cercano que si lo tiene (el motion.div
          de PageTransition, por el transform que le aplica Framer Motion) -
          ahi, el propio fondo opaco de este div se pinta ENCIMA de esos
          hijos negativos, tapandolos por completo. isolate lo evita.

          Video de fondo: absolute (no fixed) anclado a este mismo div
          "relative" - igual que la mancha decorativa de abajo. Nota: fixed
          NO sirve aca porque esta pantalla esta envuelta en PageTransition,
          y motion.div le aplica un "transform" inline (para animar la
          entrada/salida) - un ancestro con transform hace que position:fixed
          deje de posicionarse contra el viewport real y pase a posicionarse
          contra ese ancestro, rompiendo el efecto de pantalla completa.
          object-cover llena el rectangulo sin deformar la imagen. autoPlay+
          loop necesitan muted para que el navegador los permita sin
          interaccion del usuario; playsInline evita que iOS lo abra a
          pantalla completa solo. -z-30 lo manda detras de todo. */}
      <video
        aria-hidden
        autoPlay
        muted
        loop
        playsInline
        className="pointer-events-none absolute inset-0 -z-30 h-full w-full object-cover"
      >
        <source src="/videos/auth-bg.mp4" type="video/mp4" />
      </video>
      {/* Capa oscura semi-transparente sobre el video, para que el texto del
          form y del hero mantengan contraste contra un fondo en movimiento. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-background/70"
      />

      {/* Mancha de fondo decorativa, en loop infinito - le da el toque
          "vivo" al fondo sin distraer del formulario. aria-hidden porque
          es puramente visual, no aporta nada a un lector de pantalla. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-full max-w-md">
        <AuthHero />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
