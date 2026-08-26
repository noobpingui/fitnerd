import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  bodyMetricSchema,
  type BodyMetricFormValues,
} from "@/features/body-metrics/schemas"
import { todayIsoDate } from "@/features/body-metrics/dateUtils"
import { useCreateBodyMetric } from "@/features/body-metrics/hooks"
import { ApiError } from "@/lib/apiClient"

const defaultValues: BodyMetricFormValues = {
  weight: "",
  body_fat_percentage: "",
  muscle_mass_percentage: "",
  notes: "",
  recorded_at: todayIsoDate(),
}

export function BodyMetricForm() {
  const form = useForm<BodyMetricFormValues>({
    resolver: zodResolver(bodyMetricSchema),
    defaultValues,
  })
  const { mutate, isPending, error } = useCreateBodyMetric()

  function onSubmit(values: BodyMetricFormValues) {
    // Aca es donde los strings del form se convierten en lo que el backend
    // realmente espera: numeros reales, y "" pasa a ser "no mandar el
    // campo" (undefined) en vez de mandar un string vacio.
    mutate(
      {
        weight: values.weight === "" ? undefined : Number(values.weight),
        body_fat_percentage:
          values.body_fat_percentage === ""
            ? undefined
            : Number(values.body_fat_percentage),
        muscle_mass_percentage:
          values.muscle_mass_percentage === ""
            ? undefined
            : Number(values.muscle_mass_percentage),
        notes: values.notes || undefined,
        recorded_at: values.recorded_at,
      },
      {
        // Solo al confirmar que el backend lo acepto: limpiamos el form
        // para que quede listo para cargar otro registro, sin recargar
        // la pagina.
        onSuccess: () => form.reset({ ...defaultValues, recorded_at: todayIsoDate() }),
      }
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="recorded_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Peso (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="70.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="body_fat_percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>% Grasa corporal</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="18" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="muscle_mass_percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>% Masa muscular</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="42" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Como te sentiste, condiciones de la medicion, etc."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Algo salió mal"}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar registro"}
        </Button>
      </form>
    </Form>
  )
}
