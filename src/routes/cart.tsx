import { createFileRoute, Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import { FormError } from '@/components/field'
import { CloseIcon, DeleteIcon } from '@/components/icons/cart-icons'
import { CartIcon } from '@/components/icons/shell-icons'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { NftRail } from '@/components/nft/nft-rail'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { QueryError } from '@/components/query-error'
import { QuoteSummary } from '@/components/quote-summary'
import { Button, busyProps } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { CartItem, Quote } from '@/contracts/cart'
import { announce, dismissNotice, useNotices } from '@/lib/announcer'
import { apiFieldErrors, formValues } from '@/lib/forms'
import { moveFocusAfterRemoval } from '@/lib/focus'
import { formatEth } from '@/lib/money'
import { useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/queries/cart'
import { useFeaturedNfts, useRelatedNfts } from '@/queries/catalog'

export const Route = createFileRoute('/cart')({
  validateSearch: z.object({ coupon: z.string().trim().toUpperCase().max(32).optional().catch(undefined) }),
  component: CartPage,
})

/** Colunas da tabela desktop (miniatura, NFT, preço, edições, total, remover), medidas no frame. */
const COLUMNS = 'md:grid-cols-[70px_minmax(0,1fr)_139px_136px_148px_24px] md:pr-6'
/** Linha: faixa de 70 px no desktop; card de 100 px com sombra no mobile. */
const ROW = `relative grid min-h-[100px] grid-cols-[100px_minmax(0,1fr)_auto] content-start overflow-hidden rounded-[14px] bg-card shadow-[0_6px_20px_rgb(10_6_4/0.45)] md:min-h-[70px] md:content-center md:items-center md:rounded-none md:shadow-none ${COLUMNS}`

function CartPage() {
  const { coupon } = Route.useSearch()
  const navigate = Route.useNavigate()
  const cart = useCart()
  const hasItems = (cart.data?.items.length ?? 0) > 0
  const withCoupon = useQuote({ couponCode: coupon, network: 'ethereum', enabled: hasItems })
  const couponError = withCoupon.error instanceof ApiError && withCoupon.error.status === 422 ? apiFieldErrors(withCoupon.error).couponCode : undefined
  // Cupom recusado (inválido/expirado): o erro fica no campo e os valores vêm da cotação sem cupom.
  const withoutCoupon = useQuote({ network: 'ethereum', enabled: hasItems && couponError !== undefined })
  const quote = couponError ? withoutCoupon : withCoupon
  // Como no layout: a coleção do primeiro item; com o carrinho vazio, os destaques do catálogo.
  const firstNftId = cart.data?.items[0]?.nftId
  const related = useRelatedNfts(firstNftId)
  const featured = useFeaturedNfts()
  const suggestions = firstNftId
    ? { items: related.items, loading: related.isPending }
    : { items: featured.data?.items ?? (featured.isError ? [] : undefined), loading: cart.isPending || featured.isPending }

  return (
    <div className="page max-md:px-7">
      <h1 id="cart-title" tabIndex={-1} className="sr-only">
        Carrinho de NFTs
      </h1>
      <MobileTopBar title="Carrinho de NFTs" />
      <Breadcrumbs items={[{ label: 'Início', link: { to: '/' } }, { label: 'Mercado', link: { to: '/', hash: 'mercado' } }, { label: 'Carrinho' }]} />
      <CartNotices />

      {cart.isPending ? (
        <div role="status" aria-label="Carregando carrinho" className="md:pt-2">
          <TableHeader />
          <div className="grid gap-5 md:mt-3 md:gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[100px] w-full rounded-[14px] md:h-[70px] md:rounded-none" />
            ))}
          </div>
        </div>
      ) : cart.isError ? (
        <div className="md:pt-2">
          <QueryError error={cart.error} onRetry={() => void cart.refetch()} />
        </div>
      ) : !hasItems ? (
        <section aria-label="Carrinho vazio" className="grid animate-rise justify-items-center gap-4 rounded-[14px] bg-card px-6 py-14 text-center md:mt-2 md:rounded-none">
          <span className="grid size-16 place-items-center rounded-full bg-raised text-accent-text">
            <CartIcon className="size-7" aria-hidden="true" />
          </span>
          <p className="text-lg font-bold">Seu carrinho está vazio.</p>
          <p className="max-w-sm text-sm text-muted-foreground">Explore o mercado e adicione as edições que quer colecionar.</p>
          <Button asChild className="h-10 rounded-[3px] text-[15px]">
            <Link to="/">Continuar explorando</Link>
          </Button>
        </section>
      ) : (
        // Mobile: o resumo gruda no rodapé enquanto há itens acima (sticky ocupa espaço no fluxo,
        // então nunca cobre o último item nem o rodapé do site).
        <div className="flex flex-col gap-6 max-md:min-h-dvh md:pt-2 xl:grid xl:grid-cols-[minmax(0,782px)_332px] xl:justify-between xl:gap-8">
          <div>
            <TableHeader />
            <ul className="stagger grid gap-5 md:mt-3 md:gap-3" aria-label="Itens do carrinho">
              {cart.data.items.map((item, i) => (
                <li key={item.id} style={{ '--i': i } as CSSProperties}>
                  <CartLine item={item} line={quote.data?.lines.find((l) => l.itemId === item.id)} />
                </li>
              ))}
            </ul>
          </div>

          <aside
            aria-labelledby="summary-title"
            className="grid content-start gap-6 md:max-xl:w-[332px] md:max-xl:self-end max-md:sticky max-md:bottom-0 max-md:z-30 max-md:-mx-7 max-md:mt-auto max-md:min-h-[342px] max-md:content-between max-md:gap-8 max-md:rounded-t-[40px] max-md:bg-card max-md:px-6 max-md:pt-6 max-md:pb-[calc(36px+env(safe-area-inset-bottom))]"
          >
            <h2 id="summary-title" className="grid gap-3 text-lg leading-4 font-bold after:border-b after:border-primary/30 max-md:sr-only">
              Resumo da carteira
            </h2>
            <div className="grid gap-6 max-md:gap-3">
              <CouponForm
                applied={quote.data?.coupon?.code}
                requested={coupon}
                error={couponError}
                onApply={(code) => void navigate({ search: { coupon: code || undefined }, replace: true })}
              />
              <QuoteSummary quote={quote.data} pending={quote.isPending} error={quote.error} onRetry={() => void quote.refetch()} />
              {quote.data && !quote.data.purchasable && <FormError message="Há itens indisponíveis. Ajuste as quantidades para continuar." />}
            </div>
            <div className="grid gap-3">
              <Button
                asChild
                className="h-10 rounded-[3px] text-[15px] leading-4 max-md:h-[60px] max-md:rounded-[40px] max-md:[background-color:transparent] max-md:bg-gradient-to-r max-md:from-primary max-md:to-primary/80 max-md:text-base"
              >
                {quote.data?.purchasable ? (
                  <Link to="/checkout" search={{ coupon: quote.data.coupon?.code }}>
                    Conectar e finalizar
                  </Link>
                ) : (
                  <span aria-disabled="true">Conectar e finalizar</span>
                )}
              </Button>
              <Link to="/" className="justify-self-center text-[15px] leading-5 text-accent-text underline-offset-4 hover:underline max-md:hidden">
                Continuar explorando
              </Link>
            </div>
          </aside>
        </div>
      )}

      <div className="mt-16 md:mt-24">
        <NftRail title="Colecionadores também viram" items={suggestions.items} loading={suggestions.loading} />
      </div>
    </div>
  )
}

/** Cabeçalho visual da tabela (desktop); cada linha rotula os próprios valores para leitores de tela. */
function TableHeader() {
  return (
    <div aria-hidden="true" className={`grid border-b border-primary/30 pb-3 text-base leading-4 font-bold max-md:hidden ${COLUMNS}`}>
      <span className="col-span-2">NFTs</span>
      <span className="font-medium">Preço</span>
      <span>Edições</span>
      <span className="font-medium">Total</span>
    </div>
  )
}

function CartLine({ item, line }: { item: CartItem; line?: Quote['lines'][number] }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const error = update.error ?? remove.error
  const errorId = `qty-error-${item.id}`
  const availability =
    item.available === 0 ? 'Esgotada' : item.quantity > item.available ? `Só ${item.available} ${item.available === 1 ? 'disponível' : 'disponíveis'}` : null

  return (
    <article className={ROW} aria-label={item.name} aria-describedby={error ? errorId : undefined}>
      <img
        src={item.image.thumbnailUrl}
        alt={item.image.alt}
        width={100}
        height={100}
        className="size-[100px] rounded-[14px] object-cover max-md:row-span-2 md:size-[70px] md:rounded-[6px]"
      />
      <div className="grid min-w-0 content-start gap-1.5 pt-[13px] pl-[9px] max-md:col-span-2 max-md:col-start-2 max-md:row-start-1 max-md:pr-12 md:content-center md:pt-0 md:pl-4">
        <Link to="/nfts/$nftId" params={{ nftId: item.nftId }} className="truncate text-[15px] leading-4 font-bold transition-colors hover:text-accent-text md:text-base">
          {item.name}
        </Link>
        <p className="text-sm leading-4 text-muted-foreground md:text-subtle">
          <span className="max-md:hidden">ID do token: #{item.tokenId}</span>
          <span className="md:sr-only">
            <span className="max-md:hidden"> · </span>Edição: {item.editionName}
          </span>
        </p>
        {availability && <p className="text-xs leading-4 font-bold text-destructive">{availability}</p>}
      </div>
      <p className="text-base leading-4 font-bold text-muted-foreground max-md:sr-only">
        <span className="sr-only">Preço unitário: </span>
        <span data-testid={`cart-price-${item.id}`}>{formatEth(item.unitPrice)}</span>
      </p>
      <div className="max-md:absolute max-md:top-[38px] max-md:right-4">
        <QuantityStepper
          size="cart"
          label={`Quantidade de ${item.name} (${item.editionName})`}
          value={item.quantity}
          max={Math.max(1, item.available)}
          disabled={update.isPending || remove.isPending}
          onChange={(quantity) => update.mutate({ itemId: item.id, quantity })}
        />
      </div>
      {/* Total da linha vem da cotação da API; enquanto ela recalcula, placeholder do mesmo tamanho. */}
      <div className="h-4 pl-[9px] text-lg leading-4 font-bold text-accent-text max-md:col-start-2 max-md:row-start-2 max-md:mt-[18px] md:pl-0 md:text-base">
        <span className="sr-only">Total: </span>
        {line ? formatEth(line.lineTotal) : <Skeleton className="inline-block h-4 w-20 align-top" />}
      </div>
      <button
        type="button"
        className="grid size-6 cursor-pointer place-items-center text-subtle transition-colors hover:text-accent-text aria-disabled:cursor-not-allowed aria-disabled:opacity-50 max-md:absolute max-md:top-2 max-md:right-4"
        aria-label={`Remover ${item.name}`}
        data-remove-item=""
        {...busyProps(remove.isPending, (event) => {
          const button = event.currentTarget
          remove.mutate(item.id, {
            onSuccess: () => {
              // A linha sai do DOM: o foco vai para o "Remover" vizinho ou, com o carrinho vazio, para o título.
              moveFocusAfterRemoval(button, '[data-remove-item]', document.getElementById('cart-title'))
              announce(`${item.name} removido do carrinho.`)
            },
          })
        })}
      >
        <DeleteIcon />
      </button>
      {error && (
        <p id={errorId} role="alert" className="col-span-full px-3 pb-3 text-sm text-destructive md:px-0 md:pt-2 md:pb-2 md:pl-[86px]">
          {apiFieldErrors(error).quantity ?? apiFieldErrors(error)._}
        </p>
      )}
    </article>
  )
}

function CouponForm({
  applied,
  requested,
  error,
  onApply,
}: {
  /** Cupom aceito pela cotação. */
  applied?: string
  /** Cupom pedido na URL (pode ser inválido). */
  requested?: string
  error?: string
  onApply: (code: string) => void
}) {
  const box =
    'flex h-10 items-center rounded-[3px] border border-primary max-md:h-[50px] max-md:rounded-[40px] max-md:border-border max-md:bg-card max-md:shadow-[0_6px_20px_rgb(10_6_4/0.45)]'
  if (applied) {
    return (
      <div className="grid gap-2">
        <p className="text-sm leading-4 font-bold max-md:sr-only">Código promocional</p>
        <div className={`${box} justify-between gap-3 pl-2 max-md:pl-4`}>
          <p className="text-sm">
            Cupom aplicado: <strong className="text-accent-text">{applied}</strong>
          </p>
          <button
            type="button"
            aria-label={`Remover cupom ${applied}`}
            onClick={() => onApply('')}
            className="grid size-10 cursor-pointer place-items-center text-accent-text transition-transform active:scale-90"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    )
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onApply((formValues(e.currentTarget).coupon ?? '').trim().toUpperCase())
      }}
    >
      <label htmlFor="coupon" className="text-sm leading-4 font-bold max-md:sr-only">
        Código promocional
      </label>
      <div className={`${box} focus-within:ring-2 focus-within:ring-ring/40 has-aria-invalid:border-destructive`}>
        <Input
          id="coupon"
          name="coupon"
          placeholder="Digite o código promocional..."
          autoComplete="off"
          defaultValue={requested ?? ''}
          key={requested ?? ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-full rounded-none border-0 bg-transparent px-2 text-xs uppercase placeholder:normal-case focus-visible:ring-0 aria-invalid:ring-0 max-md:px-4 max-md:text-[13px]"
        />
        <Button
          type="submit"
          className="h-full w-[102px] rounded-none rounded-r-[3px] text-[15px] leading-4 max-md:w-[97px] max-md:rounded-[40px] max-md:[background-color:transparent] max-md:bg-gradient-to-r max-md:from-primary/55 max-md:to-primary max-md:text-primary-foreground"
        >
          Aplicar
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

/** Avisos de mudança de preço/disponibilidade recebidos em tempo real (região viva sempre montada). */
function CartNotices() {
  const notices = useNotices().filter((n) => n.topic === 'cart')
  return (
    <div aria-live="polite" data-testid="cart-notices">
      {notices.length > 0 && (
        <ul className="grid gap-2 pt-3 pb-1" aria-label="Alterações no carrinho">
          {notices.map((notice) => (
            <li key={notice.id} className="flex animate-rise items-center justify-between gap-3 rounded-[3px] border border-primary/50 bg-band py-1 pr-1 pl-4 text-sm">
              <span>{notice.message}</span>
              <button
                type="button"
                onClick={() => dismissNotice(notice.id)}
                aria-label="Dispensar aviso"
                className="grid size-10 shrink-0 cursor-pointer place-items-center text-accent-text"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
