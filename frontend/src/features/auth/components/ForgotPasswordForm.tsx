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
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/schemas"
import { useRequestPasswordReset } from "@/features/auth/hooks"
import { ApiError } from "@/lib/apiClient"

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })
  const { mutate, isPending, isSuccess, error } = useRequestPasswordReset()

  function onSubmit(values: ForgotPasswordFormValues) {
    mutate(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="tucorreo@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isSuccess && (
          <p role="status" className="text-sm text-primary">
            Si el correo pertenece a una cuenta con contraseña, recibirás un enlace
            para restablecerla. Revisa tu bandeja de entrada y la carpeta de spam.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Algo salió mal"}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Enviando..." : "Enviar enlace"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Volver al login
          </Link>
        </p>
      </form>
    </Form>
  )
}
