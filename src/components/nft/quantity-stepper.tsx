import { Minus, Plus } from 'lucide-react'
import { cn } from 'cn'

/**
 * Quantidade com os botões laranja do layout. Inteiros entre `min` e `max` (disponibilidade
 * da edição); o valor é anunciado pelo nome do grupo e os limites desabilitam os botões.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = 'md',
  disabled = false,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  /** Nome acessível do grupo, ex.: "Quantidade de Emerald Ape #042". */
  label: string
  size?: 'md' | 'sm'
  disabled?: boolean
}) {
  const button = cn(
    'grid shrink-0 cursor-pointer place-items-center bg-primary text-primary-foreground transition-[transform,background-color] hover:bg-[#dd9a5f] active:scale-90 disabled:cursor-not-allowed disabled:bg-raised disabled:text-subtle',
    size === 'md' ? 'h-12 w-8 rounded-full [&_svg]:size-5' : 'size-[22px] rounded-full [&_svg]:size-3.5',
  )
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center', size === 'md' ? 'gap-3' : 'gap-2')}>
      <button type="button" className={button} aria-label="Diminuir quantidade" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus strokeWidth={3} />
      </button>
      <output aria-live="polite" className={cn('min-w-6 text-center', size === 'md' ? 'text-lg' : 'text-[17px]')}>
        {value}
      </output>
      <button type="button" className={button} aria-label="Aumentar quantidade" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus strokeWidth={3} />
      </button>
    </div>
  )
}
