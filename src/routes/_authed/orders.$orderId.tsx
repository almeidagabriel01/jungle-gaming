import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ApiError } from '@/api/client'
import thankYou from '@/assets/thank-you.svg'
import { CloseIcon } from '@/components/icons/cart-icons'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/contracts/order'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'
import { eth, formatEth } from '@/lib/money'
import { useOrder } from '@/queries/orders'

export const Route = createFileRoute('/_authed/orders/$orderId')({
  component: OrderPage,
})

const STATUS_MESSAGE: Record<Order['status'], string> = {
  pending: 'Aguardando confirmação do pagamento.',
  confirmed: 'Pagamento confirmado. Seus NFTs agora estão na sua carteira.',
  declined: 'Pagamento recusado.',
}

/** "29 Jul, 2026", como no layout, com o mês abreviado em português. */
function formatDate(iso: string) {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const month = get('month').replace('.', '')
  return `${get('day')} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${get('year')}`
}

/** "0xA91F…E82C": início e fim do hash; o completo fica disponível para leitor de tela e no title. */
const shortHash = (hash: string) => `0x${hash.slice(2, 6).toUpperCase()}…${hash.slice(-4).toUpperCase()}`

/** Cartão central da confirmação (frame "Order Confirmation Modal"): é a página, não um diálogo. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="page flex justify-center pt-24 max-md:pt-6">
      <div className="relative w-full max-w-[578px] animate-rise overflow-hidden bg-card">
        <Link
          to="/"
          aria-label="Fechar e voltar ao início"
          className="absolute top-[10px] right-[7px] z-10 grid size-8 place-items-center text-primary transition-transform hover:scale-110"
        >
          <CloseIcon />
        </Link>
        {children}
        <div aria-hidden="true" className="h-2.5 bg-primary" />
      </div>
    </div>
  )
}

function OrderPage() {
  const { orderId } = Route.useParams()
  const order = useOrder(orderId)

  if (order.isPending) {
    return (
      <Card>
        <div role="status" aria-label="Carregando pedido" className="grid justify-items-center gap-4 pt-[22px] pb-6">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="mx-11 mb-12 h-[420px]" />
      </Card>
    )
  }
  if (order.isError) {
    if (order.error instanceof ApiError && (order.error.status === 403 || order.error.status === 404)) {
      return (
        <Card>
          <section className="grid justify-items-center gap-4 px-11 pt-14 pb-12 text-center">
            <h1 className="text-lg font-bold">{order.error.status === 403 ? 'Acesso negado' : 'Pedido não encontrado'}</h1>
            <p className="text-sm text-muted-foreground">{order.error.message}</p>
            <Button asChild className="h-12 rounded-[5px] px-4 text-base">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </section>
        </Card>
      )
    }
    return (
      <Card>
        <div className="px-11 pt-14 pb-12">
          <QueryError error={order.error} onRetry={() => void order.refetch()} />
        </div>
      </Card>
    )
  }
  return <OrderStatusView order={order.data} />
}

function OrderStatusView({ order }: { order: Order }) {
  return (
    <Card>
      <section aria-labelledby="order-title" data-testid="order-view" data-status={order.status}>
        {/* Região viva estável: o pedido muda de estado ao vivo (order.updated ou polling) sem remontar. */}
        <p role="status" className="sr-only">
          {STATUS_MESSAGE[order.status]}
        </p>
        {order.status === 'confirmed' ? (
          <Receipt order={order} />
        ) : order.status === 'pending' ? (
          <div className="grid justify-items-center gap-4 px-6 pt-[52px] pb-12 text-center md:px-11">
            <h1 id="order-title" className="text-base leading-4 font-bold text-muted-foreground">
              Aguardando confirmação do pagamento
            </h1>
            <div aria-hidden="true" className="h-1 w-48 overflow-hidden rounded-full bg-raised">
              <div className="skeleton-shimmer h-full w-full bg-primary/40" />
            </div>
            <p className="max-w-[420px] text-sm leading-[22px] text-muted-foreground">
              A transação está sendo processada na rede. Pode fechar esta página: o estado é recuperado ao voltar.
            </p>
          </div>
        ) : (
          <div className="grid justify-items-center gap-4 px-6 pt-[52px] pb-12 text-center md:px-11">
            <h1 id="order-title" className="text-base leading-4 font-bold text-destructive">
              Pagamento recusado
            </h1>
            <p className="max-w-[420px] text-sm leading-[22px] text-muted-foreground">
              {(order.failureReason ?? 'A transação não foi concluída').replace(/[.!]?$/, '.')} Seus itens continuam no carrinho.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button asChild className="h-12 rounded-[5px] px-4 text-base">
                <Link to="/checkout" search={{ coupon: order.coupon?.code }}>
                  Voltar ao pagamento
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-[5px] px-4 text-base">
                <Link to="/cart">Ver carrinho</Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </Card>
  )
}

function Receipt({ order }: { order: Order }) {
  const network = NETWORK_LABEL[order.network]
  const hasDiscount = eth.cmp(order.discount, '0') > 0
  return (
    <div data-testid="receipt">
      <header className="grid h-[156px] content-start justify-items-center gap-4 px-6 pt-[22px] text-center">
        <img src={thankYou} alt="" width={80} height={80} className="size-20" />
        <h1 id="order-title" className="text-base leading-4 font-bold text-muted-foreground">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-5 py-3 text-muted-foreground md:flex md:h-[67px] md:items-center md:justify-between md:px-9 md:py-1">
        <MetaItem label="ID da transação" strong divider={false}>
          {order.txHash ? (
            <span title={order.txHash}>
              <span aria-hidden="true">{shortHash(order.txHash)}</span>
              <span className="sr-only">{order.txHash}</span>
            </span>
          ) : (
            '—'
          )}
        </MetaItem>
        <MetaItem label="Data">
          <time dateTime={order.updatedAt}>{formatDate(order.updatedAt)}</time>
        </MetaItem>
        <MetaItem label="Total">{formatEth(order.total)}</MetaItem>
        <MetaItem label="Carteira" strong>
          {PROVIDER_LABEL[order.buyer.provider]}
        </MetaItem>
      </dl>

      <div className="grid gap-3 px-5 pt-5 pb-12 md:px-11">
        <h2 className="text-[15px] leading-4 font-bold">Detalhes da transação</h2>
        <table className="w-full table-fixed">
          <caption className="sr-only">Itens do pedido</caption>
          <colgroup>
            <col />
            <col className="w-0 md:w-[68px]" />
            <col className="w-[92px] md:w-[125px]" />
          </colgroup>
          <thead>
            <tr className="text-base leading-4">
              <th scope="col" className="border-b border-primary/30 pb-3 text-left font-bold">
                NFTs
              </th>
              <th scope="col" className="border-b border-primary/30 pb-3 text-left font-bold max-md:sr-only">
                Edições
              </th>
              <th scope="col" className="border-b border-primary/30 pb-3 text-right font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId}>
                <td className="p-0 pt-3">
                  <div className="flex items-center gap-3">
                    <img src={line.image.thumbnailUrl} alt={line.image.alt} width={70} height={70} className="size-12 shrink-0 rounded-[8px] object-cover md:size-[70px]" />
                    <div className="grid min-w-0 gap-1.5">
                      <p className="text-[15px] leading-4 font-bold break-words md:text-base">{line.name}</p>
                      <p className="text-sm leading-4 text-subtle">ID do token: #{line.tokenId}</p>
                      <p aria-hidden="true" className="text-sm leading-4 text-muted-foreground md:hidden">(x {line.quantity})</p>
                    </div>
                  </div>
                </td>
                <td className="p-0 pt-3 pl-1 text-left text-sm leading-4 text-muted-foreground max-md:sr-only">
                  <span className="sr-only">Quantidade: </span>(x {line.quantity})
                </td>
                <td className="p-0 pt-3 text-right text-lg leading-4 font-bold text-accent-text max-md:text-base">{formatEth(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="grid gap-3 md:ml-auto md:w-[321px]">
          {hasDiscount && (
            <div className="flex h-5 items-center justify-between gap-4">
              <dt className="text-[15px] leading-5">{order.coupon ? `Cupom ${order.coupon.code} (${order.coupon.percentOff}%)` : 'Desconto do lançamento'}</dt>
              <dd className="text-right text-[15px]">(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex h-5 items-center justify-between gap-4">
            <dt className="text-[15px] leading-5">Taxa de rede</dt>
            <dd className="text-right text-lg leading-4">{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex h-4 items-center justify-between gap-4">
            <dt className="text-base leading-4 font-bold">Total</dt>
            <dd className="text-right text-lg leading-4 font-bold text-accent-text" data-testid="receipt-total">
              {formatEth(order.total)}
            </dd>
          </div>
        </dl>

        <div className="grid justify-items-center gap-5 border-t border-primary/30 pt-3 text-center">
          <p className="text-sm leading-[22px] text-muted-foreground">
            Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
          </p>
          {order.explorerUrl && (
            <Button asChild className="h-12 rounded-[5px] px-4 text-base leading-4">
              <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
                {order.network === 'ethereum' ? 'Ver no Etherscan' : 'Ver no explorador'}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Coluna da faixa de metadados; a partir da segunda, o fio laranja vertical de 31 px à esquerda. */
function MetaItem({ label, strong = false, divider = true, children }: { label: string; strong?: boolean; divider?: boolean; children: ReactNode }) {
  return (
    <div
      className={`relative grid min-w-0 ${divider ? 'md:pl-[18px] md:before:absolute md:before:top-0.5 md:before:left-0 md:before:h-[31px] md:before:w-px md:before:bg-primary' : ''}`}
    >
      <dt className={`text-sm leading-4 ${strong ? 'font-bold' : ''}`}>{label}</dt>
      <dd className="text-[15px] leading-5 break-all">{children}</dd>
    </div>
  )
}
