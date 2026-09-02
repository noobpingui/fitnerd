import { Card, CardContent } from "@/components/ui/card"
import type { Store } from "@/features/store/constants"

export function StoreCard({ name, logo, url }: Store) {
  return (
    // target="_blank" + rel="noreferrer": abre en pestana nueva (no saca a
    // la persona de la app) - noreferrer evita que el sitio destino reciba
    // datos de referencia de que vino de aca, buena practica estandar para
    // cualquier link saliente a un dominio externo.
    <a href={url} target="_blank" rel="noreferrer">
      <Card className="transition-colors hover:border-primary">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <img
            src={logo}
            alt={name}
            className="h-20 w-20 rounded-md object-contain"
          />
          <span className="font-medium">{name}</span>
        </CardContent>
      </Card>
    </a>
  )
}
