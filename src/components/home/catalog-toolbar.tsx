import { CloseIcon } from '@/components/icons/auth-icons'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons/shell-icons'
import { useRef, type KeyboardEvent } from 'react'
import { cn } from 'cn'
import { NftSort, NftTab } from '@/contracts/nft'
import { SORT_LABEL, TAB_LABEL } from '@/lib/labels'
import { CATALOG_PANEL_ID, tabId } from './catalog-ids'

/**
 * Busca ativa no desktop. No mobile o campo do catálogo já mostra o termo e o limpa; no desktop a busca é um
 * diálogo, então a lista diz qual termo a filtra e oferece limpar.
 */
export function ActiveSearch({ q, onClear }: { q: string; onClear: () => void }) {
  return (
    <div data-testid="active-search" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm leading-4">
      <p className="text-muted-foreground">
        Resultados para <span className="font-bold text-foreground">“{q}”</span>
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-sm font-bold text-accent-text transition-colors hover:text-foreground"
      >
        <CloseIcon className="size-4" />
        Limpar busca
      </button>
    </div>
  )
}

/** Abas "Todos os NFTs / Novos lançamentos / Em alta" (tablist: setas, Home e End trocam a aba). */
export function CatalogTabs({ value, onChange, className }: { value: NftTab; onChange: (tab: NftTab) => void; className?: string }) {
  const refs = useRef<Partial<Record<NftTab, HTMLButtonElement | null>>>({})
  const tabs = NftTab.options
  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.indexOf(value)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const tab = tabs[(next + tabs.length) % tabs.length]!
    onChange(tab)
    refs.current[tab]?.focus()
  }
  return (
    <div role="tablist" aria-label="Lista do catálogo" className={cn('flex gap-4 overflow-x-auto [scrollbar-width:none] max-md:[&>:first-child]:-mr-3 md:gap-5', className)} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab === value
        return (
          <button
            key={tab}
            ref={(el) => {
              refs.current[tab] = el
            }}
            id={tabId(tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={CATALOG_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              'relative shrink-0 cursor-pointer pb-1 text-sm leading-4 whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:bg-primary after:transition-transform after:duration-300 md:pb-[7px] md:text-[15px] md:font-medium',
              selected ? 'font-bold text-accent-text after:scale-x-100' : 'text-foreground after:scale-x-0 hover:text-accent-text',
            )}
          >
            {TAB_LABEL[tab]}
          </button>
        )
      })}
    </div>
  )
}

export function SortSelect({ value, onChange }: { value: NftSort; onChange: (sort: NftSort) => void }) {
  return (
    <label className="relative flex items-center text-[15px] leading-5">
      <span>Ordenar por:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as NftSort)}
        className="cursor-pointer appearance-none rounded-sm bg-transparent pr-6 pl-px text-[15px] leading-5 text-foreground [&>option]:bg-card"
      >
        {NftSort.options.map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABEL[sort]}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-0 size-4" />
    </label>
  )
}

/** Janela de 4 páginas consecutivas em torno da atual, como o "1 2 3 4 >" do layout. */
function pageWindow(page: number, total: number): number[] {
  const start = Math.max(1, Math.min(page - 1, total - 3))
  return Array.from({ length: Math.min(4, total) }, (_, i) => start + i)
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  const box = 'grid size-[35px] cursor-pointer place-items-center rounded-md border border-border text-lg leading-4 transition-colors hover:border-primary'
  return (
    <nav aria-label="Paginação" className="flex justify-end">
      <p className="sr-only">
        Página {page} de {totalPages}
      </p>
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={box} aria-label="Anterior" onClick={() => onPage(page - 1)}>
              <ChevronLeftIcon className="size-[18px]" />
            </button>
          </li>
        )}
        {pageWindow(page, totalPages).map((p) => (
          <li key={p}>
            <button
              type="button"
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
              className={cn(box, p === page && 'border-primary bg-primary font-bold text-primary-foreground')}
            >
              {p}
            </button>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <button type="button" className={box} aria-label="Próxima" onClick={() => onPage(page + 1)}>
              <ChevronRightIcon className="size-[18px]" />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
