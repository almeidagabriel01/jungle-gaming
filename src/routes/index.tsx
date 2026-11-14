import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CatalogFilters } from '@/components/home/catalog-filters'
import { CATALOG_PANEL_ID, tabId } from '@/components/home/catalog-ids'
import { CatalogTabs, Pagination, SortSelect } from '@/components/home/catalog-toolbar'
import { Journal, PromoBanners } from '@/components/home/editorial'
import { FeaturedOffer } from '@/components/home/featured-offer'
import { HeroDesktop, HeroMobile } from '@/components/home/hero'
import { FilterIcon, SearchFieldIcon } from '@/components/icons/shell-icons'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { NFT_SEARCH_DEFAULTS, NftSearch, PAGE_SIZE } from '@/contracts/nft'
import { useMediaQuery, WIDE_QUERY } from '@/lib/use-media-query'
import { useNftList } from '@/queries/catalog'

export const Route = createFileRoute('/')({
  validateSearch: NftSearch,
  search: { middlewares: [stripSearchParams(NFT_SEARCH_DEFAULTS)] },
  component: HomePage,
})

/**
 * Frame "Desktop / Início" (seções Top, Products, Promos, Blog com gap 96) e "Mobile / Início".
 * Desktop (≥ lg) e mobile têm estruturas diferentes; o media query monta só uma (sem rótulos duplicados).
 * No tablet vale a estrutura mobile com os cards do desktop.
 */
function HomePage() {
  const desktop = useMediaQuery(WIDE_QUERY)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const list = useNftList(search)

  /** Qualquer mudança de filtro reinicia a paginação; só a paginação preserva a página. */
  const update = useCallback(
    (patch: Partial<NftSearch>) => void navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }), hash: 'mercado' }),
    [navigate],
  )

  // Página além do fim (link antigo ou filtro que encolheu o resultado): vai para a última.
  const lastPage = list.data && list.data.items.length === 0 && list.data.total > 0 ? list.data.totalPages : null
  useEffect(() => {
    if (lastPage) void navigate({ search: (prev) => ({ ...prev, page: lastPage }), replace: true })
  }, [lastPage, navigate])

  const results = (
    <div
      id={CATALOG_PANEL_ID}
      role="tabpanel"
      aria-labelledby={tabId(search.tab)}
      aria-busy={list.isFetching}
      data-testid="catalog-grid"
      className="grid gap-[88px] max-md:gap-10"
    >
      <p aria-live="polite" className="sr-only" data-testid="catalog-summary">
        {list.data && `${list.data.total} ${list.data.total === 1 ? 'resultado' : 'resultados'}`}
        {list.isFetching && list.data ? ' · atualizando…' : ''}
      </p>
      {list.isPending ? (
        <ul aria-label="Carregando NFTs" className={GRID}>
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} title="Não foi possível carregar o catálogo" />
      ) : list.data.total === 0 ? (
        <div className="grid justify-items-start gap-4 bg-card p-5">
          <p className="text-lg leading-6 font-bold">Nenhum NFT encontrado</p>
          <p className="text-sm leading-6 text-muted-foreground">Ajuste a busca ou os filtros para ver outras obras.</p>
          <Button className="h-9 px-3 text-base leading-5 font-bold" onClick={() => void navigate({ search: NFT_SEARCH_DEFAULTS, hash: 'mercado' })}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <>
          <ul className={`stagger ${GRID}`}>
            {list.data.items.map((nft, i) => (
              <li key={nft.id}>
                <NftCard nft={nft} index={i} priority={i < 3} favorite={!desktop} />
              </li>
            ))}
          </ul>
          <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={(page) => update({ page })} />
        </>
      )}
    </div>
  )

  return (
    <div className="page grid gap-24 max-md:gap-12 max-md:px-6 max-md:pt-10 md:pt-8">
      {desktop ? (
        <>
          <HeroDesktop />
          <section id="mercado" aria-labelledby="mercado-title" className="grid scroll-mt-6 grid-cols-[310px_minmax(0,1fr)] items-start gap-12">
            <h2 id="mercado-title" className="sr-only">
              Mercado
            </h2>
            <aside aria-label="Filtros" className="grid gap-6">
              <CatalogFilters search={search} facets={list.data?.facets} onChange={update} />
              <FeaturedOffer />
            </aside>
            <div className="grid gap-8">
              <div data-testid="catalog-toolbar" className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 xl:h-[18px]">
                <CatalogTabs value={search.tab} onChange={(tab) => update({ tab })} />
                <SortSelect value={search.sort} onChange={(sort) => update({ sort })} />
              </div>
              {results}
            </div>
          </section>
        </>
      ) : (
        <div className="grid gap-4">
          <MobileSearch q={search.q} onChange={update} filters={<CatalogFilters search={search} facets={list.data?.facets} onChange={update} />} sort={<SortSelect value={search.sort} onChange={(sort) => update({ sort })} />} />
          <HeroMobile />
          <section id="mercado" aria-labelledby="mercado-title" className="grid scroll-mt-6 gap-4">
            <h2 id="mercado-title" className="sr-only">
              Mercado
            </h2>
            <CatalogTabs value={search.tab} onChange={(tab) => update({ tab })} className="pb-px" />
            {results}
          </section>
          <div className="mx-auto mt-8 w-full max-w-[400px]">
            <FeaturedOffer />
          </div>
        </div>
      )}
      <PromoBanners />
      <Journal />
    </div>
  )
}

/** Desktop 3 × 258 (gap 32 / 72); mobile 2 × 175 (gap 16 / 24) com a coluna direita 32 px abaixo. */
const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 max-md:pb-8 max-md:[&>li:nth-child(even)]:translate-y-8 md:grid-cols-3 md:gap-x-8 md:gap-y-[72px]'

/** Barra "Explorar coleções" + botão de filtros do frame mobile (313×45 r10 e 45×45 r14). */
function MobileSearch({
  q,
  onChange,
  filters,
  sort,
}: {
  q: string
  onChange: (patch: Partial<NftSearch>) => void
  filters: ReactNode
  sort: ReactNode
}) {
  const [term, setTerm] = useState(q)
  const [synced, setSynced] = useState(q)
  // URL → campo: voltar/avançar no histórico atualiza o texto (ajuste durante o render, sem efeito).
  if (q !== synced) {
    setSynced(q)
    setTerm(q)
  }
  // Campo → URL com debounce.
  useEffect(() => {
    if (term.trim() === q) return
    const id = setTimeout(() => {
      onChange({ q: term.trim() })
    }, 300)
    return () => {
      clearTimeout(id)
    }
  }, [term, q, onChange])

  return (
    <div className="flex gap-2" role="search">
      <label className="flex h-[45px] min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-card px-3 has-focus-visible:outline-2 has-focus-visible:outline-ring">
        <SearchFieldIcon className="size-[22px] shrink-0 text-subtle" />
        <span className="sr-only">Buscar NFTs</span>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Explorar coleções"
          className="min-w-0 flex-1 bg-transparent text-sm leading-4 font-bold text-foreground outline-none placeholder:text-subtle"
        />
      </label>
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Filtros e ordenação"
            className="grid size-[45px] shrink-0 cursor-pointer place-items-center rounded-[14px] bg-linear-to-b from-primary/45 to-primary text-primary-foreground transition-transform active:scale-95"
          >
            <FilterIcon className="size-[22px]" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-5 overflow-y-auto rounded-t-[20px] border-border bg-background p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetTitle className="text-lg leading-4 font-bold">Filtros</SheetTitle>
          <SheetDescription className="sr-only">Coleções, faixa de preço, rede e ordenação do catálogo.</SheetDescription>
          {sort}
          {filters}
        </SheetContent>
      </Sheet>
    </div>
  )
}
