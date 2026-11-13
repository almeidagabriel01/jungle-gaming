import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { keys } from '@/api/keys'
import type { CreateOrderBody, Order } from '@/contracts/order'
import { useUser } from '@/session/session'

/** Fallback de sincronização enquanto o pedido está pendente (o principal é `order.updated`). */
const PENDING_POLL_MS = 5_000

export const useOrder = (orderId: string) => {
  const userId = useUser()?.id ?? 'anonymous'
  return useQuery({
    queryKey: keys.order(userId, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, signal),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
  })
}

/* ---------------------------------------------------------------------------
 * Tentativa de pedido idempotente. A chave e o corpo são gravados ANTES do envio
 * (sessionStorage, por usuário). Reenvio — clique repetido, timeout, refresh — usa
 * exatamente a mesma chave e o mesmo corpo, então o servidor devolve o mesmo pedido.
 * A tentativa só é descartada com resposta definitiva (pedido ou erro 4xx).
 * ------------------------------------------------------------------------- */

export type OrderAttempt = { key: string; body: CreateOrderBody }

const attemptKey = (userId: string) => `jungle-order-attempt:${userId}`

export const orderAttempt = {
  load(userId: string): OrderAttempt | null {
    try {
      return JSON.parse(sessionStorage.getItem(attemptKey(userId)) ?? 'null') as OrderAttempt | null
    } catch {
      return null
    }
  },
  /** Reaproveita a tentativa pendente se o corpo é o mesmo; senão abre uma nova. */
  begin(userId: string, body: CreateOrderBody): OrderAttempt {
    const current = this.load(userId)
    const attempt = current && JSON.stringify(current.body) === JSON.stringify(body) ? current : { key: crypto.randomUUID(), body }
    sessionStorage.setItem(attemptKey(userId), JSON.stringify(attempt))
    return attempt
  },
  clear(userId: string) {
    sessionStorage.removeItem(attemptKey(userId))
  },
}

export function useSubmitOrder() {
  const qc = useQueryClient()
  const userId = useUser()?.id
  return useMutation({
    // Uma tentativa em voo por vez: cliques repetidos caem no mesmo mutation key.
    mutationKey: ['submit-order', userId],
    mutationFn: (attempt: OrderAttempt) => api.orders.create(attempt.body, attempt.key),
    onSuccess: (order: Order) => {
      if (!userId) return
      orderAttempt.clear(userId)
      qc.setQueryData(keys.order(userId, order.id), order)
      void qc.invalidateQueries({ queryKey: keys.orders(userId) })
    },
    onError: (error) => {
      // Resposta definitiva do servidor: a tentativa acabou. Rede/timeout/5xx: mantém para reenviar igual.
      // 401 também mantém: um timeout anterior pode ter criado o pedido, e o reenvio após novo
      // login precisa usar a mesma chave para recuperá-lo.
      const definitive = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401
      if (userId && definitive) orderAttempt.clear(userId)
    },
  })
}
