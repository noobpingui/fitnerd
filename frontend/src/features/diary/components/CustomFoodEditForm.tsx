import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactElement } from "react"
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
import { customFoodNameKey } from "@/features/food-library/names"
import { useCustomFoodNameCheck } from "@/features/food-library/hooks"
import type { CustomFoodUpdatePayload, CustomLibraryFood } from "@/features/food-library/types"
import { useEscapeCapture } from "@/lib/useEscapeCapture"
import { SEARCH_DEBOUNCE_MS } from "../constants"
import {
  CUSTOM_FOOD_NAME_CHECKING_MESSAGE,
  customFoodEditDefaults,
  customFoodEditPayload,
  isCustomFoodEditUnchanged,
} from "../customFoodEdit"
import { CUSTOM_FOOD_NAME_TAKEN_MESSAGE } from "../errors"
import { CUSTOM_NAME_MAX_LENGTH, customFoodEditSchema, type CustomFoodEditValues } from "../schemas"

const NUMBER_FIELDS: { name: FieldPath<CustomFoodEditValues>; label: string }[] = [
  { name: "calories", label: "Calorías por 100 g (kcal)" },
  { name: "protein", label: "Proteína por 100 g (g)" },
  { name: "carbs", label: "Carbohidratos por 100 g (g)" },
  { name: "fat", label: "Grasa por 100 g (g)" },
]

// Recibe de FormControl el aria-describedby del campo y le añade el aviso de nombre repetido.
function NameInput({
  describedBy,
  ...props
}: ComponentProps<typeof Input> & { describedBy: string | null }): ReactElement {
  const base = props["aria-describedby"]
  const merged = [base, describedBy].filter(Boolean).join(" ") || undefined
  return <Input {...props} aria-describedby={merged} />
}

// Formulario de edición de un alimento propio, en línea dentro de la lista (spec 029).
export function CustomFoodEditForm({
  food,
  isSaving,
  serverError,
  nameTakenKey,
  onSubmit,
  onCancel,
}: {
  food: CustomLibraryFood
  isSaving: boolean
  serverError: string | null
  nameTakenKey: string | null
  onSubmit: (payload: CustomFoodUpdatePayload) => void
  onCancel: () => void
}): ReactElement {
  const titleId = useId()
  const takenId = useId()
  const form = useForm<CustomFoodEditValues>({
    resolver: zodResolver(customFoodEditSchema),
    defaultValues: customFoodEditDefaults(food),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  })
  const watched = useWatch({ control: form.control })
  const values: CustomFoodEditValues = {
    name: watched.name ?? "",
    calories: watched.calories ?? "",
    protein: watched.protein ?? "",
    carbs: watched.carbs ?? "",
    fat: watched.fat ?? "",
  }

  useEffect(() => {
    form.setFocus("name")
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tras un guardado fallido (los botones estuvieron deshabilitados) el foco vuelve a «Nombre».
  const wasSaving = useRef(false)
  useEffect(() => {
    if (wasSaving.current && !isSaving) form.setFocus("name")
    wasSaving.current = isSaving
    // form es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving])

  // Si el fallo llega sin que se vea el estado «guardando», el foco también vuelve a «Nombre».
  useEffect(() => {
    if (serverError !== null || nameTakenKey !== null) form.setFocus("name")
    // form es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverError, nameTakenKey])

  const check = useCustomFoodNameCheck(food, values.name, SEARCH_DEBOUNCE_MS)
  const takenByServer =
    nameTakenKey !== null && customFoodNameKey(values.name.trim()) === nameTakenKey
  const showTaken = check.taken || takenByServer
  const unchanged = isCustomFoodEditUnchanged(values, food)
  const [checkingNoticeFor, setCheckingNoticeFor] = useState<string | null>(null)
  const blocked = isSaving || unchanged || check.checking || showTaken

  useEscapeCapture(() => {
    if (!isSaving) onCancel()
  }, true)

  const macroSumError = (
    form.formState.errors as Record<string, { message?: string } | undefined>
  ).macroSum?.message

  function handleSubmit(submitted: CustomFoodEditValues) {
    if (!isSaving && check.checking) {
      setCheckingNoticeFor(values.name)
      return
    }
    if (blocked) return
    onSubmit(customFoodEditPayload(submitted))
  }

  // Con «Guardar» deshabilitado el navegador no envía con Intro: se avisa de que se está comprobando.
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.target instanceof HTMLButtonElement) return
    if (!isSaving && check.checking) {
      event.preventDefault()
      setCheckingNoticeFor(values.name)
    }
  }

  return (
    <form
      aria-labelledby={titleId}
      autoComplete="off"
      noValidate
      onSubmit={form.handleSubmit(handleSubmit)}
      onKeyDown={handleKeyDown}
      className="mt-3 space-y-3 rounded-lg border p-4"
    >
      <div id={titleId} className="font-medium">{`Editar «${food.name}»`}</div>
      <Form {...form}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <NameInput
                  type="text"
                  maxLength={CUSTOM_NAME_MAX_LENGTH}
                  describedBy={showTaken ? takenId : null}
                  {...field}
                />
              </FormControl>
              <p id={takenId} role="status" aria-live="polite" className="text-sm text-destructive">
                {showTaken
                  ? CUSTOM_FOOD_NAME_TAKEN_MESSAGE
                  : check.checking && checkingNoticeFor === values.name
                    ? CUSTOM_FOOD_NAME_CHECKING_MESSAGE
                    : ""}
              </p>
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
      </Form>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={blocked}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
    </form>
  )
}
