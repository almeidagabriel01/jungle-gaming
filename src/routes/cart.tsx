import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import { FormError } from '@/components/field'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QuoteSummary } from '@/components/quote-summary'
import type { CartItem } from '@/contracts/cart'
import { dismissNotice, useNotices } from '@/lib/announcer'
import { apiFieldErrors, formValues } from '@/lib/forms'
import { formatEth } from '@/lib/money'
import { useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/queries/cart'

export const Route = createFileRoute('/cart')({
  validateSearch: z.object({ coupon: z.string().trim().toUpperCase().max(32).optional().catch(undefined) }),
  component: CartPage,
})

function CartPage() {
  const { coupon } = Route.useSearch()
  const navigate = Route.useNavigate()
  const cart = useCart()
  const hasItems = (cart.data?.items.length ?? 0) > 0
  const quote = useQuote({ couponCode: coupon, network: 'ethereum', enabled: hasItems })
  const couponError = quote.error instanceof ApiError && quote.error.status === 422 ? apiFieldErrors(quote.error).couponCode : undefined

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Carrinho</h1>
      <CartNotices />

      {cart.isPending ? (
        <div role="status" aria-label="Carregando carrinho" className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : cart.isError ? (
        <QueryError error={cart.error} onRetry={() => void cart.refetch()} />
      ) : !hasItems ? (
        <div className="grid justify-items-start gap-3">
          <p>Seu carrinho está vazio.</p>
          <Link to="/" className="underline">
            Explorar o catálogo
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <ul className="grid content-start gap-3" aria-label="Itens do carrinho">
            {cart.data.items.map((item) => (
              <li key={item.id}>
                <CartLine item={item} />
              </li>
            ))}
          </ul>

          <aside aria-labelledby="summary-title" className="grid content-start gap-4 rounded-lg border p-4">
            <h2 id="summary-title" className="font-semibold">
              Resumo
            </h2>
            <CouponForm
              applied={coupon}
              error={couponError}
              onApply={(code) => void navigate({ search: { coupon: code || undefined } })}
            />
            <QuoteSummary quote={quote.data} pending={quote.isPending} error={couponError ? null : quote.error} onRetry={() => void quote.refetch()} />
            {quote.data && !quote.data.purchasable && <FormError message="Há itens indisponíveis. Ajuste as quantidades para continuar." />}
            <Button asChild disabled={!quote.data?.purchasable}>
              {quote.data?.purchasable ? (
                <Link to="/checkout" search={{ coupon: quote.data.coupon?.code }}>
                  Ir para o pagamento
                </Link>
              ) : (
                <span aria-disabled="true">Ir para o pagamento</span>
              )}
            </Button>
          </aside>
        </div>
      )}
    </div>
  )
}

function CartLine({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const error = update.error ?? remove.error
  const errorId = `qty-error-${item.id}`
  return (
    <article className="grid grid-cols-[4rem_1fr] gap-3 rounded-lg border p-3" aria-label={item.name}>
      <img src={item.image.thumbnailUrl} alt={item.image.alt} width={64} height={64} className="size-16 rounded-md object-cover" />
      <div className="grid gap-2">
        <div className="flex flex-wrap justify-between gap-2">
          <Link to="/nfts/$nftId" params={{ nftId: item.nftId }} className="font-medium hover:underline">
            {item.name}
          </Link>
          <span className="tabular-nums" data-testid={`cart-price-${item.id}`}>
            {formatEth(item.unitPrice)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          ID do token: #{item.tokenId} · Edição {item.editionName} · {item.available > 0 ? `${item.available} disponíveis` : 'Esgotada'}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            Quantidade
            <input
              type="number"
              min={1}
              max={Math.max(1, item.available)}
              step={1}
              defaultValue={item.quantity}
              key={item.quantity}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onBlur={(e) => {
                const quantity = Math.trunc(e.currentTarget.valueAsNumber)
                if (Number.isFinite(quantity) && quantity >= 1 && quantity !== item.quantity) update.mutate({ itemId: item.id, quantity })
                else e.currentTarget.value = String(item.quantity)
              }}
              className="h-8 w-20 rounded-md border px-2"
            />
          </label>
          <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>
            Remover
          </Button>
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {apiFieldErrors(error).quantity ?? apiFieldErrors(error)._}
          </p>
        )}
      </div>
    </article>
  )
}

function CouponForm({ applied, error, onApply }: { applied?: string; error?: string; onApply: (code: string) => void }) {
  return (
    <form
      className="grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        onApply((formValues(e.currentTarget).coupon ?? '').trim().toUpperCase())
      }}
    >
      <label htmlFor="coupon" className="text-sm font-medium">
        Cupom
      </label>
      <div className="flex gap-2">
        <input
          id="coupon"
          name="coupon"
          defaultValue={applied ?? ''}
          key={applied ?? ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-9 min-w-0 flex-1 rounded-md border px-2 uppercase"
        />
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
        {applied && (
          <Button type="button" variant="ghost" onClick={() => onApply('')}>
            Remover
          </Button>
        )}
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

/** Avisos de mudança de preço/disponibilidade recebidos em tempo real. */
function CartNotices() {
  const notices = useNotices().filter((n) => n.topic === 'cart')
  if (notices.length === 0) return null
  return (
    <ul className="grid gap-2" aria-label="Alterações no carrinho" data-testid="cart-notices">
      {notices.map((notice) => (
        <li key={notice.id} className="flex items-start justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm">
          <span>{notice.message}</span>
          <Button variant="ghost" size="sm" onClick={() => dismissNotice(notice.id)} aria-label="Dispensar aviso">
            ×
          </Button>
        </li>
      ))}
    </ul>
  )
}
