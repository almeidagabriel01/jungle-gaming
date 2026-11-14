import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from 'cn'
import type { Nft } from '@/contracts/nft'
import { NftCard, NftCardSkeleton } from './nft-card'

/** Título de seção do layout: laranja 17/16, fio inferior a 12 px ("Mais desta coleção"). */
export function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="border-b border-primary/30 pb-3 text-[17px] leading-4 font-bold text-accent-text">
      {children}
    </h2>
  )
}

/**
 * Carrossel horizontal (scroll-snap nativo: toque, trackpad e teclado) com os pontos de página
 * do layout. Os pontos são derivados da largura real, então funcionam em qualquer viewport.
 */
export function NftRail({ title, items, loading = false }: { title: string; items: Nft[] | undefined; loading?: boolean }) {
  const headingId = useId()
  const scroller = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const total = Math.max(1, Math.round(el.scrollWidth / el.clientWidth))
    setPages(total)
    setPage(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)))
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [measure, items])

  if (!loading && items?.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="grid gap-8">
      <SectionHeading id={headingId}>{title}</SectionHeading>
      <ul
        ref={scroller}
        onScroll={measure}
        tabIndex={0}
        aria-label={title}
        // Respiro de 4/8 px para o anel de foco dos cards, compensado na margem (não altera o espaçamento do layout).
        className="-mx-1 -mb-2 flex snap-x snap-mandatory scroll-px-1 gap-6 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] lg:gap-[26px] [&::-webkit-scrollbar]:hidden"
      >
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[calc(50%-12px)] shrink-0 snap-start md:w-[calc(33.333%-16px)] lg:w-[calc(20%-20.8px)]">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((nft, i) => (
              <li key={nft.id} className="w-[calc(50%-12px)] shrink-0 snap-start md:w-[calc(33.333%-16px)] lg:w-[calc(20%-20.8px)]">
                <NftCard nft={nft} index={i} compact />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        // Pontos de 12 px como no layout; o alvo de 24 px (WCAG 2.5.8) transborda para os espaços vizinhos.
        <div className="-my-1.5 flex justify-center gap-1">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${title}: página ${i + 1} de ${pages}`}
              aria-current={i === page ? 'true' : undefined}
              onClick={() => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth })}
              className="group grid size-6 cursor-pointer place-items-center"
            >
              <span
                className={cn(
                  'size-3 rounded-full border border-primary transition-[background-color,transform] duration-300',
                  i === page ? 'scale-110 bg-primary' : 'group-hover:bg-primary/40',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
