import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  feedbackSchema,
  type FeedbackFormValues,
} from "@/features/feedback/schemas"
import { useCreateFeedback } from "@/features/feedback/hooks"
import { ApiError } from "@/lib/apiClient"

const categoryLabels: Record<FeedbackFormValues["category"], string> = {
  general: "General",
  suggestion: "Sugerencia",
  bug: "Reporte de error",
}

// category queda sin valor por defecto a proposito: asi el Select arranca
// mostrando el placeholder en vez de una categoria ya elegida, y obliga a
// una eleccion explicita en vez de asumir "general" por default.
const defaultValues: Partial<FeedbackFormValues> = {
  message: "",
}

export function FeedbackForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues,
  })
  const { mutate, isPending, error } = useCreateFeedback()

  function onSubmit(values: FeedbackFormValues) {
    mutate(values, { onSuccess })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensaje</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Cuéntanos qué se te ocurre, qué problema encontraste, o qué te gustaría ver..."
                  rows={5}
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

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Enviando..." : "Enviar feedback"}
        </Button>
      </form>
    </Form>
  )
}
