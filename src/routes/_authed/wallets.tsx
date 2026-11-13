import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, FormError } from '@/components/field'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WalletBody, type Wallet } from '@/contracts/account'
import { Network } from '@/contracts/common'
import { apiFieldErrors, focusFirstError, formValues, validate, type FieldErrors } from '@/lib/forms'
import { useSaveWallet, useWallets } from '@/queries/account'

export const Route = createFileRoute('/_authed/wallets')({
  component: WalletsPage,
})

const MAX_WALLETS = 2

function WalletsPage() {
  const wallets = useWallets()
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="text-2xl font-semibold">Carteiras</h1>
      {wallets.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : wallets.isError ? (
        <QueryError error={wallets.error} onRetry={() => void wallets.refetch()} />
      ) : (
        <>
          <ul className="grid gap-4" data-testid="wallet-list">
            {wallets.data.items.map((wallet) => (
              <li key={wallet.id} className="rounded-lg border p-4">
                <WalletForm wallet={wallet} />
              </li>
            ))}
          </ul>
          {wallets.data.items.length < MAX_WALLETS ? (
            <section aria-labelledby="new-wallet" className="rounded-lg border p-4">
              <h2 id="new-wallet" className="mb-3 font-semibold">
                Nova carteira
              </h2>
              <WalletForm defaultRole={wallets.data.items.length === 0 ? 'primary' : 'secondary'} />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">Você já tem carteira principal e secundária. Edite uma delas para trocar.</p>
          )}
        </>
      )}
    </div>
  )
}

function WalletForm({ wallet, defaultRole = 'secondary' }: { wallet?: Wallet; defaultRole?: Wallet['role'] }) {
  const save = useSaveWallet()
  const [errors, setErrors] = useState<FieldErrors>({})
  const prefix = wallet?.id ?? 'new'
  return (
    <form
      noValidate
      aria-label={wallet ? `Carteira ${wallet.label}` : 'Nova carteira'}
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const result = validate(WalletBody, formValues(form))
        if (result.errors) {
          setErrors(result.errors)
          focusFirstError(form, result.errors)
          return
        }
        setErrors({})
        save.mutate(
          { walletId: wallet?.id, body: result.data },
          {
            onSuccess: () => {
              if (!wallet) form.reset()
            },
            onError: (error) => {
              const fieldErrors = apiFieldErrors(error)
              setErrors(fieldErrors)
              focusFirstError(form, fieldErrors)
            },
          },
        )
      }}
    >
      <Field id={`${prefix}-label`} label="Nome" name="label" defaultValue={wallet?.label} error={errors.label} />
      <Field id={`${prefix}-address`} label="Endereço" name="address" defaultValue={wallet?.address} placeholder="0x…" className="font-mono" error={errors.address} />
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Rede</span>
        <select name="network" defaultValue={wallet?.network ?? 'ethereum'} className="h-9 rounded-md border px-2">
          {Network.options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 font-medium">Tipo</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="role" value="primary" defaultChecked={(wallet?.role ?? defaultRole) === 'primary'} key={`${prefix}-${wallet?.role}`} />
          Principal
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="role" value="secondary" defaultChecked={(wallet?.role ?? defaultRole) === 'secondary'} key={`${prefix}-s-${wallet?.role}`} />
          Secundária
        </label>
      </fieldset>
      <FormError message={errors._} />
      <Button type="submit" disabled={save.isPending}>
        {wallet ? 'Salvar carteira' : 'Cadastrar carteira'}
      </Button>
    </form>
  )
}
