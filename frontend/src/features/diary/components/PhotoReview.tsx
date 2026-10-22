import { useState, type ReactElement } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import type { CatalogFood } from "@/features/catalog/types"
import {
  catalogEntry,
  customEntry,
  formatProposalTotal,
  isSavable,
  proposalItems,
  proposalTotals,
} from "../proposal"
import { proposalFormSchema } from "../schemas"
import type { ProposalEntry, ProposalFormValues, SavableItemPayload } from "../types"
import { CustomFoodForm } from "./CustomFoodForm"
import { ProposalEntryRow } from "./ProposalEntryRow"
import { ProposalSearchStep } from "./ProposalSearchStep"

type View =
  | { name: "list" }
  | { name: "add" }
  | { name: "resolve"; index: number }
  | { name: "custom"; index: number }

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
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: { entries: initialEntries },
  })
  const { fields, append, update, remove } = useFieldArray({
    control: form.control,
    name: "entries",
  })
  const watched = form.watch("entries")
  const entries: ProposalEntry[] = fields.map(
    (field, index) => (watched?.[index] ?? field) as ProposalEntry
  )

  const hasUnmatched = entries.some((entry) => entry.kind === "unmatched")
  const canSave = entries.some(isSavable)

  function backToList() {
    setView({ name: "list" })
  }

  function handleSubmit(values: ProposalFormValues) {
    if (isSaving) return
    onSave(proposalItems(values.entries))
  }

  if (view.name === "add" || view.name === "resolve") {
    const target = view.name === "resolve" ? entries[view.index] : null
    return (
      <ProposalSearchStep
        initialQuery={target?.name ?? ""}
        onBack={backToList}
        onSelect={(food: CatalogFood) => {
          if (view.name === "resolve") {
            const current = entries[view.index]
            update(view.index, catalogEntry(food, String(current.grams)))
          } else {
            append(catalogEntry(food, "100"))
          }
          backToList()
        }}
      />
    )
  }

  if (view.name === "custom") {
    const current = entries[view.index]
    const index = view.index
    return (
      <CustomFoodForm
        defaultName={current.name}
        defaultGrams={String(current.grams)}
        submitLabel="Añadir a la propuesta"
        isSaving={false}
        onSubmit={(payload) => {
          update(index, customEntry(payload))
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
              onSearch={() => setView({ name: "resolve", index })}
              onCreate={() => setView({ name: "custom", index })}
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
            onClick={() => setView({ name: "add" })}
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
