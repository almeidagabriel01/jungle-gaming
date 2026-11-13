import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Eth } from '@/contracts/common'
import { Network } from '@/contracts/common'
import { Category, NFT_SEARCH_DEFAULTS, NftSearch, NftSort, NftTab, type Nft, type NftFacets } from '@/contracts/nft'
import { CATEGORY_LABEL, NETWORK_LABEL, SORT_LABEL, TAB_LABEL } from '@/lib/labels'
import { formValues } from '@/lib/forms'
import { eth, formatEth } from '@/lib/money'
import { useFeaturedNfts, useNftList } from '@/queries/catalog'

export const Route = createFileRoute('/')({
  validateSearch: NftSearch,
  search: { middlewares: [stripSearchParams(NFT_SEARCH_DEFAULTS)] },
  component: CatalogPage,
})

function CatalogPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const list = useNftList(search)

  /** Qualquer mudança de filtro reinicia a paginação; só a paginação preserva a página. */
  const update = useCallback(
    (patch: Partial<NftSearch>) => void navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) }),
    [navigate],
  )

  // Página além do fim (link antigo ou filtro que encolheu o resultado): vai para a última.
  const lastPage = list.data && list.data.items.length === 0 && list.data.total > 0 ? list.data.totalPages : null
  useEffect(() => {
    if (lastPage) void navigate({ search: (prev) => ({ ...prev, page: lastPage }), replace: true })
  }, [lastPage, navigate])

  return (
    <div className="grid gap-8">
      <Featured />

      <section aria-labelledby="catalog-title" className="grid gap-4">
        <h1 id="catalog-title" className="text-2xl font-semibold">
          Catálogo
        </h1>
        <Filters search={search} facets={list.data?.facets} onChange={update} />

        <div aria-live="polite" className="text-sm text-muted-foreground" data-testid="catalog-summary">
          {list.data && `${list.data.total} ${list.data.total === 1 ? 'resultado' : 'resultados'}`}
          {list.isFetching && list.data ? ' · atualizando…' : ''}
        </div>

        {list.isPending ? (
          <GridSkeleton />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => void list.refetch()} title="Não foi possível carregar o catálogo" />
        ) : list.data.total === 0 ? (
          <div className="grid justify-items-start gap-3 rounded-lg border p-6">
            <p>Nenhum NFT encontrado com esses filtros.</p>
            <Button variant="outline" onClick={() => void navigate({ search: NFT_SEARCH_DEFAULTS })}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={list.isFetching} data-testid="catalog-grid">
              {list.data.items.map((nft) => (
                <li key={nft.id}>
                  <NftCard nft={nft} />
                </li>
              ))}
            </ul>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={(page) => update({ page })} />
          </>
        )}
      </section>
    </div>
  )
}

function Featured() {
  const featured = useFeaturedNfts()
  return (
    <section aria-labelledby="featured-title" className="grid gap-3">
      <h2 id="featured-title" className="text-xl font-semibold">
        Destaques
      </h2>
      {featured.isPending ? (
        <GridSkeleton count={4} />
      ) : featured.isError ? (
        <QueryError error={featured.error} onRetry={() => void featured.refetch()} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.data.items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NftCard({ nft }: { nft: Nft }) {
  // Preço anterior da edição que define o "a partir de" (riscado no layout).
  const compareAt = nft.editions.find((e) => eth.eq(e.price, nft.minPrice) && e.compareAtPrice)?.compareAtPrice
  return (
    <article className="grid gap-2 rounded-lg border p-3">
      <img src={nft.images[0]!.thumbnailUrl} alt={nft.images[0]!.alt} width={480} height={480} loading="lazy" decoding="async" className="aspect-square w-full rounded-md object-cover" />
      <h3 className="font-medium">
        <Link to="/nfts/$nftId" params={{ nftId: nft.id }} className="hover:underline">
          {nft.name}
        </Link>
      </h3>
      <p className="text-sm text-muted-foreground">{nft.collection.name}</p>
      <p className="tabular-nums" data-testid="nft-price">
        A partir de {formatEth(nft.minPrice)}
        {compareAt && <s className="ml-2 text-sm text-muted-foreground">{formatEth(compareAt)}</s>}
      </p>
      <p className="text-sm">{nft.available > 0 ? `${nft.available} disponíveis` : 'Esgotado'}</p>
    </article>
  )
}

function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando NFTs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ))}
    </div>
  )
}

function Filters({ search, facets, onChange }: { search: NftSearch; facets: NftFacets | undefined; onChange: (patch: Partial<NftSearch>) => void }) {
  const [term, setTerm] = useState(search.q)
  const [syncedQ, setSyncedQ] = useState(search.q)
  const [priceError, setPriceError] = useState<string | null>(null)

  // URL → campo: voltar/avançar no histórico atualiza o texto (ajuste durante o render, sem efeito).
  if (search.q !== syncedQ) {
    setSyncedQ(search.q)
    setTerm(search.q)
  }
  // Campo → URL com debounce.
  useEffect(() => {
    if (term.trim() === search.q) return
    const id = setTimeout(() => {
      onChange({ q: term.trim() })
    }, 300)
    return () => {
      clearTimeout(id)
    }
  }, [term, search.q, onChange])

  const applyPrice = (form: HTMLFormElement) => {
    const data = formValues(form)
    const read = (name: string) => {
      const value = (data[name] ?? '').trim().replace(',', '.')
      return value === '' ? undefined : value
    }
    const minPrice = read('minPrice')
    const maxPrice = read('maxPrice')
    if ((minPrice && !Eth.safeParse(minPrice).success) || (maxPrice && !Eth.safeParse(maxPrice).success)) {
      setPriceError('Use valores em ETH, ex.: 0.5')
      return
    }
    setPriceError(null)
    onChange({ minPrice, maxPrice })
  }

  return (
    <div className="grid gap-4 rounded-lg border p-4" role="search">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Buscar</span>
        <input
          type="search"
          name="q"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
          }}
          placeholder="Nome, coleção ou criador"
          className="h-9 rounded-md border px-3"
        />
      </label>

      <div role="group" aria-label="Lista" className="flex flex-wrap gap-2">
        {NftTab.options.map((tab) => (
          <Button
            key={tab}
            variant={search.tab === tab ? 'default' : 'outline'}
            aria-pressed={search.tab === tab}
            onClick={() => {
              onChange({ tab })
            }}
          >
            {TAB_LABEL[tab]}
          </Button>
        ))}
      </div>

      <CheckboxGroup
        legend="Coleções"
        options={Category.options}
        selected={search.categories}
        label={(c) => CATEGORY_LABEL[c]}
        count={(c) => facets?.categories[c]}
        onChange={(categories) => {
          onChange({ categories })
        }}
      />
      <CheckboxGroup
        legend="Rede"
        options={Network.options}
        selected={search.networks}
        label={(n) => NETWORK_LABEL[n]}
        count={(n) => facets?.networks[n]}
        onChange={(networks) => {
          onChange({ networks })
        }}
      />

      <label className="grid max-w-xs gap-1.5 text-sm">
        <span className="font-medium">Ordenar por</span>
        <select
          value={search.sort}
          onChange={(e) => {
            onChange({ sort: e.target.value as NftSort })
          }}
          className="h-9 rounded-md border px-2"
        >
          {NftSort.options.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABEL[sort]}
            </option>
          ))}
        </select>
      </label>

      <form
        className="flex flex-wrap items-end gap-3"
        aria-describedby={priceError ? 'price-error' : undefined}
        onSubmit={(e) => {
          e.preventDefault()
          applyPrice(e.currentTarget)
        }}
        key={`${search.minPrice ?? ''}-${search.maxPrice ?? ''}`}
      >
        <p className="w-full text-sm font-medium">
          Faixa de preço{facets?.price && <span className="font-normal"> · {formatEth(facets.price.min)} a {formatEth(facets.price.max)}</span>}
        </p>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Preço mínimo (ETH)</span>
          <input name="minPrice" inputMode="decimal" defaultValue={search.minPrice ?? ''} aria-invalid={priceError ? true : undefined} className="h-9 w-32 rounded-md border px-2" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Preço máximo (ETH)</span>
          <input name="maxPrice" inputMode="decimal" defaultValue={search.maxPrice ?? ''} aria-invalid={priceError ? true : undefined} className="h-9 w-32 rounded-md border px-2" />
        </label>
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
        {priceError && (
          <p id="price-error" className="w-full text-sm text-destructive">
            {priceError}
          </p>
        )}
      </form>
    </div>
  )
}

/** Grupo de filtros multisseleção; a contagem vem da API (facets), já considerando os outros filtros. */
function CheckboxGroup<T extends string>({
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
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(e) => {
                onChange(e.target.checked ? [...selected, option] : selected.filter((o) => o !== option))
              }}
            />
            {label(option)}
            {count(option) !== undefined && <span className="text-muted-foreground tabular-nums">({count(option)})</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="flex items-center gap-3">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span aria-current="page" className="text-sm tabular-nums">
        Página {page} de {totalPages}
      </span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Próxima
      </Button>
    </nav>
  )
}
