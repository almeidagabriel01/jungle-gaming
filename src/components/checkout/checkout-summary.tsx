import { useId, useState, type CSSProperties } from 'react'
import { controlClass } from '@/components/account/form-classes'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Quote, QuoteLine } from '@/contracts/cart'
import { formValues } from '@/lib/forms'
import { eth, formatEth } from '@/lib/money'

/** Desconto zero aparece como no layout: "(-) 00.00". */
const discountLabel = (quote: Quote) => (eth.eq(quote.discount, '0') ? '(-) 00.00' : `(-) ${formatEth(quote.discount)}`)

/** "Seus NFTs" do frame Pagamento: linhas da cotação (miniatura, nome, ID do token, quantidade, subtotal). */
export function OrderLines({ quote }: { quote?: Quote }) {
  return (
    <div className="grid gap-3">
      <div aria-hidden="true" className="grid gap-3 after:border-b after:border-primary/30">
        <div className="flex justify-between text-base leading-4">
          <span className="font-bold">NFTs</span>
          <span className="font-medium">Subtotal</span>
        </div>
      </div>
      {quote ? (
        <ul className="stagger grid gap-3" aria-label="NFTs do pedido">
          {quote.lines.map((line, i) => (
            <li key={line.itemId} style={{ '--i': i } as CSSProperties}>
              <Line line={line} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[70px] w-full rounded-none" />
          ))}
        </div>
      )}
    </div>
  )
}

function Line({ line }: { line: QuoteLine }) {
  return (
    <div className="flex h-[70px] items-center bg-card pr-4 pl-1">
      <img src={line.image.thumbnailUrl} alt={line.image.alt} width={70} height={70} loading="lazy" className="size-[70px] shrink-0 rounded-lg object-cover" />
      <div className="ml-2 grid min-w-0 flex-1 gap-1.5">
        <p className="truncate text-base leading-4 font-bold">{line.name}</p>
        <p className="truncate text-sm leading-4 text-subtle">ID do token: #{line.tokenId}</p>
      </div>
      <p className="ml-1 shrink-0 text-sm leading-4 text-muted-foreground">
        <span className="sr-only">Quantidade: </span>(x {line.quantity})
      </p>
      <p className="ml-1.5 shrink-0 text-right text-lg leading-4 font-bold text-accent-text">
        <span className="sr-only">Subtotal: </span>
        {formatEth(line.lineTotal)}
      </p>
      {line.status !== 'ok' && (
        <p className="sr-only">{line.status === 'sold-out' ? 'Esgotado' : `Só ${line.available} disponível(is)`}</p>
      )}
    </div>
  )
}

/** Valores sempre da cotação da API (frame Pagamento: taxa estimada e total centralizados). */
export function OrderTotals({ quote, error, onRetry }: { quote?: Quote; error?: unknown; onRetry: () => void }) {
  if (error) return <QueryError error={error} onRetry={onRetry} title="Não foi possível calcular o resumo" />
  if (!quote) {
    return (
      <div role="status" aria-label="Calculando resumo" className="grid gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex h-5 items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
        <Skeleton className="mx-auto h-4 w-28" />
        <div className="mx-auto flex h-4 w-[321px] max-w-full justify-between border-t border-primary/30 pt-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    )
  }
  return (
    <div className="grid gap-3 text-[15px] leading-5" data-testid="quote-summary">
      <dl className="grid gap-3">
      <div className="flex items-center justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg leading-4" data-testid="quote-subtotal">
          {formatEth(quote.subtotal)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt>{quote.coupon ? `Cupom ${quote.coupon.code} (${quote.coupon.percentOff}%)` : 'Desconto do lançamento'}</dt>
        <dd>{discountLabel(quote)}</dd>
      </div>
      {/* Grupo dt + dd + dd: a nota "Taxa estimada" fica centralizada sob a linha. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-y-3">
        <dt>Taxa de rede</dt>
        <dd className="text-lg leading-4">{formatEth(quote.networkFee)}</dd>
        <dd className="col-span-2 text-center text-xs leading-4 text-accent-text">Taxa estimada</dd>
      </div>
      </dl>
      <dl className="grid gap-3 before:border-t before:border-primary/30">
        <div className="mx-auto flex w-[321px] max-w-full items-center justify-between text-base leading-4 font-bold">
          <dt>Total</dt>
          <dd className="text-lg leading-4 text-accent-text" data-testid="quote-total">
            {formatEth(quote.total)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/** "Tem um código promocional? Aplique aqui": abre o campo; a validação vem da API. */
export function CouponPrompt({
  applied,
  error,
  checking,
  onApply,
  onRemove,
}: {
  applied?: string
  error?: string
  checking: boolean
  onApply: (code: string) => void
  onRemove: () => void
}) {
  const [opened, setOpen] = useState(false)
  // Erro que chega depois (cupom da URL recusado pela cotação) abre o campo para mostrar o motivo.
  const open = opened || Boolean(error)
  const inputId = useId()
  if (applied && !error) {
    return (
      <p className="text-center text-sm leading-4">
        Cupom {applied} aplicado.{' '}
        <button type="button" onClick={onRemove} className="cursor-pointer text-accent-text underline-offset-4 hover:underline">
          Remover
        </button>
      </p>
    )
  }
  return (
    <div className="grid gap-3">
      <p className="text-center text-sm leading-4">
        Tem um código promocional?{' '}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="cursor-pointer underline-offset-4 hover:text-accent-text hover:underline">
          Aplique aqui
        </button>
      </p>
      {open && (
        <form
          noValidate
          className="grid animate-fade gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            const code = (formValues(e.currentTarget).coupon ?? '').trim().toUpperCase()
            if (code) onApply(code)
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Código promocional
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              name="coupon"
              defaultValue={applied}
              autoComplete="off"
              placeholder="Código promocional"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className={`${controlClass} uppercase placeholder:normal-case`}
            />
            <Button type="submit" variant="outline" disabled={checking} className="h-10 rounded-[3px]">
              {checking ? 'Aplicando…' : 'Aplicar'}
            </Button>
          </div>
          {error && (
            <p id={`${inputId}-error`} role="alert" className="text-[13px] leading-4 text-destructive">
              {error}{' '}
              {applied && (
                <button type="button" onClick={onRemove} className="cursor-pointer text-accent-text underline-offset-4 hover:underline">
                  Remover cupom
                </button>
              )}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
