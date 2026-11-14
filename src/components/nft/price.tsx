import { cn } from 'cn'
import type { Eth } from '@/contracts/common'
import { formatEth } from '@/lib/money'

/** Preço em ETH do layout: laranja em negrito; o preço anterior vem ao lado, em peso normal e tom secundário. */
export function Price({ value, compareAt, className }: { value: Eth; compareAt?: Eth | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-3 text-lg leading-4 font-bold text-accent-text', className)}>
      <span>{formatEth(value)}</span>
      {compareAt && (
        <span className="font-normal text-subtle">
          <span className="sr-only">Antes: </span>
          {formatEth(compareAt)}
        </span>
      )}
    </p>
  )
}
