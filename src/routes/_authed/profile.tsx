import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { controlClass } from '@/components/account/form-classes'
import { EnsControl, FormField, type ControlProps } from '@/components/account/form-field'
import { FormError } from '@/components/field'
import { PasswordEyeIcon } from '@/components/icons/auth-icons'
import { HideIcon, ImageIcon } from '@/components/icons/account-icons'
import { AccountLayout } from '@/components/layout/account-layout'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarBody, ChangePasswordBody, UpdateProfileBody, type User } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, validate, type FieldErrors } from '@/lib/forms'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateAvatar, useUpdateProfile } from '@/queries/account'

export const Route = createFileRoute('/_authed/profile')({
  component: ProfilePage,
})

/** A confirmação só existe no cliente; a API recebe o `ChangePasswordBody`. */
const PasswordForm = ChangePasswordBody.and(z.object({ confirmPassword: z.string() })).refine((b) => b.newPassword === b.confirmPassword, {
  path: ['confirmPassword'],
  message: 'As senhas não conferem',
})

const sectionTitle = 'text-base leading-4'

function ProfilePage() {
  const profile = useProfile()
  return (
    <AccountLayout>
      <h1 className="sr-only">Perfil do colecionador</h1>
      {profile.isPending ? (
        <ProfileSkeleton />
      ) : profile.isError ? (
        <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <ProfileForm key={profile.data.id} user={profile.data} />
      )}
    </AccountLayout>
  )
}

type Values = { name: string; username: string; email: string; ensName: string; walletLabel: string }
type Passwords = { currentPassword: string; newPassword: string; confirmPassword: string }
const NO_PASSWORDS: Passwords = { currentPassword: '', newPassword: '', confirmPassword: '' }

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const change = useChangePassword()
  const [values, setValues] = useState<Values>({ name: user.name, username: user.username, email: user.email, ensName: user.ensName, walletLabel: user.walletLabel })
  const [passwords, setPasswords] = useState<Passwords>(NO_PASSWORDS)
  const [errors, setErrors] = useState<FieldErrors>({})
  const set = (name: keyof Values) => (value: string) => setValues((v) => ({ ...v, [name]: value }))
  const setPassword = (name: keyof Passwords) => (value: string) => setPasswords((p) => ({ ...p, [name]: value }))
  const changingPassword = Object.values(passwords).some(Boolean)
  const pending = update.isPending || change.isPending

  const text = (name: keyof Values, label: string, extra: { type?: string; autoComplete?: string } = {}) => (
    <FormField label={label} required error={errors[name]} className="gap-2.5">
      {(control) => <input {...control} name={name} value={values[name]} onChange={(e) => set(name)(e.target.value)} className={controlClass} {...extra} />}
    </FormField>
  )

  return (
    <form
      noValidate
      aria-labelledby="profile-title"
      className="grid gap-8"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const profile = validate(UpdateProfileBody, values)
        const password = changingPassword ? validate(PasswordForm, passwords) : null
        const clientErrors = { ...(profile.errors ?? {}), ...(password?.errors ?? {}) }
        setErrors(clientErrors)
        if (Object.keys(clientErrors).length > 0 || !profile.data) {
          focusFirstError(form, clientErrors)
          return
        }
        const fail = (error: unknown) => {
          const fieldErrors = apiFieldErrors(error)
          setErrors(fieldErrors)
          focusFirstError(form, fieldErrors)
        }
        update.mutate(profile.data, {
          onError: fail,
          onSuccess: () => {
            if (!password?.data) return
            const { currentPassword, newPassword } = password.data
            change.mutate({ currentPassword, newPassword }, { onSuccess: () => setPasswords(NO_PASSWORDS), onError: fail })
          },
        })
      }}
    >
      <h2 id="profile-title" className={`${sectionTitle} font-bold`}>
        Perfil do colecionador
      </h2>
      <div className="grid gap-y-6 lg:grid-cols-2 lg:gap-x-7">
        {text('name', 'Nome de exibição', { autoComplete: 'nickname' })}
        {text('username', 'Nome de usuário', { autoComplete: 'username' })}
        {text('email', 'E-mail', { type: 'email', autoComplete: 'email' })}
        <FormField label="Nome ENS" required error={errors.ensName} className="gap-2.5">
          {(control) => <EnsControl control={control} value={values.ensName} onChange={set('ensName')} />}
        </FormField>
        {text('walletLabel', 'Apelido da carteira')}
        <AvatarField user={user} />
      </div>

      <fieldset className="grid gap-6">
        <legend className={`${sectionTitle} mb-6 font-medium`}>Alterar senha</legend>
        {(
          [
            ['currentPassword', 'Senha atual', 'current-password'],
            ['newPassword', 'Nova senha', 'new-password'],
            ['confirmPassword', 'Confirmar nova senha', 'new-password'],
          ] as const
        ).map(([name, label, autoComplete]) => (
          <FormField
            key={name}
            label={label}
            error={errors[name]}
            hint={name === 'newPassword' ? 'Mínimo de 8 caracteres, com letras e números.' : undefined}
            className="max-w-[417px] gap-3"
            labelClassName="h-[15px]"
          >
            {(control) => <PasswordInput control={control} name={name} autoComplete={autoComplete} value={passwords[name]} onChange={setPassword(name)} />}
          </FormField>
        ))}
      </fieldset>

      <FormError message={errors._} />
      <Button type="submit" disabled={pending} className="h-10 w-[131px] justify-self-start rounded-[3px] px-0 text-sm leading-4">
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function PasswordInput({
  control,
  name,
  autoComplete,
  value,
  onChange,
}: {
  control: ControlProps
  name: string
  autoComplete: string
  value: string
  onChange: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...control}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} pr-12`}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label="Mostrar senha"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-3 my-auto grid size-7 cursor-pointer place-items-center rounded-sm text-subtle transition-colors hover:text-accent-text aria-pressed:text-accent-text"
      >
        {/* O Figma só tem o estado oculto; o aberto reaproveita o olho sem o risco. */}
        {visible ? <PasswordEyeIcon shown className="h-5 w-[23px]" /> : <HideIcon className="size-5" />}
      </button>
    </div>
  )
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Formato de arquivo inesperado'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })

/** Avatar: prévia, "Alterar" (envia a imagem pela API) e "Remover". Salva na hora, fora do "Salvar". */
function AvatarField({ user }: { user: User }) {
  const upload = useUpdateAvatar()
  const remove = useRemoveAvatar()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const busy = upload.isPending || remove.isPending

  async function send(file: File | undefined) {
    if (!file) return
    const dataUrl = await readAsDataUrl(file).catch(() => null)
    if (!dataUrl) {
      setError('Não foi possível ler a imagem')
      return
    }
    const result = validate(AvatarBody, { dataUrl })
    if (result.errors) {
      setError(result.errors.dataUrl)
      return
    }
    setError(undefined)
    upload.mutate(dataUrl, { onError: (err) => setError(Object.values(apiFieldErrors(err))[0]) })
  }

  return (
    <div role="group" aria-labelledby="avatar-label" className="grid content-start gap-2.5">
      <p id="avatar-label" className="text-[15px] leading-[15px]">
        Avatar
      </p>
      <div className="flex items-center gap-6">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={`Avatar de ${user.name}`} width={50} height={50} className="size-[50px] rounded-full border border-border object-cover" data-testid="avatar" />
        ) : (
          <span className="grid size-[50px] place-items-center rounded-full border border-border bg-raised text-primary">
            <ImageIcon className="size-6" />
            <span className="sr-only">Sem avatar</span>
          </span>
        )}
        <div className="flex items-center gap-5">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void send(e.currentTarget.files?.[0])
              e.currentTarget.value = ''
            }}
          />
          <Button
            type="button"
            aria-label="Alterar avatar"
            aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
            disabled={busy}
            onClick={() => input.current?.click()}
            className="h-10 w-[98px] rounded-[3px] px-0 text-sm leading-4"
          >
            Alterar
          </Button>
          <button
            type="button"
            aria-label="Remover avatar"
            disabled={busy || !user.avatarUrl}
            onClick={() => {
              setError(undefined)
              remove.mutate(undefined, { onError: (err) => setError(Object.values(apiFieldErrors(err))[0]) })
            }}
            className="min-h-6 cursor-pointer text-sm leading-4 transition-colors hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remover
          </button>
        </div>
      </div>
      <p id="avatar-hint" className="sr-only">
        PNG, JPEG ou WebP até 1 MB.
      </p>
      {error && (
        <p id="avatar-error" role="alert" className="text-[13px] leading-4 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Carregando perfil" className="grid gap-8">
      <Skeleton className="h-4 w-52" />
      <div className="grid gap-y-6 lg:grid-cols-2 lg:gap-x-7">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid gap-[17px] pt-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="grid max-w-[417px] gap-3">
          <Skeleton className="h-[15px] w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-[131px]" />
    </div>
  )
}
