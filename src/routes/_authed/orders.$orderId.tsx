import { createFileRoute, Link } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import { QueryError } from '@/components/query-error'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/contracts/order'
import { formatEth } from '@/lib/money'
import { useOrder } from '@/queries/orders'

export const Route = createFileRoute('/_authed/orders/$orderId')({
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  const order = useOrder(orderId)

  if (order.isPending) {
    return (
      <div role="status" aria-label="Carregando pedido" className="grid gap-3">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (order.isError) {
    if (order.error instanceof ApiError && (order.error.status === 403 || order.error.status === 404)) {
      return (
        <section className="grid gap-3">
          <h1 className="text-2xl font-semibold">{order.error.status === 403 ? 'Acesso negado' : 'Pedido não encontrado'}</h1>
          <p>{order.error.message}</p>
          <Link to="/" className="underline">
            Voltar ao início
          </Link>
        </section>
      )
    }
    return <QueryError error={order.error} onRetry={() => void order.refetch()} />
  }
  return <OrderStatusView order={order.data} />
}

function OrderStatusView({ order }: { order: Order }) {
  return (
    <section aria-labelledby="order-title" className="grid gap-4" data-testid="order-view" data-status={order.status}>
      <div aria-live="polite">
        {order.status === 'pending' && (
          <>
            <h1 id="order-title" className="text-2xl font-semibold">
              Aguardando confirmação do pagamento
            </h1>
            <p>Pedido {order.id}. Pode fechar esta página: o estado é recuperado ao voltar.</p>
          </>
        )}
        {order.status === 'declined' && (
          <>
            <h1 id="order-title" className="text-2xl font-semibold">
              Pagamento recusado
            </h1>
            <p>{order.failureReason ?? 'A transação não foi concluída.'} Seus itens continuam no carrinho.</p>
            <Link to="/cart" className="underline">
              Voltar ao carrinho
            </Link>
          </>
        )}
        {order.status === 'confirmed' && (
          <h1 id="order-title" className="text-2xl font-semibold">
            Pedido confirmado
          </h1>
        )}
      </div>

      {/* O recibo só existe para pedido confirmado pela simulação, e reproduz o snapshot do pedido. */}
      {order.status === 'confirmed' && <Receipt order={order} />}
    </section>
  )
}

function Receipt({ order }: { order: Order }) {
  return (
    <div className="grid gap-4 rounded-lg border p-4" data-testid="receipt">
      <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Pedido</dt>
        <dd>{order.id}</dd>
        <dt className="text-muted-foreground">Transação</dt>
        <dd className="break-all font-mono">
          {order.txHash}{' '}
          {order.explorerUrl && (
            <a href={order.explorerUrl} target="_blank" rel="noreferrer noopener" className="underline">
              Ver no explorador (simulado)
            </a>
          )}
        </dd>
        <dt className="text-muted-foreground">Carteira</dt>
        <dd>
          {order.wallet.label} · <span className="break-all font-mono">{order.wallet.address}</span>
        </dd>
        <dt className="text-muted-foreground">Rede</dt>
        <dd>{order.network}</dd>
      </dl>
      <table className="w-full text-sm">
        <caption className="sr-only">Itens do pedido</caption>
        <thead>
          <tr className="text-left">
            <th scope="col">Item</th>
            <th scope="col">Qtd.</th>
            <th scope="col" className="text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.itemId}>
              <td>
                {line.name} ({line.editionName})
              </td>
              <td className="tabular-nums">{line.quantity}</td>
              <td className="text-right tabular-nums">{formatEth(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 tabular-nums">
        <dt>Subtotal</dt>
        <dd className="text-right">{formatEth(order.subtotal)}</dd>
        <dt>Desconto</dt>
        <dd className="text-right">−{formatEth(order.discount)}</dd>
        <dt>Taxa de rede</dt>
        <dd className="text-right">{formatEth(order.networkFee)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold" data-testid="receipt-total">
          {formatEth(order.total)}
        </dd>
      </dl>
    </div>
  )
}
