import { describe, expect, it } from 'vitest'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/events'
import type { Nft } from '@/contracts/nft'
import type { Order } from '@/contracts/order'
import { createVersionGate, patchNft, patchOrder } from './versions'

const nftEvent = (version: number, extra: Partial<NftUpdatedEvent> = {}): NftUpdatedEvent => ({
  eventId: `evt_${version}`,
  type: 'nft.updated',
  resource: { type: 'nft', id: 'nft_1' },
  version,
  occurredAt: '2026-10-01T12:00:00.000Z',
  payload: { nftId: 'nft_1', minPrice: '2', available: 3, editions: [{ id: 'ed_1', price: '2', available: 3 }] },
  ...extra,
})

const orderEvent = (version: number): OrderUpdatedEvent => ({
  eventId: `evt_o${version}`,
  type: 'order.updated',
  resource: { type: 'order', id: 'nft_1' },
  version,
  occurredAt: '2026-10-01T12:00:00.000Z',
  payload: { orderId: 'nft_1', userId: 'usr_1', status: 'declined', failureReason: 'Recusado' },
})

describe('shouldApply', () => {
  it('aplica o primeiro evento e recusa a repetição da mesma versão', () => {
    const gate = createVersionGate()
    expect(gate.shouldApply(nftEvent(1))).toBe(true)
    expect(gate.shouldApply(nftEvent(1))).toBe(false)
  })

  it('recusa a mesma versão mesmo com outro eventId e occurredAt', () => {
    const gate = createVersionGate()
    gate.shouldApply(nftEvent(2))
    expect(gate.shouldApply(nftEvent(2, { eventId: 'evt_outro', occurredAt: '2027-01-01T00:00:00.000Z' }))).toBe(false)
  })

  it('recusa evento antigo que chega depois do novo e aceita salto de versão', () => {
    const gate = createVersionGate()
    expect(gate.shouldApply(nftEvent(3))).toBe(true)
    expect(gate.shouldApply(nftEvent(2))).toBe(false)
    expect(gate.shouldApply(nftEvent(7))).toBe(true)
    expect(gate.shouldApply(nftEvent(4))).toBe(false)
  })

  it('separa recursos por tipo e por id', () => {
    const gate = createVersionGate()
    expect(gate.shouldApply(nftEvent(5))).toBe(true)
    expect(gate.shouldApply(orderEvent(5))).toBe(true)
    expect(gate.shouldApply(nftEvent(1, { resource: { type: 'nft', id: 'nft_2' } }))).toBe(true)
  })

  it('clear recomeça as versões (troca de usuário)', () => {
    const gate = createVersionGate()
    gate.shouldApply(nftEvent(9))
    gate.clear()
    expect(gate.shouldApply(nftEvent(1))).toBe(true)
  })

  it('cada portão tem o próprio estado', () => {
    const a = createVersionGate()
    a.shouldApply(nftEvent(1))
    expect(createVersionGate().shouldApply(nftEvent(1))).toBe(true)
  })
})

const nft = { id: 'nft_1', version: 2, minPrice: '1', available: 5, editions: [{ id: 'ed_1', name: '1/50', price: '1', supply: 50, available: 3 }, { id: 'ed_2', name: 'Aberta', price: '0.5', supply: 99, available: 2 }] } as unknown as Nft

describe('patchNft', () => {
  it('aplica evento mais novo: versão, preço mínimo, total e só as edições do payload', () => {
    const next = patchNft(nft, nftEvent(3))
    expect(next.version).toBe(3)
    expect(next.minPrice).toBe('2')
    expect(next.available).toBe(3)
    expect(next.editions).toEqual([
      { id: 'ed_1', name: '1/50', price: '2', supply: 50, available: 3 },
      { id: 'ed_2', name: 'Aberta', price: '0.5', supply: 99, available: 2 },
    ])
  })

  it('ignora evento da mesma versão, antigo ou de outro NFT', () => {
    expect(patchNft(nft, nftEvent(2))).toBe(nft)
    expect(patchNft(nft, nftEvent(1))).toBe(nft)
    expect(patchNft(nft, nftEvent(9, { payload: { ...nftEvent(9).payload, nftId: 'nft_2' } }))).toBe(nft)
  })
})

describe('patchOrder', () => {
  const order = { id: 'nft_1', version: 1, status: 'pending', failureReason: null } as unknown as Order

  it('aplica status e motivo de evento mais novo', () => {
    expect(patchOrder(order, orderEvent(2))).toMatchObject({ version: 2, status: 'declined', failureReason: 'Recusado' })
  })

  it('ignora evento da mesma versão ou antigo', () => {
    expect(patchOrder(order, orderEvent(1))).toBe(order)
    expect(patchOrder({ ...order, version: 4 }, orderEvent(3))).toMatchObject({ version: 4, status: 'pending' })
  })
})
