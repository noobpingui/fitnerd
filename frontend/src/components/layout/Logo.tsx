import { cn } from "@/lib/utils"

// Tratamiento propio del nombre: "nerd" en tipografia monoespaciada (la
// de codigo), reforzando el angulo "cientifico/tecnico" del copy. El
// brillo (.text-shine, ver index.css) se aplica por separado a cada mitad
// -no a un span unico envolvente- porque background-clip:text no se
// hereda a los hijos: si el gradiente estuviera solo en el span externo,
// "nerd" (que tiene su propia fuente) quedaria invisible en vez de brillar.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold", className)}>
      <span className="text-shine">fit</span>
      <span className="text-shine font-mono">nerd</span>
    </span>
  )
}
