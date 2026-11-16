import { cn } from 'cn'

/** Sinais dos botões do layout: barra de 15×2 / 9×1 (ou 9×2 no carrinho mobile), em currentColor. */
const Minus = () => (
  <svg viewBox="0 0 15 15" aria-hidden="true" fill="currentColor">
    <rect y="6.5" width="15" height="2" rx="1" />
  </svg>
)
const Plus = () => (
  <svg viewBox="0 0 15 15" aria-hidden="true" fill="currentColor">
    <rect y="6.5" width="15" height="2" rx="1" />
    <rect x="6.5" width="2" height="15" rx="1" />
  </svg>
)

/**
 * Medidas dos frames:
 * - `md`: detalhe desktop, pílula laranja 33×50 (ícone 15, número 20/28);
 * - `sm`: carrinho desktop e detalhe mobile, pílula 20×30 (ícone 9, número 17/24);
 * - `cart`: `sm` no desktop e, no mobile, botão redondo 24 Surface Raised com borda (carrinho mobile).
 * Os alvos menores que 24 px cumprem a WCAG 2.5.8 pelo espaçamento (o número fica entre os botões).
 */
const SIZES = {
  md: { group: 'gap-3', button: 'h-[50px] w-[33px] shadow-[0_6.6px_19.8px_-3.3px_rgb(20_13_10/0.15)] [&_svg]:size-[15px]', value: 'text-xl leading-7' },
  sm: { group: 'gap-3', button: 'h-[30px] w-5 shadow-[0_4px_12px_-2px_rgb(20_13_10/0.15)] [&_svg]:size-[9px]', value: 'text-[17px] leading-6' },
  cart: {
    group: 'gap-2 md:gap-3',
    button:
      'size-6 border-border bg-raised text-foreground aria-disabled:text-border-soft md:h-[30px] md:w-5 md:border-background md:bg-primary md:text-primary-foreground md:shadow-[0_4px_12px_-2px_rgb(20_13_10/0.15)] md:aria-disabled:text-primary-foreground [&_svg]:size-[9px]',
    value: 'text-[17px] leading-6',
  },
} as const

/**
 * Quantidade com os botões do layout. Inteiros entre `min` e `max` (disponibilidade da edição);
 * o valor é anunciado pelo nome do grupo e os limites desabilitam os botões.
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
  size?: keyof typeof SIZES
  disabled?: boolean
}) {
  const s = SIZES[size]
  const button = cn(
    'grid shrink-0 cursor-pointer place-items-center rounded-full border border-background bg-primary text-primary-foreground transition-[transform,background-color] hover:brightness-110 active:scale-90 aria-disabled:cursor-not-allowed aria-disabled:hover:brightness-100 aria-disabled:active:scale-100',
    s.button,
  )
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center', s.group)}>
      {/* aria-disabled (não disabled): o botão continua focável, então o foco do teclado não cai no body enquanto a alteração é enviada ou no limite. */}
      <button type="button" className={button} aria-label="Diminuir quantidade" aria-disabled={disabled || value <= min} onClick={() => !(disabled || value <= min) && onChange(value - 1)}>
        <Minus />
      </button>
      <output aria-live="polite" className={cn('min-w-[11px] text-center tabular-nums', s.value)}>
        {value}
      </output>
      <button type="button" className={button} aria-label="Aumentar quantidade" aria-disabled={disabled || value >= max} onClick={() => !(disabled || value >= max) && onChange(value + 1)}>
        <Plus />
      </button>
    </div>
  )
}
