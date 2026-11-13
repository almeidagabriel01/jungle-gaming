import { z } from 'zod'
import { Coupon, QuoteLine } from './cart'
import { Eth, Id, IsoDate, Network } from './common'

export const OrderStatus = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof OrderStatus>

export const Buyer = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo').max(80),
  email: z.email('E-mail inválido'),
  country: z.string().trim().min(2, 'Informe o país').max(56),
})
export type Buyer = z.infer<typeof Buyer>

export const CreateOrderBody = z.object({
  quoteId: Id,
  fingerprint: z.string(),
  walletId: Id,
  network: Network,
  buyer: Buyer,
})
export type CreateOrderBody = z.infer<typeof CreateOrderBody>

/** O pedido guarda um snapshot imutável da cotação aceita (o recibo não muda com o catálogo). */
export const Order = z.object({
  id: Id,
  userId: Id,
  status: OrderStatus,
  version: z.int().min(1),
  network: Network,
  wallet: z.object({ id: Id, label: z.string(), address: z.string() }),
  buyer: Buyer,
  lines: z.array(QuoteLine),
  coupon: Coupon.nullable(),
  subtotal: Eth,
  discount: Eth,
  networkFee: Eth,
  total: Eth,
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
})
export type Order = z.infer<typeof Order>

export const isTerminal = (status: OrderStatus) => status !== 'pending'
