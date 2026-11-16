import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/contracts/events'
import type { Nft } from '@/contracts/nft'
import type { Order } from '@/contracts/order'

/**
 * Ordem dos eventos de tempo real, sem dependência de sessão, socket ou cache: só a versão do recurso
 * decide. Evento repetido ou antigo (com qualquer `eventId` ou `occurredAt`) nunca passa.
 */
export function createVersionGate() {
  /** Última versão aplicada por recurso (o `eventId` é redundante: o mesmo evento tem a mesma versão). */
  const versions = new Map<string, number>()
  return {
    /** true se o evento avança a versão do recurso; é a única porta para cache e avisos. */
    shouldApply(event: RealtimeEvent): boolean {
      const key = `${event.resource.type}:${event.resource.id}`
      if ((versions.get(key) ?? 0) >= event.version) return false
      versions.set(key, event.version)
      return true
    },
    clear: () => {
      versions.clear()
    },
  }
}

/** Aplica o evento ao NFT só se for dele e mais novo que o que está no cache. */
export const patchNft = (nft: Nft, event: NftUpdatedEvent): Nft => {
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

/** Aplica o estado do evento ao pedido em cache só se for mais novo. */
export const patchOrder = (order: Order, event: OrderUpdatedEvent): Order =>
  order.version < event.version ? { ...order, status: event.payload.status, failureReason: event.payload.failureReason, version: event.version } : order
