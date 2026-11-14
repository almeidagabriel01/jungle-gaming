import { createFileRoute } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { roundCheckClass } from '@/components/account/form-classes'
import { WalletDetailsFields } from '@/components/account/wallet-fields'
import { EMPTY_DETAILS, walletValues, type DetailsValues } from '@/components/account/wallet-values'
import { FormError } from '@/components/field'
import { AccountLayout } from '@/components/layout/account-layout'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WalletBody, type Wallet } from '@/contracts/account'
import { apiFieldErrors, focusFirstError, validate, type FieldErrors } from '@/lib/forms'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'
import { useSaveWallet, useWallets } from '@/queries/account'

export const Route = createFileRoute('/_authed/wallets')({
  component: WalletsPage,
})

/** Principal + secundária (o servidor responde WALLET_LIMIT acima disso). */
const MAX_WALLETS = 2

const actionClass = 'cursor-pointer text-base leading-4 font-medium text-accent-text transition-colors hover:text-primary disabled:opacity-50'

function WalletsPage() {
  const wallets = useWallets()
  return (
    <AccountLayout>
      <h1 className="sr-only">Carteiras</h1>
      {wallets.isPending ? (
        <WalletsSkeleton />
      ) : wallets.isError ? (
        <QueryError error={wallets.error} onRetry={() => void wallets.refetch()} />
      ) : (
        <WalletSections items={wallets.data.items} />
      )}
    </AccountLayout>
  )
}

function WalletSections({ items }: { items: Wallet[] }) {
  const primary = items.find((w) => w.role === 'primary')
  const secondary = items.find((w) => w.role === 'secondary')
  const canAdd = items.length < MAX_WALLETS
  return (
    <div className="grid gap-8" data-testid="wallet-list">
      {/* `key`: depois de salvar, a seção recomeça com os dados que voltaram da API. */}
      <PrimarySection key={`p-${primary?.id ?? 'none'}-${items.length}`} wallet={primary} canAdd={canAdd} />
      <SecondarySection key={`s-${secondary?.id ?? 'none'}-${items.length}`} wallet={secondary} primary={primary} canAdd={canAdd} />
    </div>
  )
}

function PrimarySection({ wallet, canAdd }: { wallet?: Wallet; canAdd: boolean }) {
  // Sem carteira: o formulário já é o cadastro. Com carteira: edita; "Adicionar" cadastra outra como principal.
  const [adding, setAdding] = useState(!wallet)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="grid gap-8 animate-rise">
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[17px] leading-4 font-bold">
            Carteira principal
          </h2>
          {wallet && (adding ? (
            <button type="button" className={actionClass} onClick={() => setAdding(false)}>
              Cancelar
            </button>
          ) : (
            canAdd && (
              <button type="button" className={actionClass} onClick={() => setAdding(true)}>
                Adicionar
              </button>
            )
          ))}
        </div>
        <p className="text-sm leading-[15px] text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
      </div>
      <WalletForm
        key={adding ? 'new' : wallet?.id}
        role="primary"
        wallet={adding ? undefined : wallet}
        initial={adding || !wallet ? EMPTY_DETAILS : { ...EMPTY_DETAILS, ...walletValues(wallet) }}
        formLabel={adding ? 'Nova carteira principal' : `Carteira ${wallet?.label ?? 'principal'}`}
        onSaved={() => setAdding(false)}
      />
    </section>
  )
}

function SecondarySection({ wallet, primary, canAdd }: { wallet?: Wallet; primary?: Wallet; canAdd: boolean }) {
  const [editing, setEditing] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const titleId = useId()
  const sameId = useId()

  // "Igual à carteira principal" copia os dados de perfil; apelido e endereço são da nova carteira
  // (o servidor recusa endereço repetido).
  const copied = (): DetailsValues =>
    sameAsPrimary && primary ? { ...EMPTY_DETAILS, ...walletValues(primary), label: '', address: '', secondaryAddress: '' } : EMPTY_DETAILS

  return (
    <section aria-labelledby={titleId} className="grid gap-3 animate-rise [animation-delay:80ms]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={titleId} className="text-[17px] leading-4 font-bold">
          Carteira secundária
        </h2>
        <div className="flex items-center gap-2">
          {!wallet && (
            <label htmlFor={sameId} className="flex cursor-pointer items-center gap-2 text-sm leading-4">
              <input
                id={sameId}
                type="checkbox"
                className={roundCheckClass + ' border-[1.5px]'}
                checked={sameAsPrimary}
                disabled={!primary}
                onChange={(e) => setSameAsPrimary(e.target.checked)}
              />
              Igual à carteira principal
            </label>
          )}
          {editing ? (
            <button type="button" className={actionClass} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          ) : wallet ? (
            <button type="button" className={actionClass} onClick={() => setEditing(true)}>
              Editar
            </button>
          ) : (
            <button type="button" className={actionClass} disabled={!canAdd} onClick={() => setEditing(true)}>
              Adicionar
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-5">
          <WalletForm
            key={`${wallet?.id ?? 'new'}-${sameAsPrimary}`}
            role="secondary"
            wallet={wallet}
            initial={wallet ? { ...EMPTY_DETAILS, ...walletValues(wallet) } : copied()}
            formLabel={wallet ? `Carteira ${wallet.label}` : 'Nova carteira secundária'}
            onSaved={() => setEditing(false)}
          />
        </div>
      ) : wallet ? (
        <WalletSummary wallet={wallet} />
      ) : (
        <p className="text-sm leading-[15px] text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
      )}
    </section>
  )
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <div className="rounded-[14px] bg-card px-5 py-[15px] md:px-[54px] text-sm leading-[22px] text-muted-foreground shadow-[0_20px_20px_rgb(10_6_4/0.45)]">
      <p className="mb-[7px] text-base leading-4 font-bold text-foreground">{wallet.label}</p>
      <p className="font-mono break-all">{wallet.secondaryAddress || shortAddress(wallet.address)}</p>
      <p>
        Rede {NETWORK_LABEL[wallet.network]} · {PROVIDER_LABEL[wallet.provider]}
      </p>
    </div>
  )
}

function WalletForm({
  wallet,
  role,
  initial,
  formLabel,
  onSaved,
}: {
  wallet?: Wallet
  role: Wallet['role']
  initial: DetailsValues
  formLabel: string
  onSaved?: () => void
}) {
  const save = useSaveWallet()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  return (
    <form
      noValidate
      aria-label={formLabel}
      className="grid gap-8"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const result = validate(WalletBody, { ...values, role })
        if (result.errors) {
          setErrors(result.errors)
          focusFirstError(form, result.errors)
          return
        }
        setErrors({})
        save.mutate(
          { walletId: wallet?.id, body: result.data },
          {
            onSuccess: onSaved,
            onError: (error) => {
              const fieldErrors = apiFieldErrors(error)
              setErrors(fieldErrors)
              focusFirstError(form, fieldErrors)
            },
          },
        )
      }}
    >
      <WalletDetailsFields variant="wallet" values={values} errors={errors} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
      <FormError message={errors._} />
      <Button type="submit" disabled={save.isPending} className="h-10 w-[131px] justify-self-start rounded-[3px] px-0 text-sm leading-4">
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function WalletsSkeleton() {
  return (
    <div role="status" aria-label="Carregando carteiras" className="grid gap-8">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[15px] w-full max-w-[648px]" />
      </div>
      <div className="grid gap-y-6 lg:grid-cols-2 lg:gap-x-7">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="grid gap-[13px]">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-[131px]" />
    </div>
  )
}
