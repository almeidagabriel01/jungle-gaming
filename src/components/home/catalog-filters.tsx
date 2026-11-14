import { Check } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Network } from '@/contracts/common'
import { Category, type NftFacets, type NftSearch } from '@/contracts/nft'
import { CATEGORY_LABEL, NETWORK_LABEL } from '@/lib/labels'
import { eth, formatEth } from '@/lib/money'

/** Rótulo do slider como no layout ("0,02 - 12,30 ETH"), direto dos centésimos inteiros. */
const centsLabel = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`

type Props = { search: NftSearch; facets: NftFacets | undefined; onChange: (patch: Partial<NftSearch>) => void }

/** Lateral "Coleções / Faixa de preço / Rede" do layout; contagens vêm das facetas da API. */
export function CatalogFilters({ search, facets, onChange }: Props) {
  return (
    <div className="grid gap-10 bg-card p-5">
      <OptionGroup
        legend="Coleções"
        options={Category.options}
        selected={search.categories}
        label={(c) => CATEGORY_LABEL[c]}
        count={(c) => facets?.categories[c]}
        onChange={(categories) => onChange({ categories })}
      />
      <PriceRange search={search} facets={facets} onChange={onChange} />
      <OptionGroup
        legend="Rede"
        options={Network.options}
        selected={search.networks}
        label={(n) => NETWORK_LABEL[n]}
        count={(n) => facets?.networks[n]}
        onChange={(networks) => onChange({ networks })}
      />
    </div>
  )
}

/** Multisseleção com a aparência de lista do layout; a caixa à esquerda mostra o estado além da cor. */
function OptionGroup<T extends string>({
  legend,
  options,
  selected,
  label,
  count,
  onChange,
}: {
  legend: string
  options: readonly T[]
  selected: T[]
  label: (option: T) => string
  count: (option: T) => number | undefined
  onChange: (selected: T[]) => void
}) {
  return (
    <fieldset className="grid">
      <legend className="mb-3 text-lg leading-4 font-bold">{legend}</legend>
      {options.map((option) => {
        const checked = selected.includes(option)
        const n = count(option)
        return (
          <label
            key={option}
            className={cn(
              'group flex h-10 cursor-pointer items-center gap-2.5 px-3 text-[15px] transition-colors hover:text-accent-text has-focus-visible:outline-2 has-focus-visible:outline-ring',
              checked ? 'text-accent-text' : 'text-muted-foreground',
            )}
          >
            {/* Checkbox nativo estilizado: o próprio input é a caixa (clique, teclado e leitor de tela). */}
            <span className="relative grid size-4 shrink-0">
              <input
                type="checkbox"
                className="peer size-4 cursor-pointer appearance-none rounded-[3px] border border-subtle transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none"
                checked={checked}
                onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((o) => o !== option))}
              />
              <Check aria-hidden="true" className="pointer-events-none absolute inset-0.5 size-3 text-primary-foreground opacity-0 peer-checked:opacity-100" strokeWidth={3} />
            </span>
            <span className="flex-1">{label(option)}</span>
            {n !== undefined && <span className="font-bold tabular-nums">({n})</span>}
          </label>
        )
      })}
    </fieldset>
  )
}

/**
 * Faixa de preço com dois controles deslizantes nativos (teclado e leitor de tela de graça).
 * A escala é em centésimos inteiros convertidos por string: o filtro nunca passa por float.
 */
function PriceRange({ search, facets, onChange }: Props) {
  const id = useId()
  const bounds = facets?.price
  const lo = bounds ? eth.toCents(bounds.min, 'floor') : 0
  const hi = bounds ? eth.toCents(bounds.max, 'ceil') : 0
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v))
  const fromUrl = (value: string | undefined, fallback: number, mode: 'floor' | 'ceil') => clamp(value ? eth.toCents(value, mode) : fallback)

  const applied = `${search.minPrice ?? ''}|${search.maxPrice ?? ''}|${lo}|${hi}`
  const [synced, setSynced] = useState(applied)
  const [min, setMin] = useState(() => fromUrl(search.minPrice, lo, 'floor'))
  const [max, setMax] = useState(() => fromUrl(search.maxPrice, hi, 'ceil'))
  // URL (ou facetas) mudaram por fora: o slider volta a refletir o filtro aplicado.
  if (applied !== synced) {
    setSynced(applied)
    setMin(fromUrl(search.minPrice, lo, 'floor'))
    setMax(fromUrl(search.maxPrice, hi, 'ceil'))
  }

  const thumb =
    'pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[21px] [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-[21px] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary focus-visible:outline-none [&:focus-visible::-webkit-slider-thumb]:outline-2 [&:focus-visible::-webkit-slider-thumb]:outline-offset-2 [&:focus-visible::-webkit-slider-thumb]:outline-ring'

  return (
    <fieldset className="grid gap-3 pl-3" disabled={!bounds}>
      <legend className="mb-3 text-lg leading-4 font-bold">Faixa de preço</legend>
      <div className="relative -my-[1.5px] h-6">
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-primary" />
        <label htmlFor={`${id}-min`} className="sr-only">
          Preço mínimo
        </label>
        <input
          id={`${id}-min`}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={min}
          aria-valuetext={bounds ? formatEth(eth.fromCents(min)) : undefined}
          onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
          className={thumb}
        />
        <label htmlFor={`${id}-max`} className="sr-only">
          Preço máximo
        </label>
        <input
          id={`${id}-max`}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={max}
          aria-valuetext={bounds ? formatEth(eth.fromCents(max)) : undefined}
          onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
          className={thumb}
        />
      </div>
      <p className="text-[15px] leading-5 tabular-nums" aria-live="polite">
        Preço: {bounds ? `${centsLabel(min)} - ${centsLabel(max)} ETH` : '—'}
      </p>
      <Button
        type="button"
        className="h-9 w-fit px-3 text-base leading-5 font-bold"
        onClick={() =>
          onChange({
            minPrice: min > lo ? eth.fromCents(min) : undefined,
            maxPrice: max < hi ? eth.fromCents(max) : undefined,
          })
        }
      >
        Aplicar
      </Button>
    </fieldset>
  )
}
