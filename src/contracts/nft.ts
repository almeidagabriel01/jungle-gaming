import { z } from 'zod'
import { Eth, Id, IsoDate, paginated } from './common'

export const Category = z.enum(['art', 'gaming', 'music', 'photography', 'collectibles', 'sports'])
export type Category = z.infer<typeof Category>

export const Edition = z.object({
  id: Id,
  name: z.string(),
  price: Eth,
  supply: z.int().min(1),
  available: z.int().min(0),
})
export type Edition = z.infer<typeof Edition>

export const NftImage = z.object({ url: z.string(), alt: z.string() })

export const Nft = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  category: Category,
  collection: z.object({ id: Id, name: z.string() }),
  creator: z.object({ name: z.string(), avatarUrl: z.string() }),
  images: z.array(NftImage).min(1),
  editions: z.array(Edition).min(1),
  /** Menor preço entre as edições com disponibilidade (ou entre todas, se esgotado). */
  minPrice: Eth,
  available: z.int().min(0),
  featured: z.boolean(),
  createdAt: IsoDate,
  /** Versão monotônica do recurso; a mesma que viaja em `nft.updated`. */
  version: z.int().min(1),
})
export type Nft = z.infer<typeof Nft>

export const NftSort = z.enum(['recent', 'price-asc', 'price-desc', 'name'])
export type NftSort = z.infer<typeof NftSort>

export const Availability = z.enum(['all', 'available', 'sold-out'])

export const PAGE_SIZE = 12

/**
 * Parâmetros do catálogo. O mesmo schema valida a URL (TanStack Router) e a query da API (MSW),
 * com fallback para o default em qualquer valor inválido.
 */
export const NftSearch = z.object({
  q: z.string().trim().max(80).catch(''),
  categories: z.array(Category).catch([]),
  collection: z.string().catch(''),
  minPrice: Eth.optional().catch(undefined),
  maxPrice: Eth.optional().catch(undefined),
  availability: Availability.catch('all'),
  sort: NftSort.catch('recent'),
  page: z.coerce.number().int().min(1).catch(1),
})
export type NftSearch = z.infer<typeof NftSearch>

export const NFT_SEARCH_DEFAULTS: NftSearch = {
  q: '',
  categories: [],
  collection: '',
  minPrice: undefined,
  maxPrice: undefined,
  availability: 'all',
  sort: 'recent',
  page: 1,
}

export const NftList = paginated(Nft).extend({
  collections: z.array(z.object({ id: Id, name: z.string() })),
})
export type NftList = z.infer<typeof NftList>

export const Favorites = z.object({ items: z.array(Nft) })
export type Favorites = z.infer<typeof Favorites>
