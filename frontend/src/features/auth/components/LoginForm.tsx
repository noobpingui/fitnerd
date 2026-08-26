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
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton"
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
                <Input type="email" placeholder="tucorreo@email.com" {...field} />
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Algo salió mal"}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          O
          <div className="h-px flex-1 bg-border" />
        </div>

        <GoogleSignInButton />

        <p className="text-center text-sm text-muted-foreground">
          ¿No tenés cuenta?{" "}
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
