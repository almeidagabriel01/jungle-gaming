import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { RegisterBody } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, formValues, validate, type FieldErrors } from '@/lib/forms'
import { AuthSearch } from '@/session/redirect'
import { useRegister } from '@/session/session'

export const Route = createFileRoute('/register')({
  validateSearch: AuthSearch,
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const register = useRegister()
  const [errors, setErrors] = useState<FieldErrors>({})

  return (
    <section aria-labelledby="register-title" className="mx-auto grid w-full max-w-sm gap-4">
      <h1 id="register-title" className="text-2xl font-semibold">
        Criar conta
      </h1>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const result = validate(RegisterBody, formValues(form))
          if (result.errors) {
            setErrors(result.errors)
            focusFirstError(form, result.errors)
            return
          }
          setErrors({})
          register.mutate(result.data, {
            onSuccess: () => router.history.push(redirect ?? '/'),
            onError: (error) => {
              const fieldErrors = apiFieldErrors(error)
              setErrors(fieldErrors)
              focusFirstError(form, fieldErrors)
            },
          })
        }}
      >
        <Field label="Nome" name="name" autoComplete="name" required error={errors.name} />
        <Field label="E-mail" name="email" type="email" autoComplete="email" required error={errors.email} />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password}
        />
        <FormError message={errors._} />
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
      <p className="text-sm">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect }} className="underline">
          Entrar
        </Link>
      </p>
    </section>
  )
}
