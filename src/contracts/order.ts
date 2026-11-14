import { z } from 'zod'
import { Username, WalletDetails } from './account'
import { Coupon, QuoteLine } from './cart'
import { Eth, Id, IsoDate, Network } from './common'

export const OrderStatus = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof OrderStatus>

/**
 * Comprador = campos do formulário do Pagamento (snapshot no pedido): dados do colecionador,
 * dados da carteira escolhida (endereço, ENS secundário, tipo) e observação opcional.
 */
export const Buyer = WalletDetails.pick({
  displayName: true,
  profileName: true,
  email: true,
  ensName: true,
  referralCode: true,
  address: true,
  secondaryAddress: true,
  provider: true,
}).extend({
  username: Username,
  note: z.string().trim().max(280, 'Máximo de 280 caracteres'),
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
  explorerUrl: z.url({ protocol: /^https$/ }).nullable(),
  failureReason: z.string().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
})
export type Order = z.infer<typeof Order>

export const isTerminal = (status: OrderStatus) => status !== 'pending'

export const OrderList = z.object({ items: z.array(Order) })
