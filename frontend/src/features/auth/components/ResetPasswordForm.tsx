import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router"
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
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/schemas"
import { useResetPassword } from "@/features/auth/hooks"
import { ApiError } from "@/lib/apiClient"

export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })
  const { mutate, isPending, error } = useResetPassword()

  function onSubmit(values: ResetPasswordFormValues) {
    mutate({ token, password: values.password })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nueva contraseña</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar contraseña</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {error instanceof ApiError ? error.message : "Algo salió mal"}
            </p>
            <Link
              to="/forgot-password"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Solicitar un enlace nuevo
            </Link>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar contraseña"}
        </Button>
      </form>
    </Form>
  )
}
