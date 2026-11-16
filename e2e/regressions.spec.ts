import type { MockControl } from '../src/mocks/browser'
import { expect, test } from './fixtures'

/** Regressões de borda (tempo real, checkout, recibo, contrato REST). */

/** Muda o preço de todas as edições do NFT pelo "servidor" (cada uma emite `nft.updated`). */
const setPrice = (m: MockControl, price: string) => {
  for (const e of m.snapshot().nfts.find((n) => n.id === 'nft_002')!.editions) m.updateEdition('nft_002', e.id, { price })
}

test('reset do servidor sem reload: eventos novos voltam a ser aplicados', async ({ page, mock }) => {
  await mock.open('/nfts/nft_002')
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
  const price = page.locator('[data-testid^="edition-price-"]')

  // Sobe a versão do NFT no cliente com alguns eventos.
  for (const value of ['7.1', '7.2', '7.3']) await mock.server(setPrice, value)
  await expect(price).toContainText('7.3')

  // Servidor reiniciado: ids e versões voltam a contar do seed.
  await mock.server((m) => m.reset())
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
  await mock.server(setPrice, '1.23456789')
  await expect(price).toContainText('1.23456789')
})
