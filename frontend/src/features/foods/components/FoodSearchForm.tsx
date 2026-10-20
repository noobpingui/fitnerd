import type { ReactElement } from "react"
import { useForm } from "react-hook-form"
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
import {
  FOOD_QUERY_MAX_LENGTH,
  foodSearchFormSchema,
  type FoodSearchFormValues,
} from "../schemas"

export function FoodSearchForm({
  onSearch,
  isSearching,
  defaultQuery = "",
}: {
  onSearch: (query: string) => void
  isSearching: boolean
  defaultQuery?: string
}): ReactElement {
  const form = useForm<FoodSearchFormValues>({
    resolver: zodResolver(foodSearchFormSchema),
    defaultValues: { query: defaultQuery },
  })

  function onSubmit(values: FoodSearchFormValues) {
    onSearch(values.query)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="query"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Buscar alimento</FormLabel>
              <FormControl>
                <Input
                  type="search"
                  placeholder="Ej.: chicken breast, arroz blanco"
                  maxLength={FOOD_QUERY_MAX_LENGTH}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSearching}>
          Buscar
        </Button>
      </form>
    </Form>
  )
}
