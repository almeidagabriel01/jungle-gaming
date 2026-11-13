import { z } from 'zod'
import { Eth, Id, IsoDate } from './common'
import { OrderStatus } from './order'

const envelope = {
  /** Identidade estável do evento (deduplicação). */
  eventId: Id,
  version: z.int().min(1),
  occurredAt: IsoDate,
}

export const NftUpdatedEvent = z.object({
  ...envelope,
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: Id }),
  payload: z.object({
    nftId: Id,
    minPrice: Eth,
    available: z.int().min(0),
    editions: z.array(z.object({ id: Id, price: Eth, available: z.int().min(0) })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = z.object({
  ...envelope,
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: Id }),
  payload: z.object({
    orderId: Id,
    userId: Id,
    status: OrderStatus,
    failureReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export const RealtimeEvent = z.discriminatedUnion('type', [NftUpdatedEvent, OrderUpdatedEvent])
export type RealtimeEvent = z.infer<typeof RealtimeEvent>
