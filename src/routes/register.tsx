import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { AuthField } from '@/components/auth/auth-field'
import { AuthScreen, SocialAuth } from '@/components/auth/auth-screen'
import { FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { RegisterBody } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, formValues, validate, type FieldErrors } from '@/lib/forms'
import { AuthSearch } from '@/session/redirect'
import { useRegister } from '@/session/session'

export const Route = createFileRoute('/register')({
  validateSearch: AuthSearch,
  component: RegisterPage,
})

/** A confirmação de senha só existe no cliente; a API recebe o `RegisterBody`. */
const RegisterForm = RegisterBody.extend({ confirmPassword: z.string().min(1, 'Confirme a senha') }).refine(
  (b) => b.password === b.confirmPassword,
  { path: ['confirmPassword'], message: 'As senhas não conferem' },
)

function RegisterPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const register = useRegister()
  const [errors, setErrors] = useState<FieldErrors>({})

  return (
    <AuthScreen
      mode="register"
      title="Criar perfil de colecionador"
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      redirect={redirect}
    >
      <form
        noValidate
        className="flex flex-col gap-10 md:gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const result = validate(RegisterForm, formValues(form))
          if (result.errors) {
            setErrors(result.errors)
            focusFirstError(form, result.errors)
            return
          }
          setErrors({})
          const { confirmPassword: _, ...body } = result.data
          register.mutate(body, {
            onSuccess: () => router.history.push(redirect ?? '/'),
            onError: (error) => {
              const fieldErrors = apiFieldErrors(error)
              setErrors(fieldErrors)
              focusFirstError(form, fieldErrors)
            },
          })
        }}
      >
        <div className="flex flex-col gap-3">
          <AuthField
            label="Nome de usuário"
            name="username"
            autoComplete="username"
            required
            error={errors.username}
            className="max-md:placeholder:text-center"
          />
          <AuthField label="E-mail" name="email" type="email" autoComplete="email" placeholder="Digite seu e-mail" required error={errors.email} />
          <AuthField
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="Mínimo de 8 caracteres, com letras e números."
            error={errors.password}
          />
          <AuthField label="Confirmar senha" name="confirmPassword" type="password" autoComplete="new-password" required error={errors.confirmPassword} />
          <FormError message={errors._} />
        </div>
        <Button type="submit" disabled={register.isPending} className="h-[60px] rounded-[10px] text-base leading-4 md:h-[45px] md:rounded-[5px]">
          {register.isPending ? (
            'Criando conta…'
          ) : (
            <>
              <span className="md:hidden">Criar perfil</span>
              <span className="max-md:hidden">Criar conta</span>
            </>
          )}
        </Button>
      </form>
      <SocialAuth desktopGap="md:gap-4" />
    </AuthScreen>
  )
}
