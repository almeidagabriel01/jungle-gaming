import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { cn } from 'cn'
import { ApiError } from '@/api/client'
import { keys } from '@/api/keys'
import { controlClass } from '@/components/account/form-classes'
import { FormField } from '@/components/account/form-field'
import { WalletDetailsFields } from '@/components/account/wallet-fields'
import { EMPTY_DETAILS, walletValues, type DetailsValues } from '@/components/account/wallet-values'
import { CouponPrompt, OrderLines, OrderTotals } from '@/components/checkout/checkout-summary'
import { ProviderOptions, WalletCards } from '@/components/checkout/wallet-choices'
import { FormError } from '@/components/field'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Wallet, WalletProvider } from '@/contracts/account'
import { Quote } from '@/contracts/cart'
import { Network } from '@/contracts/common'
import { Buyer, type Order } from '@/contracts/order'
import { apiFieldErrors, focusFirstError, validate, type FieldErrors } from '@/lib/forms'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'
import { formatEth } from '@/lib/money'
import { useConnectWallet, useDisconnectWallet, useWallets } from '@/queries/account'
import { useCartOwner, useQuote } from '@/queries/cart'
import { orderAttempt, useSubmitOrder, type OrderAttempt } from '@/queries/orders'
import { useUser } from '@/session/session'

export const Route = createFileRoute('/_authed/checkout')({
  validateSearch: z.object({ coupon: z.string().trim().toUpperCase().max(32).optional().catch(undefined) }),
  component: CheckoutPage,
})

/**
 * Rascunho do checkout por usuário: sobrevive a refresh e a expiração de sessão. Guarda só o que o
 * usuário mudou, como texto livre (um campo pela metade não pode invalidar o resto); a validação
 * acontece no envio. Trocar de carteira descarta os campos que vieram da anterior.
 */
const Draft = z.record(z.string(), z.string()).catch({})
type Draft = Partial<Record<keyof DetailsValues | 'note' | 'walletId', string>>
const draftKey = (userId: string) => `jungle-checkout-draft:${userId}`
const loadDraft = (userId: string): Draft => {
  try {
    return Draft.parse(JSON.parse(sessionStorage.getItem(draftKey(userId)) ?? '{}'))
  } catch {
    return {}
  }
}

type Connection = { state: 'idle' | 'connecting' | 'connected' | 'rejected'; walletId?: string; network?: Network; message?: string }

/** Dados confirmados no passo de detalhes; a revisão e o pedido usam exatamente estes. */
type Reviewed = { buyer: Buyer; wallet: Wallet; network: Network }

const sectionTitle = 'text-base leading-4 font-bold md:text-[17px]'
/** Botão principal: no mobile, pílula com gradiente fixa no rodapé (frame Pagamento com carteira). */
const primaryAction =
  'h-[60px] w-full rounded-[40px] bg-linear-[100deg] from-primary to-primary/80 text-[15px] leading-4 md:h-[45px] md:rounded-lg md:bg-none'
const bottomBar = 'max-md:sticky max-md:bottom-8 max-md:z-30 max-md:mt-auto max-md:pt-4'

function CheckoutPage() {
  const user = useUser()!
  const { coupon } = Route.useSearch()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => loadDraft(user.id))
  const [reviewed, setReviewed] = useState<Reviewed | null>(null)
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
    <div className="page flex flex-col max-md:min-h-dvh max-md:px-7 max-md:pb-8 md:pb-24">
      <h1 className="sr-only">Pagamento</h1>
      <MobileTopBar title="Pagamento com carteira" className="pt-8 pb-0" />
      <Breadcrumbs items={[{ label: 'Início', link: { to: '/' } }, { label: 'Mercado', link: { to: '/', hash: 'mercado' } }, { label: 'Pagamento' }]} />

      {submit.isPending && pendingAttempt && (
        <p role="status" className="mt-4 rounded-[3px] border border-border bg-card p-3 text-sm md:mt-6">
          Enviando seu pedido…
        </p>
      )}
      {unresolved && pendingAttempt && (
        <div role="alert" className="mt-4 grid justify-items-start gap-3 rounded-[3px] border border-destructive/60 bg-card p-4 text-sm md:mt-6">
          <p>Não recebemos a confirmação do envio. Reenviar recupera o mesmo pedido, sem cobrança duplicada.</p>
          <Button variant="outline" className="h-10 rounded-[3px]" onClick={() => send(pendingAttempt)} disabled={submit.isPending}>
            Reenviar pedido
          </Button>
        </div>
      )}

      {reviewed ? (
        <ReviewStep
          reviewed={reviewed}
          couponCode={coupon}
          submitting={submit.isPending}
          // Com tentativa guardada, uma nova confirmação geraria outra chave (pedido duplicado).
          locked={Boolean(pendingAttempt)}
          submitError={unresolved ? null : submit.error}
          onBack={() => setReviewed(null)}
          onConfirm={(quote) => {
            send(
              orderAttempt.begin(user.id, {
                quoteId: quote.id,
                fingerprint: quote.fingerprint,
                walletId: reviewed.wallet.id,
                network: reviewed.network,
                buyer: reviewed.buyer,
              }),
            )
          }}
        />
      ) : (
        <DetailsStep
          draft={draft}
          onDraft={setDraft}
          couponCode={coupon}
          onCoupon={(code) => void navigate({ to: '/checkout', search: { coupon: code }, replace: true })}
          connection={connection}
          onConnection={setConnection}
          onContinue={setReviewed}
        />
      )}
    </div>
  )
}

/** Duas colunas no desktop (formulário 763 px | resumo 405 px); no mobile, uma pilha com a ação no rodapé. */
function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-4 md:gap-8 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_405px] lg:items-start">
      {left}
      {right}
    </div>
  )
}

function DetailsStep({
  draft,
  onDraft,
  couponCode,
  onCoupon,
  connection,
  onConnection,
  onContinue,
}: {
  draft: Draft
  onDraft: (d: Draft) => void
  couponCode?: string
  onCoupon: (code: string | undefined) => void
  connection: Connection
  onConnection: (c: Connection) => void
  onContinue: (r: Reviewed) => void
}) {
  const user = useUser()!
  const wallets = useWallets()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [showCollector, setShowCollector] = useState(false)
  const [otherWallet, setOtherWallet] = useState(false)
  const connectRef = useRef<HTMLButtonElement>(null)
  const formId = useId()
  const collectorId = useId()

  const items = wallets.data?.items ?? []
  const primary = items.find((w) => w.role === 'primary') ?? items[0]
  const wallet = items.find((w) => w.id === draft.walletId) ?? primary
  const values: DetailsValues & { note: string } = {
    ...EMPTY_DETAILS,
    username: user.username,
    note: '',
    ...(wallet ? walletValues(wallet) : {}),
    ...draft,
    // O endereço é o da carteira escolhida (o pedido é pago por ela).
    address: wallet?.address ?? '',
  }
  const parsedNetwork = Network.safeParse(values.network)
  const network = parsedNetwork.success ? parsedNetwork.data : (wallet?.network ?? 'ethereum')

  const quote = useQuote({ couponCode, network })
  // Cupom inválido ou expirado: a API responde 422 na cotação; o campo mostra o erro e permite remover.
  const couponError =
    quote.error instanceof ApiError && quote.error.status === 422 ? (apiFieldErrors(quote.error).couponCode ?? quote.error.message) : undefined

  if (wallets.isPending) return <DetailsSkeleton />
  if (wallets.isError) return <QueryError error={wallets.error} onRetry={() => void wallets.refetch()} />
  if (!wallet) {
    return (
      <div className="grid animate-rise justify-items-start gap-4 pt-8">
        <p className="text-lg font-bold">Cadastre uma carteira para pagar.</p>
        <p className="text-sm text-muted-foreground">As carteiras cadastradas ficam disponíveis no pagamento e para receber os NFTs.</p>
        <Button asChild className="h-10 rounded-[3px]">
          <Link to="/wallets">Cadastrar carteira</Link>
        </Button>
      </div>
    )
  }

  const isConnected = connection.state === 'connected' && connection.walletId === wallet.id && connection.network === network

  const set = (name: string, value: string) => {
    onDraft({ ...draft, [name]: value })
    // Outra rede ou outro provedor exigem nova conexão.
    if (name === 'network' || name === 'provider') onConnection({ state: 'idle' })
  }
  const chooseWallet = (id: string) => {
    if (id === wallet.id) return
    const fromWallet = new Set<string>(Object.keys(walletValues(wallet)))
    onDraft({ ...Object.fromEntries(Object.entries(draft).filter(([k]) => !fromWallet.has(k))), walletId: id })
    onConnection({ state: 'idle' })
  }

  const review = (form: HTMLFormElement) => {
    const buyer = validate(Buyer, values)
    const next: FieldErrors = { ...(buyer.errors ?? {}) }
    if (!parsedNetwork.success) next.network = 'Selecione uma rede'
    if (!isConnected) next.connection = 'Conecte a carteira selecionada na rede escolhida.'
    setErrors(next)
    if (Object.keys(next).some((k) => k !== 'connection')) {
      setShowCollector(true)
      // Espera o campo reaparecer (seção recolhida no mobile) antes de focar.
      requestAnimationFrame(() => focusFirstError(form, next))
      return
    }
    if (next.connection) {
      connectRef.current?.focus()
      return
    }
    onDraft({ ...draft, walletId: wallet.id })
    onContinue({ buyer: buyer.data!, wallet, network })
  }

  const left = (
    <form
      id={formId}
      noValidate
      aria-labelledby={collectorId}
      className="grid content-start gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        review(e.currentTarget)
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={collectorId} className={sectionTitle}>
          Perfil do colecionador
        </h2>
        <button
          type="button"
          aria-expanded={showCollector}
          aria-controls={`${formId}-fields`}
          onClick={() => setShowCollector((s) => !s)}
          className="min-h-6 cursor-pointer text-sm leading-4 font-bold text-accent-text md:hidden"
        >
          {showCollector ? 'Ocultar dados' : 'Editar dados'}
        </button>
      </div>
      <div id={`${formId}-fields`} className={cn('grid gap-6', !showCollector && 'max-md:hidden')}>
        <WalletDetailsFields variant="checkout" values={values} errors={errors} onChange={set} />
        <FormField label="Observação do colecionador (opcional)" error={errors.note} className="order-last gap-3 md:max-w-[350px]" labelClassName="h-[15px]">
          {(control) => (
            <textarea
              {...control}
              name="note"
              rows={6}
              maxLength={280}
              value={values.note}
              onChange={(e) => set('note', e.target.value)}
              className={cn(controlClass, 'h-[152px] resize-none py-2.5 leading-5')}
            />
          )}
        </FormField>
        <WalletPicker
          wallets={items}
          wallet={wallet}
          otherWallet={otherWallet}
          onOtherWallet={(on) => {
            setOtherWallet(on)
            if (!on && primary) chooseWallet(primary.id)
          }}
          onChoose={chooseWallet}
          className="max-md:hidden"
        />
      </div>
    </form>
  )

  const right = (
    <aside aria-label="Resumo e pagamento" className="flex flex-col gap-3 max-md:flex-1">
      <div className="grid gap-3 max-md:hidden">
        <h2 className={sectionTitle}>Seus NFTs</h2>
        <OrderLines quote={quote.data} />
        <CouponPrompt
          applied={couponCode}
          error={couponError}
          checking={quote.isFetching}
          onApply={onCoupon}
          onRemove={() => onCoupon(undefined)}
        />
        <OrderTotals quote={quote.data} error={couponError ? null : quote.error} onRetry={() => void quote.refetch()} />
      </div>

      {/* Mobile: "Carteira conectada" vem antes dos provedores, como no frame. */}
      <WalletPicker wallets={items} wallet={wallet} otherWallet onChoose={chooseWallet} className="md:hidden" mobile />

      <section aria-labelledby={`${formId}-providers`} className="grid gap-4 max-md:mt-1 md:mt-0 md:gap-5">
        <h2 id={`${formId}-providers`} className={cn(sectionTitle, 'md:text-center')}>
          Carteira e rede
        </h2>
        <ProviderOptions labelledBy={`${formId}-providers`} value={values.provider} onChange={(p: WalletProvider) => set('provider', p)} />
        {errors.provider && <p className="text-[13px] leading-4 text-destructive">{errors.provider}</p>}
        <div className="grid justify-items-start gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground" data-testid="wallet-connection">
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
              className="h-10 rounded-[3px]"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(wallet.id, { onSuccess: () => onConnection({ state: 'idle' }) })}
            >
              Desconectar carteira
            </Button>
          ) : (
            <Button
              ref={connectRef}
              type="button"
              variant="outline"
              className="h-10 rounded-[3px]"
              aria-describedby={errors.connection ? `${formId}-connection-error` : undefined}
              disabled={connect.isPending}
              onClick={() => {
                onConnection({ state: 'connecting' })
                connect.mutate(
                  { walletId: wallet.id, network },
                  {
                    onSuccess: () => onConnection({ state: 'connected', walletId: wallet.id, network }),
                    onError: (error) => onConnection({ state: 'rejected', message: error instanceof ApiError ? error.message : undefined }),
                  },
                )
              }}
            >
              Conectar carteira
            </Button>
          )}
          {errors.connection && !isConnected && (
            <p id={`${formId}-connection-error`} className="text-[13px] leading-4 text-destructive">
              {errors.connection}
            </p>
          )}
        </div>
      </section>

      <div className="flex items-center justify-end gap-7 text-base leading-4 font-bold md:hidden">
        <span>Total:</span>
        {quote.data ? (
          <span className="text-lg leading-4 text-accent-text" data-testid="mobile-total">
            {formatEth(quote.data.total)}
          </span>
        ) : (
          <Skeleton className="h-4 w-24" />
        )}
      </div>

      <div className={cn(bottomBar, 'md:mt-3')}>
        <Button type="submit" form={formId} className={primaryAction}>
          Revisar pedido
        </Button>
      </div>
    </aside>
  )

  return <Columns left={left} right={right} />
}

/**
 * Escolha da carteira cadastrada. Desktop: "Usar outra carteira?" abre os cartões (desmarcar volta
 * à principal). Mobile: "Carteira conectada" com os cartões sempre visíveis e "Trocar carteira".
 */
function WalletPicker({
  wallets,
  wallet,
  otherWallet,
  onOtherWallet,
  onChoose,
  className,
  mobile = false,
}: {
  wallets: Wallet[]
  wallet: Wallet
  otherWallet: boolean
  onOtherWallet?: (on: boolean) => void
  onChoose: (id: string) => void
  className?: string
  mobile?: boolean
}) {
  const id = useId()
  return (
    <section aria-labelledby={mobile ? `${id}-title` : undefined} className={cn('grid content-start gap-4', className)}>
      {mobile ? (
        <div className="flex items-center justify-between gap-4">
          <h2 id={`${id}-title`} className={sectionTitle}>
            Carteira conectada
          </h2>
          <Link to="/wallets" className="text-sm leading-4 font-bold text-accent-text">
            Trocar carteira
          </Link>
        </div>
      ) : (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-[15px] leading-5">
          <input
            type="checkbox"
            className="size-[15px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-primary checked:bg-[radial-gradient(circle,var(--primary)_0_3px,transparent_3.5px)]"
            checked={otherWallet}
            disabled={wallets.length < 2}
            onChange={(e) => onOtherWallet?.(e.target.checked)}
          />
          Usar outra carteira?
        </label>
      )}
      {otherWallet && <WalletCards wallets={wallets} value={wallet.id} onChange={onChoose} />}
    </section>
  )
}

function ReviewStep({
  reviewed,
  couponCode,
  submitting,
  locked,
  submitError,
  onBack,
  onConfirm,
}: {
  reviewed: Reviewed
  couponCode?: string
  submitting: boolean
  locked: boolean
  submitError: unknown
  onBack: () => void
  onConfirm: (quote: Quote) => void
}) {
  const qc = useQueryClient()
  const owner = useCartOwner()
  const { buyer, wallet, network } = reviewed
  const quote = useQuote({ couponCode, network })
  const [accepted, setAccepted] = useState<Quote | null>(null)
  const [revalidating, setRevalidating] = useState(false)
  const titleId = useId()

  // A primeira cotação vista na revisão é a que o usuário está aceitando.
  if (quote.data && !accepted) setAccepted(quote.data)

  // O servidor recusou por cotação desatualizada: a nova cotação vira a atual e exige reconfirmação.
  useEffect(() => {
    if (submitError instanceof ApiError && (submitError.code === 'QUOTE_STALE' || submitError.code === 'QUOTE_NOT_PURCHASABLE')) {
      const fresh = Quote.safeParse((submitError.details as { quote?: unknown } | undefined)?.quote)
      if (fresh.success) qc.setQueryData(keys.quote(owner, couponCode, network), fresh.data)
    }
  }, [submitError, qc, owner, couponCode, network])

  const current = quote.data
  const stale = Boolean(current && accepted && current.fingerprint !== accepted.fingerprint)
  const ready = Boolean(current && accepted)

  const rows: [string, string][] = [
    ['Nome de exibição', buyer.displayName],
    ['Nome de usuário', buyer.username],
    ['Nome do perfil', buyer.profileName],
    ['E-mail', buyer.email],
    ['Nome ENS', buyer.ensName],
    ['Código de indicação', buyer.referralCode],
    ['Carteira', `${wallet.label} · ${buyer.address}`],
    ...(buyer.secondaryAddress ? [['ENS ou carteira secundária', buyer.secondaryAddress] as [string, string]] : []),
    ['Rede', NETWORK_LABEL[network]],
    ['Tipo de carteira', PROVIDER_LABEL[buyer.provider]],
    ...(buyer.note ? [['Observação', buyer.note] as [string, string]] : []),
  ]

  const left = (
    <section aria-labelledby={titleId} className="grid animate-rise content-start gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className={sectionTitle}>
          Revisão do pedido
        </h2>
        <button type="button" onClick={onBack} disabled={submitting} className="min-h-6 cursor-pointer text-sm leading-4 font-bold text-accent-text disabled:opacity-50">
          Editar dados
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-4 rounded-[14px] bg-card p-5 text-sm sm:grid-cols-2 md:rounded-[3px]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid min-w-0 gap-1">
            <dt className="text-subtle">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )

  const right = (
    <aside aria-label="Resumo do pedido" className="flex flex-col gap-3 max-md:flex-1">
      <h2 className={sectionTitle}>Seus NFTs</h2>
      {quote.isError ? (
        <QueryError error={quote.error} onRetry={() => void quote.refetch()} />
      ) : (
        <>
          <OrderLines quote={ready ? current : undefined} />
          {current?.lines.some((l) => l.status !== 'ok') && (
            <ul className="grid gap-1 text-sm text-destructive">
              {current.lines
                .filter((l) => l.status !== 'ok')
                .map((l) => (
                  <li key={l.itemId}>
                    {l.name}: {l.status === 'sold-out' ? 'esgotado' : `só ${l.available} disponível(is)`}
                  </li>
                ))}
            </ul>
          )}
          <OrderTotals quote={ready ? current : undefined} onRetry={() => void quote.refetch()} />
        </>
      )}

      {stale && current && accepted && (
        <div role="alert" className="grid justify-items-start gap-3 rounded-[3px] border border-primary bg-band p-4 text-sm" data-testid="quote-changed">
          <p>
            Os valores mudaram desde a sua revisão: o total foi de {formatEth(accepted.total)} para {formatEth(current.total)}. Confira e confirme
            novamente.
          </p>
          <Button variant="outline" className="h-10 rounded-[3px]" onClick={() => setAccepted(current)} disabled={!current.purchasable}>
            Aceitar novos valores
          </Button>
        </div>
      )}
      {current && !current.purchasable && <FormError message="Há itens indisponíveis. Volte ao carrinho para ajustar." />}
      {submitError != null && !(submitError instanceof ApiError && submitError.code === 'QUOTE_STALE') && (
        <FormError message={apiFieldErrors(submitError)._ ?? Object.values(apiFieldErrors(submitError))[0]} />
      )}

      <div className={cn(bottomBar, 'grid gap-3 md:mt-3')}>
        <Button
          className={primaryAction}
          disabled={!ready || stale || !current?.purchasable || submitting || locked || revalidating}
          onClick={() => {
            if (!accepted) return
            // Revalida preço, disponibilidade, cupom e taxa imediatamente antes de confirmar.
            setRevalidating(true)
            void quote.refetch().then((res) => {
              setRevalidating(false)
              if (res.data && res.data.fingerprint === accepted.fingerprint) onConfirm(res.data)
            })
          }}
        >
          {submitting || revalidating ? 'Confirmando…' : accepted ? `Confirmar compra (${formatEth(accepted.total)})` : 'Confirmar compra'}
        </Button>
      </div>
    </aside>
  )

  return <Columns left={left} right={right} />
}

function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Carregando pagamento" className="flex flex-col gap-8 pt-4 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_405px]">
      <div className="grid content-start gap-3">
        <Skeleton className="h-4 w-56" />
        <div className="grid gap-y-3 md:grid-cols-2 md:gap-x-6">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="grid h-[69px] content-end gap-[14px]">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-3">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full rounded-none" />
        ))}
        <Skeleton className="h-[45px] w-full" />
      </div>
    </div>
  )
}
