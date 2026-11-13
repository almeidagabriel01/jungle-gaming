import { http, HttpResponse } from 'msw'
import { NftSearch, PAGE_SIZE, type Nft } from '@/contracts/nft'
import { eth } from '@/lib/money'
import { findNft, toNft, withDb, type Tx } from '../db'
import { hasScenario } from '../scenarios'
import { API, apiError, authenticate, route } from './http'

/** Converte a query string da API (categorias separadas por vírgula) no schema compartilhado. */
export function parseSearch(url: URL) {
  const p = url.searchParams
  return NftSearch.parse({
    q: p.get('q') ?? undefined,
    categories: p.get('categories')?.split(',').filter(Boolean),
    collection: p.get('collection') ?? undefined,
    minPrice: p.get('minPrice') ?? undefined,
    maxPrice: p.get('maxPrice') ?? undefined,
    availability: p.get('availability') ?? undefined,
    sort: p.get('sort') ?? undefined,
    page: p.get('page') ?? undefined,
  })
}

const sorters: Record<NftSearch['sort'], (a: Nft, b: Nft) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'price-asc': (a, b) => eth.cmp(a.minPrice, b.minPrice) || a.id.localeCompare(b.id),
  'price-desc': (a, b) => eth.cmp(b.minPrice, a.minPrice) || a.id.localeCompare(b.id),
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

function search(tx: Tx, s: NftSearch) {
  const term = s.q.toLowerCase()
  const all = hasScenario('empty') ? [] : tx.db.nfts.map(toNft)
  const filtered = all.filter(
    (n) =>
      (!term || `${n.name} ${n.collection.name} ${n.creator.name}`.toLowerCase().includes(term)) &&
      (s.categories.length === 0 || s.categories.includes(n.category)) &&
      (!s.collection || n.collection.id === s.collection) &&
      (s.minPrice === undefined || eth.cmp(n.minPrice, s.minPrice) >= 0) &&
      (s.maxPrice === undefined || eth.cmp(n.minPrice, s.maxPrice) <= 0) &&
      (s.availability === 'all' || (s.availability === 'available' ? n.available > 0 : n.available === 0)),
  )
  filtered.sort(sorters[s.sort])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const collections = [...new Map(tx.db.nfts.map((n) => [n.collection.id, n.collection])).values()]
  return {
    items: filtered.slice((s.page - 1) * PAGE_SIZE, s.page * PAGE_SIZE),
    page: s.page,
    pageSize: PAGE_SIZE,
    total: filtered.length,
    totalPages,
    collections,
  }
}

const favoritesOf = (tx: Tx, userId: string) => ({
  items: (tx.db.favorites[userId] ?? []).flatMap((id) => {
    const nft = findNft(tx.db, id)
    return nft ? [toNft(nft)] : []
  }),
})

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    route(({ request }) => withDb((tx) => HttpResponse.json(search(tx, parseSearch(new URL(request.url)))))),
  ),

  http.get(
    `${API}/nfts/featured`,
    route(() => withDb(({ db }) => HttpResponse.json({ items: hasScenario('empty') ? [] : db.nfts.filter((n) => n.featured).map(toNft) }))),
  ),

  http.get<{ id: string }>(
    `${API}/nfts/:id`,
    route(({ params }) =>
      withDb(({ db }) => {
        const nft = findNft(db, params.id)
        return nft ? HttpResponse.json(toNft(nft)) : apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado')
      }),
    ),
  ),

  http.get(
    `${API}/me/favorites`,
    route(({ request }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        return auth.ok ? HttpResponse.json(favoritesOf(tx, auth.value)) : auth.response
      }),
    ),
  ),

  ...(['put', 'delete'] as const).map((method) =>
    http[method]<{ nftId: string }>(
      `${API}/me/favorites/:nftId`,
      route(({ request, params }) =>
        withDb((tx) => {
          const auth = authenticate(tx, request)
          if (!auth.ok) return auth.response
          if (hasScenario('favorite-fails')) return apiError(500, 'SERVICE_UNAVAILABLE', 'Não foi possível atualizar os favoritos')
          if (!findNft(tx.db, params.nftId)) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado')
          const current = new Set(tx.db.favorites[auth.value] ?? [])
          if (method === 'put') current.add(params.nftId)
          else current.delete(params.nftId)
          tx.db.favorites[auth.value] = [...current]
          return HttpResponse.json(favoritesOf(tx, auth.value))
        }),
      ),
    ),
  ),
]
