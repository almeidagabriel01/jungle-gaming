import type { Locator, Page } from '@playwright/test'
import { expect, type Mock } from '../fixtures'

type Server = Mock['server']

/** Liquidação lenta do cenário `payment-slow` (15 s): o teste a dispara com `page.clock`. */
export const SLOW_SETTLE = '00:16'

/** Carrinho → pagamento → conecta a carteira principal → revisão. Devolve o botão de confirmar já habilitado. */
export async function reviewFromCart(page: Page): Promise<Locator> {
  await page.goto('/cart')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Revisão do pedido' })).toBeVisible()
  const confirm = confirmButton(page)
  await expect(confirm).toBeEnabled()
  return confirm
}

export const confirmButton = (page: Page) => page.getByRole('button', { name: /^Confirmar compra/ })

/** "Confirmar compra (1.29 ETH)" → "1.29 ETH": o total aceito na revisão. */
export async function acceptedTotal(confirm: Locator) {
  return /\((.+)\)/.exec(await confirm.innerText())![1]!
}

export const orderView = (page: Page) => page.getByTestId('order-view')

export const orders = (server: Server) => server((m) => m.snapshot().orders)

/** Primeira edição do primeiro item do carrinho do usuário (fonte: mock DB). */
export const firstCartLine = (server: Server, userId: string) =>
  server((m, owner) => {
    const db = m.snapshot()
    const item = db.carts.find((c) => c.owner === owner)!.items[0]!
    const nft = db.nfts.find((n) => n.id === item.nftId)!
    const edition = nft.editions.find((e) => e.id === item.editionId)!
    return { nftId: nft.id, editionId: edition.id, name: nft.name, price: edition.price, available: edition.available, quantity: item.quantity }
  }, `user:${userId}`)
