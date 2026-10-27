import { useState, type ReactElement } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import {
  customEntry,
  formatProposalTotal,
  isSavable,
  libraryEntry,
  mergeProposalEntries,
  proposalItems,
  proposalTotals,
  unlinkCustomFood,
  withEntryKey,
} from "../proposal"
import { proposalReviewSchema } from "../schemas"
import type {
  ProposalEntry,
  ProposalFormEntry,
  ProposalFormValues,
  SavableItemPayload,
} from "../types"
import { CustomFoodForm } from "./CustomFoodForm"
import { FoodSearchPanel } from "./FoodSearchPanel"
import { ProposalEntryRow } from "./ProposalEntryRow"

type View =
  | { name: "list" }
  | { name: "search"; index: number | null } // null = añadir otro alimento; si no, resolver esa fila
  | { name: "custom"; index: number | null; foodName: string; grams: string }

const UNMATCHED_NOTICE =
  "Los alimentos sin coincidencia no se guardan: búscalos en el catálogo, créalos como personalizados o quítalos."
const NO_SAVABLE_NOTICE = "Añade al menos un alimento para guardar."

// Propuesta editable del análisis. El formulario vive aquí, así que cambiar de
// vista (búsqueda, personalizado) y volver no pierde lo que el usuario editó.
export function PhotoReview({
  initialEntries,
  label,
  isSaving,
  saveError,
  onSave,
  onCancel,
}: {
  initialEntries: ProposalEntry[]
  label: string
  isSaving: boolean
  saveError: string | null
  onSave: (items: SavableItemPayload[]) => void
  onCancel: () => void
}): ReactElement {
  const [view, setView] = useState<View>({ name: "list" })
  const [defaultValues] = useState<ProposalFormValues>(() => ({
    entries: initialEntries.map(withEntryKey),
  }))
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalReviewSchema),
    defaultValues,
  })
  const { fields, append, update, remove, replace } = useFieldArray({
    control: form.control,
    name: "entries",
  })
  // Los gramos de cada fila se leen por su clave, nunca por su posición.
  const watched = useWatch({ control: form.control, name: "entries" })
  const entries = mergeProposalEntries(fields, watched)

  const hasUnmatched = entries.some((entry) => entry.kind === "unmatched")
  const canSave = entries.some(isSavable)

  // Un alimento propio borrado de la biblioteca deja de estar vinculado, pero la fila se conserva.
  function unlinkDeleted(customFoodId: number) {
    replace(
      entries.map((entry): ProposalFormEntry => {
        const unlinked = unlinkCustomFood(entry, customFoodId)
        return unlinked ? withEntryKey(unlinked) : entry
      })
    )
  }

  function backToList() {
    setView({ name: "list" })
  }

  function handleSubmit(values: ProposalFormValues) {
    if (isSaving) return
    onSave(proposalItems(values.entries))
  }

  if (view.name === "search") {
    const index = view.index
    const target = index === null ? null : entries[index]
    return (
      <FoodSearchPanel
        initialQuery={target?.name ?? ""}
        onSelect={(food, defaultGrams) => {
          if (index === null) {
            append(withEntryKey(libraryEntry(food, defaultGrams)))
          } else {
            update(index, withEntryKey(libraryEntry(food, String(entries[index].grams))))
          }
          backToList()
        }}
        onCustomFoodDeleted={unlinkDeleted}
        onCreateCustom={(name) =>
          setView({
            name: "custom",
            index,
            foodName: name || target?.name || "",
            grams: target ? String(target.grams) : "",
          })
        }
        actions={
          <Button type="button" variant="outline" onClick={backToList}>
            Volver a la propuesta
          </Button>
        }
      />
    )
  }

  if (view.name === "custom") {
    const { index, foodName, grams } = view
    return (
      <CustomFoodForm
        defaultName={foodName}
        defaultGrams={grams}
        submitLabel="Añadir a la propuesta"
        isSaving={false}
        onSubmit={(payload) => {
          const entry = withEntryKey(customEntry(payload))
          if (index === null) append(entry)
          else update(index, entry)
          backToList()
        }}
      >
        <Button type="button" variant="outline" onClick={backToList}>
          Volver a la propuesta
        </Button>
      </CustomFoodForm>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}

        <ul aria-label="Alimentos de la propuesta" className="space-y-3">
          {fields.map((field, index) => (
            <ProposalEntryRow
              key={field.id}
              index={index}
              entry={entries[index]}
              onRemove={() => remove(index)}
              onSearch={() => setView({ name: "search", index })}
              onCreate={() =>
                setView({
                  name: "custom",
                  index,
                  foodName: entries[index].name,
                  grams: String(entries[index].grams),
                })
              }
            />
          ))}
        </ul>

        {hasUnmatched && <p className="text-sm text-muted-foreground">{UNMATCHED_NOTICE}</p>}
        <p className="font-medium tabular-nums">{formatProposalTotal(proposalTotals(entries))}</p>
        {!canSave && <p className="text-sm text-muted-foreground">{NO_SAVABLE_NOTICE}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => setView({ name: "search", index: null })}
          >
            Añadir otro alimento
          </Button>
          <Button type="submit" disabled={isSaving || !canSave}>
            {isSaving ? "Guardando…" : `Guardar en ${label}`}
          </Button>
          <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}
