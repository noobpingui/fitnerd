import type { ReactElement } from "react"
import { useFormContext, type FieldPath } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { formatLoggedGrams, formatPortionPreview } from "../format"
import { entryNutrients, entryTag } from "../proposal"
import type { ProposalEntry, ProposalFormValues } from "../types"

// Una fila de la propuesta; vive dentro del <Form> de PhotoReview.
export function ProposalEntryRow({
  index,
  entry,
  onRemove,
  onSearch,
  onCreate,
}: {
  index: number
  entry: ProposalEntry
  onRemove: () => void
  onSearch: () => void
  onCreate: () => void
}): ReactElement {
  const { control } = useFormContext<ProposalFormValues>()
  const nutrients = entryNutrients(entry)

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{entry.name}</p>
        <span className="text-sm text-muted-foreground">{entryTag(entry)}</span>
      </div>

      {entry.kind === "unmatched" ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">Sin coincidencia en el catálogo</p>
          <p className="text-sm tabular-nums">{formatLoggedGrams(entry.grams)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Buscar ${entry.name} en el catálogo`}
              onClick={onSearch}
            >
              Buscar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Crear ${entry.name} como personalizado`}
              onClick={onCreate}
            >
              Crear
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Quitar ${entry.name}`}
              onClick={onRemove}
            >
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <FormField
            control={control}
            name={`entries.${index}.grams` as FieldPath<ProposalFormValues>}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">{`Gramos de ${entry.name}`}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...field}
                    value={String(field.value ?? "")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {nutrients && (
            <p className="text-sm text-muted-foreground">{formatPortionPreview(nutrients)}</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Quitar ${entry.name}`}
            onClick={onRemove}
          >
            Quitar
          </Button>
        </div>
      )}
    </li>
  )
}
