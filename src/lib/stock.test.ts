import { describe, expect, it } from 'vitest'
import { Quantity } from '@/contracts/cart'
import { addLimit, lineStatus } from './stock'

describe('lineStatus', () => {
  it('esgotada quando não há estoque, mesmo com quantidade baixa', () => {
    expect(lineStatus(1, 0)).toBe('sold-out')
  })
  it('insuficiente acima da disponibilidade', () => {
    expect(lineStatus(3, 2)).toBe('insufficient')
  })
  it('ok no limite exato e abaixo dele', () => {
    expect(lineStatus(2, 2)).toBe('ok')
    expect(lineStatus(1, 5)).toBe('ok')
  })
})

describe('addLimit', () => {
  it('limita ao estoque menos o que já está no carrinho', () => {
    expect(addLimit(5, 2, 9)).toEqual({ max: 3, quantity: 3, soldOut: false })
    expect(addLimit(5, 2, 2)).toEqual({ max: 3, quantity: 2, soldOut: false })
  })
  it('tudo no carrinho: esgotado, mas o seletor fica em 1', () => {
    expect(addLimit(4, 4, 3)).toEqual({ max: 0, quantity: 1, soldOut: true })
  })
  it('carrinho acima do estoque (estoque caiu) não gera limite negativo', () => {
    expect(addLimit(1, 3, 1)).toEqual({ max: 0, quantity: 1, soldOut: true })
  })
  it('edição esgotada', () => {
    expect(addLimit(0, 0, 1)).toEqual({ max: 0, quantity: 1, soldOut: true })
  })
})

describe('Quantity (contrato)', () => {
  it('aceita inteiros de 1 a 99', () => {
    expect(Quantity.safeParse(1).success).toBe(true)
    expect(Quantity.safeParse(99).success).toBe(true)
  })
  it('recusa zero, acima de 99 e fração', () => {
    expect(Quantity.safeParse(0).success).toBe(false)
    expect(Quantity.safeParse(100).success).toBe(false)
    expect(Quantity.safeParse(1.5).success).toBe(false)
  })
})
