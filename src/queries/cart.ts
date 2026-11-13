import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { api } from '@/api/endpoints'
import { keys } from '@/api/keys'
import type { AddCartItemBody, Cart } from '@/contracts/cart'
import type { Network } from '@/contracts/common'
import { ownerKey, sessionStore } from '@/session/store'

const subscribe = (listener: () => void) => sessionStore.subscribe(listener)
/** Dono atual do carrinho (visitante ou usuário), reativo à sessão. */
export const useCartOwner = () => useSyncExternalStore(subscribe, ownerKey)

export const useCart = () => {
  const owner = useCartOwner()
  return useQuery({ queryKey: keys.cart(owner), queryFn: ({ signal }) => api.cart.get(signal), refetchOnWindowFocus: true })
}

/** Mutations do carrinho: a resposta da API é o novo carrinho; a cotação é recalculada. */
function useCartMutation<V>(fn: (vars: V) => Promise<Cart>) {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    scope: { id: 'cart' },
    mutationFn: fn,
    onSuccess: (cart) => {
      qc.setQueryData(keys.cart(owner), cart)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.quoteAll })
    },
  })
}

export const useAddToCart = () => useCartMutation((body: AddCartItemBody) => api.cart.add(body))
export const useUpdateCartItem = () => useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => api.cart.update(itemId, quantity))
export const useRemoveCartItem = () => useCartMutation((itemId: string) => api.cart.remove(itemId))

/** Cotação calculada pela API: fonte do subtotal, desconto, taxa e total exibidos. */
export const useQuote = ({ couponCode, network, enabled = true }: { couponCode?: string; network: Network; enabled?: boolean }) => {
  const owner = useCartOwner()
  return useQuery({
    queryKey: keys.quote(owner, couponCode, network),
    queryFn: ({ signal }) => api.quotes.create({ couponCode, network }, signal),
    enabled,
  })
}
