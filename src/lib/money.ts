import Decimal from 'decimal.js'
import type { Eth } from '@/contracts/common'

/**
 * Aritmética de ETH sem float. Uma instância isolada evita que configuração global
 * do decimal.js em outro módulo altere precisão ou arredondamento.
 */
const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -60, toExpPos: 60 })

const ETH_DECIMALS = 18

/** Serializa sempre em notação fixa, sem zeros à direita (nunca `1e-7`). */
const toEth = (value: Decimal): Eth => {
  const fixed = value.toDecimalPlaces(ETH_DECIMALS, Decimal.ROUND_HALF_EVEN).toFixed()
  return fixed === '-0' ? '0' : fixed
}

export const eth = {
  zero: '0' as Eth,
  add: (...values: Eth[]): Eth => toEth(values.reduce((acc, v) => acc.plus(v), new D(0))),
  sub: (a: Eth, b: Eth): Eth => toEth(D.max(new D(a).minus(b), 0)),
  mul: (a: Eth, factor: number | string): Eth => toEth(new D(a).times(factor)),
  /** Percentual inteiro (ex.: 10 → 10%). */
  percent: (a: Eth, percent: number): Eth => toEth(new D(a).times(percent).dividedBy(100)),
  cmp: (a: Eth, b: Eth): number => new D(a).comparedTo(b),
  eq: (a: Eth, b: Eth): boolean => new D(a).equals(b),
  min: (...values: Eth[]): Eth => toEth(D.min(...values)),
}

const intFormatter = new Intl.NumberFormat('pt-BR')

/**
 * Formata para exibição (pt-BR) com o valor exato: nunca arredonda casas significativas
 * e mantém ao menos 2 casas. Tudo por string/BigInt, sem passar por float.
 */
export function formatEth(value: Eth): string {
  const [int = '0', frac = ''] = new D(value).toFixed().split('.')
  return `${intFormatter.format(BigInt(int))},${frac.padEnd(2, '0')} ETH`
}
