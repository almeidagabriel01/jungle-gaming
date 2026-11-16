import type { QuoteLine } from '@/contracts/cart'

/** Linha frente ao estoque da edição: esgotada, acima da disponibilidade ou ok (cotação e carrinho). */
export const lineStatus = (quantity: number, available: number): QuoteLine['status'] =>
  available === 0 ? 'sold-out' : quantity > available ? 'insufficient' : 'ok'

/**
 * Quanto ainda dá para adicionar da edição: o estoque menos o que já está no carrinho. A quantidade
 * pedida é limitada a isso, mas nunca abaixo de 1 (o seletor sempre mostra um valor válido).
 */
export function addLimit(available: number, inCart: number, requested: number) {
  const max = Math.max(0, available - inCart)
  return { max, quantity: Math.min(requested, Math.max(1, max)), soldOut: max === 0 }
}
