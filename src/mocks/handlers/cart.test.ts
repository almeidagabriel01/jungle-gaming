import { describe, expect, it } from 'vitest'
import type { Network } from '@/contracts/common'
import type { DbCartItem, Tx } from '../db'
import { createSeed } from '../seed'
import { buildQuote, checkCoupon, mergedQuantity } from './cart'

const OWNER = 'user:usr_test'
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0)

/** Estado mínimo: um NFT com duas edições e o carrinho do dono. Nunca toca o localStorage. */
function makeTx(items: Omit<DbCartItem, 'id'>[], editions = [{ price: '1.19', available: 5 }, { price: '0.5', available: 2 }]): Tx {
  const db = createSeed()
  const base = db.nfts[0]!
  db.nfts = [{ ...base, id: 'nft_t', editions: editions.map((e, i) => ({ ...base.editions[0]!, id: `ed_${i + 1}`, supply: 50, ...e })) }]
  db.carts = [{ id: 'cart_t', owner: OWNER, items: items.map((item, i) => ({ id: `itm_${i + 1}`, ...item })), updatedAt: new Date(NOW).toISOString() }]
  db.quotes = []
  return { db, now: NOW, events: [] }
}

const line = (editionId: string, quantity: number) => ({ nftId: 'nft_t', editionId, quantity })
const quote = (tx: Tx, network: Network = 'ethereum', coupon: { code: string; percentOff: number } | null = null) => buildQuote(tx, OWNER, network, coupon)

describe('buildQuote: totais', () => {
  it('total por linha, subtotal, taxa da Ethereum e total', () => {
    const q = quote(makeTx([line('ed_1', 3), line('ed_2', 1)]))
    expect(q.lines.map((l) => l.lineTotal)).toEqual(['3.57', '0.5'])
    expect(q.subtotal).toBe('4.07')
    expect(q.discount).toBe('0')
    expect(q.networkFee).toBe('0.016')
    expect(q.total).toBe('4.086')
    expect(q.purchasable).toBe(true)
  })

  it('taxa de rede por rede', () => {
    const tx = makeTx([line('ed_2', 1)])
    expect(quote(tx, 'polygon')).toMatchObject({ networkFee: '0.0004', total: '0.5004' })
    expect(quote(tx, 'solana')).toMatchObject({ networkFee: '0.0001', total: '0.5001' })
  })

  it('carrinho vazio: sem taxa, total zero e não comprável', () => {
    expect(quote(makeTx([]))).toMatchObject({ lines: [], subtotal: '0', networkFee: '0', total: '0', purchasable: false })
  })
})

describe('buildQuote: cupom', () => {
  it('desconto percentual sobre o subtotal, antes da taxa', () => {
    const q = quote(makeTx([line('ed_1', 3), line('ed_2', 1)]), 'ethereum', { code: 'JUNGLE10', percentOff: 10 })
    expect(q).toMatchObject({ subtotal: '4.07', discount: '0.407', total: '3.679', coupon: { code: 'JUNGLE10', percentOff: 10 } })
  })

  it('cupom de 100% zera o subtotal, mas a taxa continua', () => {
    const q = quote(makeTx([line('ed_2', 2)]), 'ethereum', { code: 'FULL', percentOff: 100 })
    expect(q).toMatchObject({ subtotal: '1', discount: '1', total: '0.016' })
  })
})

describe('buildQuote: quantidade e estoque', () => {
  it('linha acima da disponibilidade fica insuficiente e trava a compra', () => {
    const q = quote(makeTx([line('ed_1', 1), line('ed_2', 3)]))
    expect(q.lines.map((l) => l.status)).toEqual(['ok', 'insufficient'])
    expect(q.purchasable).toBe(false)
  })

  it('edição esgotada fica sold-out e trava a compra', () => {
    const q = quote(makeTx([line('ed_1', 1)], [{ price: '1', available: 0 }]))
    expect(q.lines[0]!.status).toBe('sold-out')
    expect(q.purchasable).toBe(false)
  })

  it('item de edição que não existe mais sai da cotação', () => {
    const q = quote(makeTx([line('ed_1', 1), line('ed_x', 1)]))
    expect(q.lines.map((l) => l.editionId)).toEqual(['ed_1'])
  })
})

describe('buildQuote: fingerprint e registro', () => {
  it('mesmo estado: id novo, fingerprint igual', () => {
    const tx = makeTx([line('ed_1', 2)])
    const a = quote(tx)
    const b = quote(tx)
    expect(b.id).not.toBe(a.id)
    expect(b.fingerprint).toBe(a.fingerprint)
  })

  it('muda com preço, quantidade, cupom e rede', () => {
    const base = quote(makeTx([line('ed_1', 2)])).fingerprint
    expect(quote(makeTx([line('ed_1', 2)], [{ price: '1.2', available: 5 }])).fingerprint).not.toBe(base)
    expect(quote(makeTx([line('ed_1', 3)])).fingerprint).not.toBe(base)
    expect(quote(makeTx([line('ed_1', 2)]), 'ethereum', { code: 'JUNGLE10', percentOff: 10 }).fingerprint).not.toBe(base)
    expect(quote(makeTx([line('ed_1', 2)]), 'polygon').fingerprint).not.toBe(base)
  })

  it('guarda só as 10 cotações mais recentes do dono, sem tocar nas de outros', () => {
    const tx = makeTx([line('ed_1', 1)])
    buildQuote(tx, 'guest:outro', 'ethereum', null)
    const ids = Array.from({ length: 12 }, () => quote(tx).id)
    expect(tx.db.quotes.filter((q) => q.owner === OWNER).map((q) => q.id)).toEqual(ids.slice(-10))
    expect(tx.db.quotes.filter((q) => q.owner === 'guest:outro')).toHaveLength(1)
  })
})

describe('checkCoupon', () => {
  const EXPIRES = Date.parse('2025-01-01T00:00:00.000Z')
  const errorOf = async (result: ReturnType<typeof checkCoupon>) => {
    if (result.ok) throw new Error('esperava erro')
    return { status: result.response.status, body: (await result.response.json()) as { error: { code: string } } }
  }

  it('sem código: sem cupom', () => {
    expect(checkCoupon(undefined, NOW)).toEqual({ ok: true, coupon: null })
    expect(checkCoupon('', NOW)).toEqual({ ok: true, coupon: null })
  })

  it('válido devolve o percentual', () => {
    expect(checkCoupon('WELCOME25', NOW)).toEqual({ ok: true, coupon: { code: 'WELCOME25', percentOff: 25 } })
  })

  it('inexistente responde 422 COUPON_INVALID (o código chega já normalizado)', async () => {
    const error = await errorOf(checkCoupon('jungle10', NOW))
    expect(error.status).toBe(422)
    expect(error.body.error.code).toBe('COUPON_INVALID')
  })

  it('expira exatamente no instante de validade', async () => {
    expect(checkCoupon('EXPIRED5', EXPIRES - 1)).toEqual({ ok: true, coupon: { code: 'EXPIRED5', percentOff: 5 } })
    const error = await errorOf(checkCoupon('EXPIRED5', EXPIRES))
    expect(error.status).toBe(422)
    expect(error.body.error.code).toBe('COUPON_EXPIRED')
  })
})

describe('mergedQuantity (visitante → conta)', () => {
  it('soma as quantidades dentro do estoque', () => {
    expect(mergedQuantity(1, 2, 5)).toBe(3)
  })
  it('limita a soma ao estoque', () => {
    expect(mergedQuantity(2, 4, 5)).toBe(5)
  })
  it('nunca reduz a linha que a conta já tinha, mesmo com estoque menor', () => {
    expect(mergedQuantity(4, 1, 2)).toBe(4)
  })
  it('item novo com edição esgotada resulta em zero (não entra)', () => {
    expect(mergedQuantity(0, 3, 0)).toBe(0)
  })
})
