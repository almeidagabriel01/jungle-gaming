import type { ReactNode } from 'react'
import { QueryError } from '@/components/query-error'
import { Skeleton } from '@/components/ui/skeleton'
import type { Quote } from '@/contracts/cart'
import { eth, formatEth } from '@/lib/money'

const ROW = 'flex h-5 items-center justify-between gap-4'
/** Valores de subtotal e taxa: 18 px no desktop, 16 px no mobile (frames "Resumo da carteira"). */
const AMOUNT = 'text-right text-lg leading-4 max-md:text-base'

/** Mesma grade do resumo pronto e do skeleton: nada se mexe quando os valores chegam. */
function Layout({ subtotal, discount, discountLabel, fee, total }: Record<'subtotal' | 'discount' | 'discountLabel' | 'fee' | 'total', ReactNode>) {
  return (
    <>
      <div className={ROW}>
        <dt>Subtotal</dt>
        {subtotal}
      </div>
      <div className={ROW}>
        <dt>{discountLabel}</dt>
        {discount}
      </div>
      {/* Um grupo dt + dd + dd (válido em <dl>): a nota "Taxa estimada" fica sob o valor. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 max-md:gap-y-0">
        <dt className="h-5 leading-5">Taxa de rede</dt>
        {fee}
        <dd className="col-span-2 text-right text-xs leading-4 text-accent-text">Taxa estimada</dd>
      </div>
      <div className="mt-3 flex h-4 items-center justify-between gap-4 max-md:mt-0">
        <dt className="text-base leading-4 font-bold">Total</dt>
        {total}
      </div>
    </>
  )
}

/**
 * Resumo de valores sempre vindo da cotação da API (nenhum cálculo de total no cliente).
 * Layout "Resumo da carteira": subtotal, desconto, taxa de rede (estimada) e total em destaque.
 */
export function QuoteSummary({ quote, pending, error, onRetry }: { quote?: Quote; pending: boolean; error: unknown; onRetry: () => void }) {
  if (error) return <QueryError error={error} onRetry={onRetry} title="Não foi possível calcular o resumo" />
  if (pending || !quote) {
    const value = (w: string) => (
      <dd>
        <Skeleton className={`h-4 ${w}`} />
      </dd>
    )
    return (
      <dl role="status" aria-label="Calculando resumo" className="grid gap-3 text-[15px] leading-5">
        <Layout subtotal={value('w-24')} discountLabel="Desconto do lançamento" discount={value('w-20')} fee={value('w-24')} total={value('w-28')} />
      </dl>
    )
  }
  return (
    <dl className="grid gap-3 text-[15px] leading-5" data-testid="quote-summary">
      <Layout
        subtotal={
          <dd className={AMOUNT} data-testid="quote-subtotal">
            {formatEth(quote.subtotal)}
          </dd>
        }
        discountLabel={quote.coupon ? `Cupom ${quote.coupon.code} (${quote.coupon.percentOff}%)` : 'Desconto do lançamento'}
        // Desconto zero é escrito como no layout: "(-) 00.00".
        discount={<dd className="text-right">{eth.eq(quote.discount, '0') ? '(-) 00.00' : `(-) ${formatEth(quote.discount)}`}</dd>}
        fee={<dd className={AMOUNT}>{formatEth(quote.networkFee)}</dd>}
        total={
          <dd className="text-right text-lg leading-4 font-bold text-accent-text" data-testid="quote-total">
            {formatEth(quote.total)}
          </dd>
        }
      />
    </dl>
  )
}
