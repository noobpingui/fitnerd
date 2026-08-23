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
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas"
import { useLogin } from "@/features/auth/hooks"
import { ApiError } from "@/lib/apiClient"

export function LoginForm() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const { mutate, isPending, error } = useLogin()

  function onSubmit(values: LoginFormValues) {
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
                <Input type="email" placeholder="tu@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Algo salio mal"}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          No tenes cuenta?{" "}
          <Link
            to="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            Registrate
          </Link>
        </p>
      </form>
    </Form>
  )
}
