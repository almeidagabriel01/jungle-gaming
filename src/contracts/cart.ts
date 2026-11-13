import { z } from 'zod'
import { Eth, Id, IsoDate, Network } from './common'
import { NftImage } from './nft'

export const CartItem = z.object({
  id: Id,
  nftId: Id,
  editionId: Id,
  name: z.string(),
  tokenId: z.string(),
  editionName: z.string(),
  image: NftImage,
  quantity: z.int().min(1),
  /** Preço atual da edição, segundo a API. */
  unitPrice: Eth,
  available: z.int().min(0),
})
export type CartItem = z.infer<typeof CartItem>

export const Cart = z.object({
  id: Id,
  items: z.array(CartItem),
  updatedAt: IsoDate,
})
export type Cart = z.infer<typeof Cart>

export const Quantity = z.int('Quantidade deve ser inteira').min(1, 'Mínimo 1').max(99)

export const AddCartItemBody = z.object({ nftId: Id, editionId: Id, quantity: Quantity })
export type AddCartItemBody = z.infer<typeof AddCartItemBody>

export const UpdateCartItemBody = z.object({ quantity: Quantity })

export const MergeCartBody = z.object({ guestId: Id })

/* ---------- Cotação ---------- */

export const QuoteLineStatus = z.enum(['ok', 'insufficient', 'sold-out'])

export const QuoteLine = z.object({
  itemId: Id,
  nftId: Id,
  editionId: Id,
  name: z.string(),
  tokenId: z.string(),
  editionName: z.string(),
  image: NftImage,
  quantity: z.int().min(1),
  unitPrice: Eth,
  lineTotal: Eth,
  available: z.int().min(0),
  status: QuoteLineStatus,
})
export type QuoteLine = z.infer<typeof QuoteLine>

export const Coupon = z.object({ code: z.string(), percentOff: z.int().min(1).max(100) })
export type Coupon = z.infer<typeof Coupon>

export const QuoteRequest = z.object({
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  network: Network,
})
export type QuoteRequest = z.infer<typeof QuoteRequest>

export const Quote = z.object({
  id: Id,
  /** Hash do conteúdo (linhas, preços, cupom, taxa). Pedido exige o mesmo fingerprint. */
  fingerprint: z.string(),
  network: Network,
  lines: z.array(QuoteLine),
  coupon: Coupon.nullable(),
  subtotal: Eth,
  discount: Eth,
  networkFee: Eth,
  total: Eth,
  /** false quando alguma linha está esgotada ou acima da disponibilidade. */
  purchasable: z.boolean(),
  createdAt: IsoDate,
})
export type Quote = z.infer<typeof Quote>
