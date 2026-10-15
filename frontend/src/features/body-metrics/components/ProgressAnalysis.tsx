import { CircleAlert, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { CalorieSuggestionBlock } from "@/features/body-metrics/components/CalorieSuggestionBlock"
import { useAnalyzeBodyMetrics } from "@/features/body-metrics/hooks"
import type { AnalysisRequest } from "@/features/body-metrics/types"

// `request` es el contexto que ya calcula la pantalla (null sin perfil: el
// servidor responde 409 y se muestra el aviso).
export function ProgressAnalysis({
  request,
  warning = null,
}: {
  request: AnalysisRequest | null
  warning?: string | null
}) {
  const { mutate, data, isPending, isError, error } = useAnalyzeBodyMetrics()

  return (
    <div>
      {warning && (
        <p
          data-tone="warn"
          className="mb-3 flex items-start gap-2 text-sm text-amber-500"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
      <Button
        type="button"
        // default (relleno, con el color primario) en vez de outline - un
        // llamado a la accion mas protagonico, no un boton secundario mas.
        variant="default"
        size="lg"
        onClick={() => mutate(request)}
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

      {isError && error instanceof ApiError &&
        (error.status === 429 || error.status === 409) ? (
        // 429 (limite de analisis por dia) y 409 (falta el perfil) no son
        // fallas reales - son respuestas esperadas del sistema, no errores técnicos. Se muestra
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

      {data?.calorie_suggestion && (
        <CalorieSuggestionBlock suggestion={data.calorie_suggestion} />
      )}
    </div>
  )
}
