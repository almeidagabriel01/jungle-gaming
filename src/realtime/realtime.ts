import type { QueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { keys } from '@/api/keys'
import type { Cart } from '@/contracts/cart'
import { RealtimeEvent, type NftUpdatedEvent, type OrderUpdatedEvent } from '@/contracts/events'
import type { Nft, NftList } from '@/contracts/nft'
import type { Order } from '@/contracts/order'
import { announce } from '@/lib/announcer'
import { eth, formatEth } from '@/lib/money'
import { ownerKey, sessionStore } from '@/session/store'

/**
 * Cliente de tempo real. Um socket por sessão (token no handshake); trocar de usuário
 * derruba o socket anterior e seus listeners. Eventos são deduplicados por `eventId`,
 * ordenados por `version` e só então aplicados ao cache. Após reconexão, os recursos
 * ativos são reconciliados com a API REST.
 */

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

const SEEN_LIMIT = 500
const seen = new Set<string>()
const versions = new Map<string, number>()

let status: RealtimeStatus = 'disconnected'
const statusListeners = new Set<() => void>()
const setStatus = (next: RealtimeStatus) => {
  status = next
  for (const l of statusListeners) l()
}
export const realtimeStatus = {
  get: () => status,
  subscribe: (listener: () => void) => {
    statusListeners.add(listener)
    return () => {
      statusListeners.delete(listener)
    }
  },
}

/** true se o evento é novo e mais recente que o último aplicado ao recurso. */
export function shouldApply(event: RealtimeEvent): boolean {
  if (seen.has(event.eventId)) return false
  seen.add(event.eventId)
  if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value!)
  const key = `${event.resource.type}:${event.resource.id}`
  if ((versions.get(key) ?? 0) >= event.version) return false
  versions.set(key, event.version)
  return true
}

const patchNft = (nft: Nft, event: NftUpdatedEvent): Nft => {
  if (nft.id !== event.payload.nftId || nft.version >= event.version) return nft
  const byId = new Map(event.payload.editions.map((e) => [e.id, e]))
  return {
    ...nft,
    version: event.version,
    minPrice: event.payload.minPrice,
    available: event.payload.available,
    editions: nft.editions.map((e) => ({ ...e, ...byId.get(e.id) })),
  }
}

function applyNftUpdated(qc: QueryClient, event: NftUpdatedEvent) {
  qc.setQueryData<Nft>(keys.nft(event.payload.nftId), (nft) => nft && patchNft(nft, event))
  qc.setQueriesData<NftList>({ queryKey: [...keys.nfts, 'list'] }, (list) => list && { ...list, items: list.items.map((n) => patchNft(n, event)) })
  qc.setQueryData<{ items: Nft[] }>(keys.nftFeatured, (data) => data && { items: data.items.map((n) => patchNft(n, event)) })
  // O patch é imediato; filtro e ordenação (preço, disponibilidade) só o servidor recalcula.
  void qc.invalidateQueries({ queryKey: [...keys.nfts, 'list'] })
  const userId = sessionStore.userId()
  if (userId) void qc.invalidateQueries({ queryKey: keys.favorites(userId) })

  // Item no carrinho: avisa o que mudou e recalcula resumo/cotação pela API.
  const cart = qc.getQueryData<Cart>(keys.cart(ownerKey()))
  const affected = cart?.items.filter((i) => i.nftId === event.payload.nftId) ?? []
  if (affected.length === 0) return
  for (const item of affected) {
    const edition = event.payload.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    if (!eth.eq(edition.price, item.unitPrice)) {
      announce(`O preço de ${item.name} (${item.editionName}) mudou de ${formatEth(item.unitPrice)} para ${formatEth(edition.price)}.`, { topic: 'cart' })
    }
    if (edition.available < item.quantity) {
      announce(
        edition.available === 0
          ? `${item.name} (${item.editionName}) esgotou.`
          : `${item.name} (${item.editionName}) agora tem só ${edition.available} unidade(s).`,
        { topic: 'cart', tone: 'error' },
      )
    }
  }
  void qc.invalidateQueries({ queryKey: keys.cart(ownerKey()) })
  void qc.invalidateQueries({ queryKey: keys.quoteAll })
}

function applyOrderUpdated(qc: QueryClient, event: OrderUpdatedEvent) {
  const userId = sessionStore.userId()
  // Isolamento: evento de pedido de outra conta nunca toca o cache desta sessão.
  if (!userId || event.payload.userId !== userId) return
  const { orderId, status: next, failureReason } = event.payload
  qc.setQueryData<Order>(keys.order(userId, orderId), (order) =>
    order && order.version < event.version ? { ...order, status: next, failureReason, version: event.version } : order,
  )
  // O evento só traz o estado; o recibo completo (hash, links) vem da API.
  void qc.invalidateQueries({ queryKey: keys.orders(userId) })
  if (next === 'confirmed') void qc.invalidateQueries({ queryKey: keys.cart(ownerKey()) })
  // Na tela do próprio pedido a região viva da página já anuncia a mudança (sem aviso duplicado).
  if (window.location.pathname === `/orders/${orderId}`) return
  if (next === 'confirmed') {
    announce('Pagamento confirmado. Seu pedido foi concluído.', { topic: 'order' })
  } else if (next === 'declined') {
    announce(`Pagamento recusado${failureReason ? `: ${failureReason}` : ''}. Seus itens continuam no carrinho.`, { topic: 'order', tone: 'error' })
  }
}

function reconcile(qc: QueryClient) {
  const userId = sessionStore.userId()
  void qc.invalidateQueries({ queryKey: keys.nfts })
  void qc.invalidateQueries({ queryKey: keys.cart(ownerKey()) })
  void qc.invalidateQueries({ queryKey: keys.quoteAll })
  if (userId) void qc.invalidateQueries({ queryKey: keys.orders(userId) })
}

/** `resumed`: substitui um socket anterior; eventos perdidos na troca são reconciliados na conexão. */
function connect(qc: QueryClient, resumed = false): Socket {
  const token = sessionStore.get()?.tokens.accessToken
  const socket = io({
    path: '/socket.io',
    transports: ['websocket'],
    query: token ? { token } : {},
    reconnectionDelay: 500,
    reconnectionDelayMax: 4_000,
  })
  const sessionUser = sessionStore.userId()
  let wasConnected = resumed

  const onEvent = (raw: unknown) => {
    const parsed = RealtimeEvent.safeParse(raw)
    if (!parsed.success || !shouldApply(parsed.data)) return
    // Socket de uma sessão anterior nunca aplica nada na sessão atual.
    if (sessionStore.userId() !== sessionUser) return
    if (parsed.data.type === 'nft.updated') applyNftUpdated(qc, parsed.data)
    else applyOrderUpdated(qc, parsed.data)
  }

  socket.on('nft.updated', onEvent)
  socket.on('order.updated', onEvent)
  socket.on('connect', () => {
    setStatus('connected')
    if (wasConnected) reconcile(qc)
    wasConnected = true
  })
  socket.on('disconnect', () => {
    setStatus('disconnected')
  })
  socket.io.on('reconnect_attempt', () => setStatus('connecting'))
  setStatus('connecting')
  return socket
}

/** Inicia o tempo real e o mantém alinhado à sessão. Devolve a função de encerramento. */
export function startRealtime(qc: QueryClient): () => void {
  let socket = connect(qc)
  const unsubscribe = sessionStore.subscribe((next, prev) => {
    // O servidor resolve o usuário no handshake: token novo (login, troca, refresh) exige nova conexão.
    if (next?.tokens.accessToken === prev?.tokens.accessToken) return
    socket.removeAllListeners()
    socket.io.removeAllListeners()
    socket.disconnect()
    socket = connect(qc, true)
  })
  return () => {
    unsubscribe()
    socket.removeAllListeners()
    socket.io.removeAllListeners()
    socket.disconnect()
    setStatus('disconnected')
  }
}
