import { describe, expect, it } from 'vitest'
import { eth, formatEth } from './money'

describe('eth', () => {
  it('soma sem erro de float', () => {
    expect(eth.add('0.1', '0.2')).toBe('0.3')
    expect(eth.add()).toBe('0')
  })
  it('subtração nunca fica negativa', () => {
    expect(eth.sub('1', '0.25')).toBe('0.75')
    expect(eth.sub('1', '2')).toBe('0')
  })
  it('multiplica e calcula percentual inteiro', () => {
    expect(eth.mul('1.19', 3)).toBe('3.57')
    expect(eth.percent('26.83', 10)).toBe('2.683')
    expect(eth.percent('3', 100)).toBe('3')
  })
  it('arredonda em 18 casas (meio para o par)', () => {
    expect(eth.percent('0.000000000000000005', 10)).toBe('0')
    expect(eth.percent('0.000000000000000015', 10)).toBe('0.000000000000000002')
  })
  it('compara valores com escalas diferentes', () => {
    expect(eth.eq('1.50', '1.5')).toBe(true)
    expect(eth.cmp('2', '10')).toBe(-1)
  })
})

describe('formatEth', () => {
  it('ao menos 2 casas, sem arredondar casas significativas', () => {
    expect(formatEth('1')).toBe('1.00 ETH')
    expect(formatEth('26.846')).toBe('26.846 ETH')
    expect(formatEth('0.0000001')).toBe('0.0000001 ETH')
  })
})
