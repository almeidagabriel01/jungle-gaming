import { cn } from 'cn'
import type { Eth } from '@/contracts/common'
import { formatEth } from '@/lib/money'

/** Preço em ETH do layout: laranja em negrito; o preço anterior aparece riscado ao lado. */
export function Price({ value, compareAt, className }: { value: Eth; compareAt?: Eth | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 text-lg leading-tight font-bold text-accent-text', className)}>
      <span>{formatEth(value)}</span>
      {compareAt && (
        <s className="font-normal text-subtle">
          <span className="sr-only">Antes: </span>
          {formatEth(compareAt)}
        </s>
      )}
    </p>
  )
}
