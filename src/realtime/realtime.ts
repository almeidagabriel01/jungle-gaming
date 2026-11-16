import type { Query, QueryClient } from '@tanstack/react-query'
import type { io as Io, Socket } from 'socket.io-client'
import { refreshSession } from '@/api/client'
import { keys } from '@/api/keys'
import type { Cart } from '@/contracts/cart'
import { RealtimeEvent, type NftUpdatedEvent, type OrderUpdatedEvent } from '@/contracts/events'
import type { Nft, NftList } from '@/contracts/nft'
import type { Order } from '@/contracts/order'
import { announce } from '@/lib/announcer'
import { eth, formatEth } from '@/lib/money'
import { submitOrderKey } from '@/queries/orders'
import { ownerKey, sessionStore } from '@/session/store'

/**
 * Cliente de tempo real. Um socket por sessão (token no handshake); trocar de usuário
 * derruba o socket anterior e seus listeners. Um evento só é aplicado se avança a versão do
 * recurso: essa mesma decisão atualiza o cache e libera os avisos, então evento repetido ou
 * antigo (com qualquer `eventId` ou `occurredAt`) não muda nada nem é anunciado. As versões
 * sobrevivem à reconexão da mesma sessão e recomeçam na troca de usuário. Em toda conexão os
 * recursos são reconciliados com a API REST (na primeira, só os buscados antes dela).
 */

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

/** Nova tentativa de carregar o cliente quando o chunk falha (rede caiu), como o reconnect do socket.io. */
const LOAD_RETRY_MS = 5_000
/** Última versão aplicada por recurso (o `eventId` é redundante: o mesmo evento tem a mesma versão). */
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

/** true se o evento avança a versão do recurso; é a única porta para cache e avisos. */
export function shouldApply(event: RealtimeEvent): boolean {
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

/**
 * Unidades da edição reservadas pela própria sessão (pedidos pendentes no cache). `null` enquanto um
 * pedido está sendo enviado: a reserva acontece no servidor antes da resposta, então qualquer queda
 * de estoque nesse intervalo pode ser a do próprio comprador.
 */
function reservedByMe(qc: QueryClient, editionId: string): number | null {
  const userId = sessionStore.userId()
  if (!userId) return 0
  if (qc.isMutating({ mutationKey: submitOrderKey(userId) }) > 0) return null
  const pending = new Map<string, Order>()
  for (const [, data] of qc.getQueriesData<Order | { items: Order[] }>({ queryKey: keys.orders(userId) })) {
    for (const order of data && 'items' in data ? data.items : data ? [data] : []) if (order.status === 'pending') pending.set(order.id, order)
  }
  let reserved = 0
  for (const order of pending.values()) for (const line of order.lines) if (line.editionId === editionId) reserved += line.quantity
  return reserved
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
    // A reserva do próprio pedido não é falta de estoque para quem está comprando.
    const reserved = reservedByMe(qc, item.editionId)
    if (reserved !== null && edition.available + reserved < item.quantity) {
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
  // O evento só traz o estado; o recibo completo (hash, links) vem da API. `confirmed` só aparece
  // completo: até o refetch o pedido segue pendente, sem recibo pela metade.
  if (next !== 'confirmed') {
    qc.setQueryData<Order>(keys.order(userId, orderId), (order) =>
      order && order.version < event.version ? { ...order, status: next, failureReason, version: event.version } : order,
    )
  }
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

/**
 * Revalida pela API os recursos que podem ter perdido eventos. Sem `since` (reconexão), tudo, cancelando
 * o que estiver em voo. Com `since` (primeira conexão), só o que foi buscado antes desse instante, e a
 * request em voo não é cancelada: a resposta dela vale como a busca (ponytail: se o servidor a montou
 * antes de um evento perdido, fica velha até o próximo evento; cancelar dobraria a carga de toda abertura).
 */
function reconcile(qc: QueryClient, since?: number) {
  const userId = sessionStore.userId()
  const filters = since === undefined ? {} : { predicate: (q: Query) => q.state.dataUpdatedAt < since }
  const options = { cancelRefetch: since === undefined }
  void qc.invalidateQueries({ queryKey: keys.nfts, ...filters }, options)
  void qc.invalidateQueries({ queryKey: keys.cart(ownerKey()), ...filters }, options)
  void qc.invalidateQueries({ queryKey: keys.quoteAll, ...filters }, options)
  if (userId) void qc.invalidateQueries({ queryKey: keys.orders(userId), ...filters }, options)
}

/** `resumed`: substitui um socket anterior; eventos perdidos na troca são reconciliados na conexão. */
function connect(io: typeof Io, qc: QueryClient, resumed: boolean): Socket {
  const socket = io({
    path: '/socket.io',
    transports: ['websocket'],
    // Lido a cada (re)conexão: o handshake leva sempre o token vigente, nunca o da primeira conexão.
    auth: (cb) => {
      const token = sessionStore.get()?.tokens.accessToken
      cb(token ? { token } : {})
    },
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
    // Reconexão: tudo pode ter perdido eventos. Primeira conexão: só o que foi buscado antes dela.
    reconcile(qc, wasConnected ? undefined : Date.now())
    wasConnected = true
  })
  socket.on('disconnect', () => {
    setStatus('disconnected')
  })
  socket.io.on('reconnect_attempt', () => {
    setStatus('connecting')
    // Access vencido: renova pelo mesmo caminho do REST; a sessão nova reabre o socket com o token novo.
    const tokens = sessionStore.get()?.tokens
    if (tokens && Date.parse(tokens.expiresAt) <= Date.now()) void refreshSession()
  })
  setStatus('connecting')
  return socket
}

/** Inicia o tempo real e o mantém alinhado à sessão. Devolve a função de encerramento. */
export function startRealtime(qc: QueryClient): () => void {
  let socket: Socket | null = null
  let stopped = false
  // Cada abertura invalida as anteriores ainda pendentes (troca de sessão durante o carregamento).
  let generation = 0
  const close = () => {
    if (!socket) return
    socket.removeAllListeners()
    socket.io.removeAllListeners()
    socket.disconnect()
    socket = null
  }
  // Cliente carregado sob demanda, fora do chunk do primeiro render. O app só monta depois do worker
  // do MSW (main.tsx), então o engine.io já captura o WebSocket interceptado ao avaliar o módulo.
  const open = async (resumed: boolean, current: number) => {
    setStatus('connecting')
    const { io } = await import('socket.io-client')
    if (stopped || current !== generation) return
    close()
    socket = connect(io, qc, resumed)
  }
  let retry: ReturnType<typeof setTimeout> | undefined
  const start = (resumed: boolean) => {
    clearTimeout(retry)
    const current = ++generation
    open(resumed, current).catch(() => {
      if (stopped || current !== generation) return
      setStatus('disconnected')
      retry = setTimeout(() => start(resumed), LOAD_RETRY_MS)
    })
  }
  start(false)
  const unsubscribe = sessionStore.subscribe((next, prev) => {
    // O servidor resolve o usuário no handshake: token novo (login, troca, refresh) exige nova conexão.
    if (next?.tokens.accessToken === prev?.tokens.accessToken) return
    // Outra sessão: as versões vistas pela anterior não valem para ela.
    if (next?.user.id !== prev?.user.id) versions.clear()
    close()
    start(true)
  })
  return () => {
    stopped = true
    clearTimeout(retry)
    unsubscribe()
    close()
    setStatus('disconnected')
  }
}
