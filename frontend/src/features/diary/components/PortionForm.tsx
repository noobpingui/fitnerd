import type { ReactElement, ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { formatPortionPreview } from "../format"
import { portionNutrients } from "../nutrition"
import { gramsFormSchema, parseDecimalText, type GramsFormValues } from "../schemas"
import type { Nutrients } from "../types"

export function PortionForm({
  per100g,
  defaultGrams,
  submitLabel,
  isSaving,
  onSubmit,
  children,
}: {
  per100g: Nutrients
  defaultGrams: string
  submitLabel: string
  isSaving: boolean
  onSubmit: (grams: number) => void
  children?: ReactNode
}): ReactElement {
  const form = useForm<GramsFormValues>({
    resolver: zodResolver(gramsFormSchema),
    defaultValues: { grams: defaultGrams },
  })
  const grams = useWatch({ control: form.control, name: "grams" })
  const preview = formatPortionPreview(portionNutrients(per100g, parseDecimalText(grams) ?? 0))

  function handleSubmit(values: GramsFormValues) {
    if (isSaving) return
    onSubmit(parseDecimalText(values.grams) as number)
  }

  return (
    <Form {...form}>
      <form autoComplete="off" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="grams"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gramos</FormLabel>
              <FormControl>
                <Input type="text" inputMode="decimal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-sm text-muted-foreground">{preview}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando…" : submitLabel}
          </Button>
          {children}
        </div>
      </form>
    </Form>
  )
}
