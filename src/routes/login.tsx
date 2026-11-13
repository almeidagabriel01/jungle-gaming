import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { LoginBody } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, formValues, validate, type FieldErrors } from '@/lib/forms'
import { AuthSearch } from '@/session/redirect'
import { useLogin } from '@/session/session'

export const Route = createFileRoute('/login')({
  validateSearch: AuthSearch,
  component: LoginPage,
})

function LoginPage() {
  const { redirect, reason } = Route.useSearch()
  const router = useRouter()
  const login = useLogin()
  const [errors, setErrors] = useState<FieldErrors>({})

  return (
    <section aria-labelledby="login-title" className="mx-auto grid w-full max-w-sm gap-4">
      <h1 id="login-title" className="text-2xl font-semibold">
        Entrar
      </h1>
      {reason === 'expired' && (
        <p role="status" className="rounded-md border p-3 text-sm">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const result = validate(LoginBody, formValues(form))
          if (result.errors) {
            setErrors(result.errors)
            focusFirstError(form, result.errors)
            return
          }
          setErrors({})
          login.mutate(result.data, {
            onSuccess: () => router.history.push(redirect ?? '/'),
            onError: (error) => {
              setErrors(apiFieldErrors(error))
            },
          })
        }}
      >
        <Field label="E-mail" name="email" type="email" autoComplete="email" required error={errors.email} />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" required error={errors.password} />
        <FormError message={errors._} />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="text-sm">
        Não tem conta?{' '}
        <Link to="/register" search={{ redirect }} className="underline">
          Criar conta
        </Link>
      </p>
    </section>
  )
}
