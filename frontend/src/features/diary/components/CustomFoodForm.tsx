import type { ReactElement, ReactNode } from "react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
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
import {
  CUSTOM_NAME_MAX_LENGTH,
  customFoodFormSchema,
  customItemPayload,
  parseDecimalText,
  type CustomFoodFormValues,
} from "../schemas"
import type { CustomItemPayload } from "../types"

const NUMBER_FIELDS: { name: FieldPath<CustomFoodFormValues>; label: string }[] = [
  { name: "grams", label: "Gramos" },
  { name: "calories", label: "Calorías por 100 g (kcal)" },
  { name: "protein", label: "Proteína por 100 g (g)" },
  { name: "carbs", label: "Carbohidratos por 100 g (g)" },
  { name: "fat", label: "Grasa por 100 g (g)" },
]

export function CustomFoodForm({
  defaultName,
  isSaving,
  onSubmit,
  children,
}: {
  defaultName: string
  isSaving: boolean
  onSubmit: (payload: CustomItemPayload) => void
  children?: ReactNode
}): ReactElement {
  const form = useForm<CustomFoodFormValues>({
    resolver: zodResolver(customFoodFormSchema),
    defaultValues: {
      name: defaultName,
      grams: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    },
  })
  const values = useWatch({ control: form.control })

  // La vista previa solo se calcula cuando todos los números son válidos.
  const grams = parseDecimalText(values.grams ?? "")
  const calories = parseDecimalText(values.calories ?? "")
  const protein = parseDecimalText(values.protein ?? "")
  const carbs = parseDecimalText(values.carbs ?? "")
  const fat = parseDecimalText(values.fat ?? "")
  const preview =
    grams !== null && calories !== null && protein !== null && carbs !== null && fat !== null
      ? formatPortionPreview(
          portionNutrients(
            { calories_kcal: calories, protein_g: protein, carbs_g: carbs, fat_g: fat },
            grams
          )
        )
      : null

  const macroSumError = (
    form.formState.errors as Record<string, { message?: string } | undefined>
  ).macroSum?.message

  function handleSubmit(submitted: CustomFoodFormValues) {
    if (isSaving) return
    onSubmit(customItemPayload(submitted))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input type="text" maxLength={CUSTOM_NAME_MAX_LENGTH} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {NUMBER_FIELDS.map(({ name, label }) => (
          <div key={name}>
            <FormField
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input type="text" inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {name === "fat" && macroSumError && (
              <p className="mt-1 text-sm text-destructive">{macroSumError}</p>
            )}
          </div>
        ))}
        {preview && <p className="text-sm text-muted-foreground">{preview}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Añadir"}
          </Button>
          {children}
        </div>
      </form>
    </Form>
  )
}
