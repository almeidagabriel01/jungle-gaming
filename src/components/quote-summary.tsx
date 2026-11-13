import { QueryError } from '@/components/query-error'
import { Skeleton } from '@/components/ui/skeleton'
import type { Quote } from '@/contracts/cart'
import { formatEth } from '@/lib/money'

/** Resumo de valores sempre vindo da cotação da API (nenhum cálculo de total no cliente). */
export function QuoteSummary({ quote, pending, error, onRetry }: { quote?: Quote; pending: boolean; error: unknown; onRetry: () => void }) {
  if (error) return <QueryError error={error} onRetry={onRetry} title="Não foi possível calcular o resumo" />
  if (pending || !quote) {
    return (
      <div role="status" aria-label="Calculando resumo" className="grid gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums" data-testid="quote-summary">
      <dt>Subtotal</dt>
      <dd className="text-right" data-testid="quote-subtotal">
        {formatEth(quote.subtotal)}
      </dd>
      <dt>Desconto{quote.coupon ? ` (${quote.coupon.code}, ${quote.coupon.percentOff}%)` : ''}</dt>
      <dd className="text-right">−{formatEth(quote.discount)}</dd>
      <dt>Taxa de rede</dt>
      <dd className="text-right">{formatEth(quote.networkFee)}</dd>
      <dt className="font-semibold">Total</dt>
      <dd className="text-right font-semibold" data-testid="quote-total">
        {formatEth(quote.total)}
      </dd>
    </dl>
  )
}
