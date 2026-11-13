import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import { keys } from '@/api/keys'
import { Field, FormError } from '@/components/field'
import { QueryError } from '@/components/query-error'
import { QuoteSummary } from '@/components/quote-summary'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Quote } from '@/contracts/cart'
import { Network } from '@/contracts/common'
import { Buyer, type Order } from '@/contracts/order'
import { apiFieldErrors, focusFirstError, validate, type FieldErrors } from '@/lib/forms'
import { formatEth } from '@/lib/money'
import { useConnectWallet, useDisconnectWallet, useWallets } from '@/queries/account'
import { useCartOwner, useQuote } from '@/queries/cart'
import { orderAttempt, useSubmitOrder, type OrderAttempt } from '@/queries/orders'
import { useUser } from '@/session/session'

export const Route = createFileRoute('/_authed/checkout')({
  validateSearch: z.object({ coupon: z.string().trim().toUpperCase().max(32).optional().catch(undefined) }),
  component: CheckoutPage,
})

const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', arbitrum: 'Arbitrum' }

/** Rascunho do checkout por usuário: sobrevive a refresh e a expiração de sessão. */
const Draft = Buyer.partial().extend({ walletId: z.string().optional(), network: Network.optional() })
type Draft = z.infer<typeof Draft>
const draftKey = (userId: string) => `jungle-checkout-draft:${userId}`
const loadDraft = (userId: string): Draft => {
  try {
    return Draft.parse(JSON.parse(sessionStorage.getItem(draftKey(userId)) ?? '{}'))
  } catch {
    return {}
  }
}

type Connection = { state: 'idle' | 'connecting' | 'connected' | 'rejected'; walletId?: string; network?: Network; message?: string }

function CheckoutPage() {
  const user = useUser()!
  const { coupon } = Route.useSearch()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => ({ email: user.email, fullName: user.name, ...loadDraft(user.id) }))
  const [step, setStep] = useState<'details' | 'review'>('details')
  const [connection, setConnection] = useState<Connection>({ state: 'idle' })
  const submit = useSubmitOrder()
  const recovering = useRef(false)

  useEffect(() => {
    sessionStorage.setItem(draftKey(user.id), JSON.stringify(draft))
  }, [draft, user.id])

  const goToOrder = (order: Order) => void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })

  const send = (attempt: OrderAttempt) => {
    submit.mutate(attempt, { onSuccess: goToOrder })
  }

  // Retomada: uma tentativa sem resposta (timeout, queda, refresh) é reenviada idêntica.
  useEffect(() => {
    const pending = orderAttempt.load(user.id)
    if (!pending || recovering.current) return
    recovering.current = true
    submit.mutate(pending, { onSuccess: goToOrder })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- executa só na montagem
  }, [])

  const pendingAttempt = orderAttempt.load(user.id)
  // Tentativa guardada sem resposta definitiva (timeout, 5xx, 401): só pode ser reenviada com a mesma chave.
  const unresolved = Boolean(pendingAttempt) && submit.isError

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Pagamento</h1>

      {submit.isPending && pendingAttempt && (
        <p role="status" className="rounded-md border p-3 text-sm">
          Enviando seu pedido…
        </p>
      )}
      {unresolved && pendingAttempt && (
        <div role="alert" className="grid justify-items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm">
          <p>Não recebemos a confirmação do envio. Reenviar recupera o mesmo pedido, sem cobrança duplicada.</p>
          <Button variant="outline" onClick={() => send(pendingAttempt)} disabled={submit.isPending}>
            Reenviar pedido
          </Button>
        </div>
      )}

      {step === 'details' ? (
        <DetailsStep
          draft={draft}
          onDraft={setDraft}
          connection={connection}
          onConnection={setConnection}
          onContinue={() => setStep('review')}
        />
      ) : (
        <ReviewStep
          draft={draft as Required<Draft>}
          couponCode={coupon}
          submitting={submit.isPending}
          // Com tentativa guardada, uma nova confirmação geraria outra chave (pedido duplicado).
          locked={Boolean(pendingAttempt)}
          submitError={unresolved ? null : submit.error}
          onBack={() => setStep('details')}
          onConfirm={(quote) => {
            const buyer = Buyer.parse(draft)
            send(
              orderAttempt.begin(user.id, {
                quoteId: quote.id,
                fingerprint: quote.fingerprint,
                walletId: draft.walletId!,
                network: draft.network!,
                buyer,
              }),
            )
          }}
        />
      )}
    </div>
  )
}

function DetailsStep({
  draft,
  onDraft,
  connection,
  onConnection,
  onContinue,
}: {
  draft: Draft
  onDraft: (d: Draft) => void
  connection: Connection
  onConnection: (c: Connection) => void
  onContinue: () => void
}) {
  const wallets = useWallets()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [errors, setErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const network = draft.network ?? 'ethereum'

  if (wallets.isPending) return <Skeleton className="h-64 w-full" />
  if (wallets.isError) return <QueryError error={wallets.error} onRetry={() => void wallets.refetch()} />
  if (wallets.data.items.length === 0) {
    return (
      <p>
        Cadastre uma carteira para pagar.{' '}
        <Link to="/wallets" className="underline">
          Cadastrar carteira
        </Link>
      </p>
    )
  }
  const walletId = draft.walletId ?? wallets.data.items[0]!.id
  const isConnected = connection.state === 'connected' && connection.walletId === walletId && connection.network === network

  return (
    <form
      ref={formRef}
      noValidate
      className="grid max-w-xl gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        const result = validate(Buyer, draft)
        const next: FieldErrors = { ...(result.errors ?? {}) }
        if (!isConnected) next.connection = 'Conecte a carteira selecionada na rede escolhida.'
        setErrors(next)
        if (Object.keys(next).length > 0) {
          focusFirstError(e.currentTarget, next)
          return
        }
        onDraft({ ...draft, walletId, network })
        onContinue()
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="font-medium">Dados do colecionador</legend>
        {(['fullName', 'email', 'country'] as const).map((name) => (
          <Field
            key={name}
            label={{ fullName: 'Nome completo', email: 'E-mail', country: 'País' }[name]}
            name={name}
            type={name === 'email' ? 'email' : 'text'}
            autoComplete={{ fullName: 'name', email: 'email', country: 'country-name' }[name]}
            value={draft[name] ?? ''}
            onChange={(e) => onDraft({ ...draft, [name]: e.target.value })}
            error={errors[name]}
          />
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="font-medium">Carteira</legend>
        {wallets.data.items.map((w) => (
          <label key={w.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="radio"
              name="walletId"
              value={w.id}
              checked={w.id === walletId}
              onChange={() => {
                onDraft({ ...draft, walletId: w.id })
                onConnection({ state: 'idle' })
              }}
            />
            {w.label} ({w.role === 'primary' ? 'principal' : 'secundária'}) · <span className="truncate font-mono">{w.address}</span>
          </label>
        ))}
      </fieldset>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Rede</span>
        <select
          name="network"
          value={network}
          onChange={(e) => {
            onDraft({ ...draft, network: e.target.value as Network })
            onConnection({ state: 'idle' })
          }}
          className="h-9 rounded-md border px-2"
        >
          {Network.options.map((n) => (
            <option key={n} value={n}>
              {NETWORK_LABEL[n]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid justify-items-start gap-2" aria-live="polite">
        <p className="text-sm" data-testid="wallet-connection">
          {connection.state === 'connecting'
            ? 'Conectando à carteira…'
            : isConnected
              ? `Carteira conectada em ${NETWORK_LABEL[network]}.`
              : connection.state === 'rejected'
                ? `Conexão recusada: ${connection.message ?? ''}`
                : 'Carteira desconectada.'}
        </p>
        {isConnected ? (
          <Button
            type="button"
            variant="outline"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate(walletId, { onSuccess: () => onConnection({ state: 'idle' }) })}
          >
            Desconectar carteira
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            name="connection"
            disabled={connect.isPending}
            onClick={() => {
              onConnection({ state: 'connecting' })
              connect.mutate(
                { walletId, network },
                {
                  onSuccess: () => onConnection({ state: 'connected', walletId, network }),
                  onError: (error) => onConnection({ state: 'rejected', message: error instanceof ApiError ? error.message : undefined }),
                },
              )
            }}
          >
            Conectar carteira
          </Button>
        )}
        {errors.connection && <p className="text-sm text-destructive">{errors.connection}</p>}
      </div>

      <Button type="submit">Revisar pedido</Button>
    </form>
  )
}

function ReviewStep({
  draft,
  couponCode,
  submitting,
  locked,
  submitError,
  onBack,
  onConfirm,
}: {
  draft: Required<Draft>
  couponCode?: string
  submitting: boolean
  locked: boolean
  submitError: unknown
  onBack: () => void
  onConfirm: (quote: Quote) => void
}) {
  const qc = useQueryClient()
  const owner = useCartOwner()
  const quote = useQuote({ couponCode, network: draft.network })
  const [accepted, setAccepted] = useState<Quote | null>(null)
  const [revalidating, setRevalidating] = useState(false)

  // A primeira cotação vista na revisão é a que o usuário está aceitando.
  if (quote.data && !accepted) setAccepted(quote.data)

  // O servidor recusou por cotação desatualizada: a nova cotação vira a atual e exige reconfirmação.
  useEffect(() => {
    if (submitError instanceof ApiError && (submitError.code === 'QUOTE_STALE' || submitError.code === 'QUOTE_NOT_PURCHASABLE')) {
      const fresh = Quote.safeParse((submitError.details as { quote?: unknown } | undefined)?.quote)
      if (fresh.success) qc.setQueryData(keys.quote(owner, couponCode, draft.network), fresh.data)
    }
  }, [submitError, qc, owner, couponCode, draft.network])

  const current = quote.data
  const stale = Boolean(current && accepted && current.fingerprint !== accepted.fingerprint)

  if (quote.isError) return <QueryError error={quote.error} onRetry={() => void quote.refetch()} />
  if (!current || !accepted) return <Skeleton className="h-64 w-full" />

  return (
    <section aria-labelledby="review-title" className="grid max-w-xl gap-4">
      <h2 id="review-title" className="text-xl font-semibold">
        Revisão
      </h2>
      <p className="text-sm">
        {draft.fullName} · {draft.email} · {NETWORK_LABEL[draft.network]}
      </p>
      <ul className="grid gap-1 text-sm">
        {current.lines.map((line) => (
          <li key={line.itemId} className="flex justify-between gap-3">
            <span>
              {line.quantity}× {line.name} ({line.editionName}){line.status !== 'ok' && <strong> — {line.status === 'sold-out' ? 'esgotado' : `só ${line.available} disponível(is)`}</strong>}
            </span>
            <span className="tabular-nums">{formatEth(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <QuoteSummary quote={current} pending={false} error={null} onRetry={() => void quote.refetch()} />

      {stale && (
        <div role="alert" className="grid justify-items-start gap-2 rounded-md border border-amber-500/60 bg-amber-50 p-3 text-sm" data-testid="quote-changed">
          <p>
            Os valores mudaram desde a sua revisão: o total foi de {formatEth(accepted.total)} para {formatEth(current.total)}. Confira e confirme
            novamente.
          </p>
          <Button variant="outline" onClick={() => setAccepted(current)} disabled={!current.purchasable}>
            Aceitar novos valores
          </Button>
        </div>
      )}
      {!current.purchasable && <FormError message="Há itens indisponíveis. Volte ao carrinho para ajustar." />}
      {submitError != null && !(submitError instanceof ApiError && submitError.code === 'QUOTE_STALE') && (
        <FormError message={apiFieldErrors(submitError)._ ?? Object.values(apiFieldErrors(submitError))[0]} />
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Voltar
        </Button>
        <Button
          disabled={stale || !current.purchasable || submitting || locked || revalidating}
          onClick={() => {
            // Revalida preço, disponibilidade, cupom e taxa imediatamente antes de confirmar.
            setRevalidating(true)
            void quote.refetch().then((res) => {
              setRevalidating(false)
              if (res.data && res.data.fingerprint === accepted.fingerprint) onConfirm(res.data)
            })
          }}
        >
          {submitting || revalidating ? 'Confirmando…' : `Confirmar compra (${formatEth(accepted.total)})`}
        </Button>
      </div>
    </section>
  )
}
