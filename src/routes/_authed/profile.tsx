import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '@/components/field'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarBody, ChangePasswordBody, UpdateProfileBody, type User } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, formValues, validate, type FieldErrors } from '@/lib/forms'
import { useChangePassword, useProfile, useUpdateAvatar, useUpdateProfile } from '@/queries/account'

export const Route = createFileRoute('/_authed/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const profile = useProfile()
  return (
    <div className="grid max-w-xl gap-8">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      {profile.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : profile.isError ? (
        <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <>
          <AvatarForm user={profile.data} />
          <ProfileForm user={profile.data} />
          <PasswordForm />
        </>
      )}
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [errors, setErrors] = useState<FieldErrors>({})
  return (
    <form
      noValidate
      aria-labelledby="profile-data"
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const result = validate(UpdateProfileBody, formValues(form))
        if (result.errors) {
          setErrors(result.errors)
          focusFirstError(form, result.errors)
          return
        }
        setErrors({})
        update.mutate(result.data, { onError: (error) => setErrors(apiFieldErrors(error)) })
      }}
    >
      <h2 id="profile-data" className="font-semibold">
        Dados
      </h2>
      <Field label="Nome" name="name" defaultValue={user.name} error={errors.name} />
      <Field label="Nome de usuário" name="username" defaultValue={user.username} error={errors.username} />
      <Field label="Bio" name="bio" defaultValue={user.bio} error={errors.bio} />
      <p className="text-sm text-muted-foreground">E-mail: {user.email}</p>
      <FormError message={errors._} />
      <Button type="submit" disabled={update.isPending}>
        Salvar dados
      </Button>
    </form>
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

function AvatarForm({ user }: { user: User }) {
  const update = useUpdateAvatar()
  const [error, setError] = useState<string>()
  return (
    <section aria-labelledby="avatar-title" className="grid gap-3">
      <h2 id="avatar-title" className="font-semibold">
        Avatar
      </h2>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={`Avatar de ${user.name}`} width={96} height={96} className="size-24 rounded-full object-cover" data-testid="avatar" />
      ) : (
        <div className="grid size-24 place-items-center rounded-full bg-muted text-2xl" aria-hidden="true">
          {user.name.slice(0, 1)}
        </div>
      )}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Enviar imagem (PNG, JPEG ou WebP até 1 MB)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'avatar-error' : undefined}
          onChange={(e) => void upload(e.currentTarget.files?.[0])}
        />
      </label>
      {error && (
        <p id="avatar-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )

  async function upload(file: File | undefined) {
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
            update.mutate(dataUrl, { onError: (err) => setError(Object.values(apiFieldErrors(err))[0]) })
  }
}

function PasswordForm() {
  const change = useChangePassword()
  const [errors, setErrors] = useState<FieldErrors>({})
  return (
    <form
      noValidate
      aria-labelledby="password-title"
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const result = validate(ChangePasswordBody, formValues(form))
        if (result.errors) {
          setErrors(result.errors)
          focusFirstError(form, result.errors)
          return
        }
        setErrors({})
        change.mutate(result.data, {
          onSuccess: () => form.reset(),
          onError: (error) => {
            const fieldErrors = apiFieldErrors(error)
            setErrors(fieldErrors)
            focusFirstError(form, fieldErrors)
          },
        })
      }}
    >
      <h2 id="password-title" className="font-semibold">
        Alterar senha
      </h2>
      <Field label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" error={errors.currentPassword} />
      <Field label="Nova senha" name="newPassword" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.newPassword} />
      <FormError message={errors._} />
      <Button type="submit" disabled={change.isPending}>
        Alterar senha
      </Button>
    </form>
  )
}
