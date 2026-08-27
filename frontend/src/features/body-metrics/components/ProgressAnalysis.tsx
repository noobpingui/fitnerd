import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { useAnalyzeBodyMetrics } from "@/features/body-metrics/hooks"

export function ProgressAnalysis() {
  const { mutate, data, isPending, isError, error } = useAnalyzeBodyMetrics()

  return (
    <div className="mb-8">
      <Button
        type="button"
        // default (relleno, con el color primario) en vez de outline - un
        // llamado a la accion mas protagonico, no un boton secundario mas.
        variant="default"
        size="lg"
        // mutate() sin argumentos: analyzeBodyMetrics no necesita ningun
        // dato del cliente, el backend ya sabe quien sos (por el JWT) y
        // resuelve todo del lado del servidor.
        onClick={() => mutate()}
        disabled={isPending}
        // Mismo lenguaje de "boton vivo" que ya usamos en el avatar/logo
        // del navbar: crece un poco en hover, se achica al clickear,
        // animado. scale-105 (no 110, como el avatar) porque este boton
        // es ancho/rectangular - una escala mas grande se ve exagerada
        // en un elemento con texto largo.
        className="gap-2 text-base transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <Sparkles className="h-5 w-5" />
        {isPending
          ? "Analizando..."
          : "Pídele al IA Coach que analice tu progreso"}
      </Button>

      {isError && error instanceof ApiError && error.status === 429 ? (
        // 429 (limite de analisis por dia) no es una falla real - es una
        // respuesta esperada del sistema, no un error tecnico. Se muestra
        // en tono neutro (muted), sin el rojo de destructive ni el prefijo
        // "Error (xxx):", que hace que se lea como que algo se rompio.
        <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
      ) : (
        isError && (
          <p className="mt-3 text-sm text-destructive">
            Error ({error instanceof ApiError ? error.status : "?"}):{" "}
            {error.message}
          </p>
        )
      )}

      {data && (
        // whitespace-pre-line respeta los saltos de linea/parrafos que
        // venga del texto de Claude, sin necesitar un renderer de
        // markdown - el prompt le pide prosa simple, no listas/formato.
        <Card className="mt-3">
          <CardContent className="whitespace-pre-line text-sm leading-relaxed">
            {data.analysis}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
