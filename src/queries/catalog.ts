import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { keys } from '@/api/keys'
import { NFT_SEARCH_DEFAULTS, type Favorites, type Nft, type NftSearch } from '@/contracts/nft'
import { announce } from '@/lib/announcer'
import { useUser } from '@/session/session'

const CATALOG_STALE_MS = 30_000

/**
 * Catálogo: a chave inclui todos os parâmetros (isolamento por consulta) e o `signal`
 * cancela a request anterior — resposta fora de ordem nunca sobrescreve a atual.
 */
export const useNftList = (search: NftSearch, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: keys.nftList(search),
    queryFn: ({ signal }) => api.nfts.list(search, signal),
    placeholderData: keepPreviousData,
    staleTime: CATALOG_STALE_MS,
    enabled,
  })

export const useFeaturedNfts = () =>
  useQuery({ queryKey: keys.nftFeatured, queryFn: ({ signal }) => api.nfts.featured(signal), staleTime: CATALOG_STALE_MS })

export const nftQuery = (nftId: string) => ({
  queryKey: keys.nft(nftId),
  queryFn: ({ signal }: { signal: AbortSignal }) => api.nfts.get(nftId, signal),
  staleTime: CATALOG_STALE_MS,
})

export const useNft = (nftId: string) => useQuery(nftQuery(nftId))

/**
 * "Mais desta coleção": a primeira página da coleção do NFT, sem ele mesmo. No detalhe o NFT já
 * está no cache; `undefined` (carrinho vazio) desliga as buscas.
 */
export function useRelatedNfts(nftId: string | undefined) {
  const anchor = useQuery({ ...nftQuery(nftId ?? ''), enabled: nftId !== undefined })
  const collection = anchor.data?.collection.id
  const list = useNftList({ ...NFT_SEARCH_DEFAULTS, collection: collection ?? '' }, { enabled: collection !== undefined })
  const isError = anchor.isError || list.isError
  return {
    items: isError ? [] : list.data?.items.filter((n) => n.id !== nftId),
    isPending: nftId !== undefined && !isError && list.isPending,
  }
}

export const useFavorites = () => {
  const user = useUser()
  return useQuery({
    queryKey: keys.favorites(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => api.favorites.list(signal),
    enabled: user !== null,
  })
}

/** Favoritar com atualização otimista: aplica na hora, desfaz se a API falhar. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const user = useUser()
  return useMutation({
    mutationFn: ({ nft, favorite }: { nft: Nft; favorite: boolean }) => (favorite ? api.favorites.add(nft.id) : api.favorites.remove(nft.id)),
    onMutate: async ({ nft, favorite }) => {
      if (!user) return undefined
      const key = keys.favorites(user.id)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Favorites>(key)
      qc.setQueryData<Favorites>(key, (data) => {
        const items = (data?.items ?? []).filter((n) => n.id !== nft.id)
        return { items: favorite ? [...items, nft] : items }
      })
      return { previous, key }
    },
    onError: (_error, { nft, favorite }, context) => {
      // Sem lista anterior em cache, remove a otimista (setQueryData com undefined não faz nada).
      if (context?.previous) qc.setQueryData(context.key, context.previous)
      else if (context) qc.removeQueries({ queryKey: context.key, exact: true })
      announce(`Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'} ${nft.name}. Tente novamente.`, { tone: 'error' })
    },
    onSuccess: (data, { nft, favorite }) => {
      if (user) qc.setQueryData(keys.favorites(user.id), data)
      announce(favorite ? `${nft.name} adicionado aos favoritos.` : `${nft.name} removido dos favoritos.`)
    },
    onSettled: () => {
      if (user) void qc.invalidateQueries({ queryKey: keys.favorites(user.id) })
    },
  })
}
