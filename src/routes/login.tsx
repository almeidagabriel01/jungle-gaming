import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthField } from '@/components/auth/auth-field'
import { AuthScreen, SocialAuth } from '@/components/auth/auth-screen'
import { FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { LoginBody } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, formValues, validate, type FieldErrors } from '@/lib/forms'
import { unavailable } from '@/lib/unavailable'
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
    <AuthScreen
      mode="login"
      title="Entrar"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
      redirect={redirect}
    >
      {reason === 'expired' && (
        <p role="status" className="rounded-[5px] border border-border-soft bg-raised p-3 text-[13px] text-foreground">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <form
        noValidate
        className="flex flex-col gap-10 md:gap-6"
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
            onError: (error) => setErrors(apiFieldErrors(error)),
          })
        }}
      >
        <div className="flex flex-col gap-3">
          <AuthField label="E-mail" name="email" type="email" autoComplete="email" placeholder="contato@email.com" required error={errors.email} />
          <AuthField label="Senha" name="password" type="password" autoComplete="current-password" required error={errors.password} />
          <Button
            type="button"
            variant="link"
            className="h-4 self-end px-0 text-sm leading-4 font-normal"
            onClick={() => unavailable('A recuperação de senha')}
          >
            Esqueceu a senha?
          </Button>
          <FormError message={errors._} />
        </div>
        <Button type="submit" pending={login.isPending} className="h-[60px] rounded-[10px] text-base leading-4 md:h-[45px] md:rounded-[5px]">
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <SocialAuth desktopGap="md:gap-3" />
    </AuthScreen>
  )
}
