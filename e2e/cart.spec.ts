import type { Page } from '@playwright/test'
import { eth, formatEth } from '../src/lib/money'
import { expect, test, USERS } from './fixtures'
import { cartLink } from './helpers/account'

type Snapshot = Awaited<ReturnType<typeof snapshot>>
const snapshot = (page: Page) => page.evaluate(() => window.__mock!.snapshot())
const editionOf = (db: Snapshot, editionId: string) => db.nfts.flatMap((n) => n.editions.map((e) => ({ ...e, nft: n }))).find((e) => e.id === editionId)!
const cartItems = (db: Snapshot, owner: string) => db.carts.find((c) => c.owner === owner)?.items.map((i) => ({ editionId: i.editionId, quantity: i.quantity })) ?? []
const guestOwner = (page: Page) => page.evaluate(() => `guest:${localStorage.getItem('jungle-guest-id')}`)

const lines = (page: Page) => page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('article')
const line = (page: Page, name: string) => page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('article', { name, exact: true })
const quantity = (page: Page, name: string) => line(page, name).getByRole('group', { name: /^Quantidade de / })
const subtotal = (page: Page) => page.getByTestId('quote-subtotal')
const total = (page: Page) => page.getByTestId('quote-total')
const couponField = (page: Page) => page.getByLabel('Código promocional')

async function applyCoupon(page: Page, code: string) {
  await couponField(page).fill(code)
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
}

/** Adiciona a edição pelo detalhe, como o usuário faz. */
async function addFromDetail(page: Page, nftId: string, edition: string) {
  await page.goto(`/nfts/${nftId}`)
  await page.getByRole('radio', { name: edition, exact: true }).check()
  const before = await cartLink(page).getAttribute('aria-label')
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(cartLink(page)).not.toHaveAttribute('aria-label', before!)
}

// Carrinho da Ana no seed (frame Carrinho): 2 + 6 + 9 edições 1/50, subtotal 26.83 ETH + 0.016 de taxa.
const ANA = { subtotal: '26.83', fee: '0.016', items: ['nft_001_ed3', 'nft_005_ed3', 'nft_006_ed3'] }

test.describe('carrinho', () => {
  test('quantidade e remoção: a cotação da API recalcula os valores e o servidor guarda o resultado', async ({ page, mock }, testInfo) => {
    // No mobile o carrinho troca a barra inferior (e o badge) pelo resumo fixo.
    const badge = async (name: string) => {
      if (testInfo.project.name === 'desktop') await expect(cartLink(page)).toHaveAccessibleName(name)
    }
    await mock.open('/')
    await mock.login(USERS.ana)
    const db = await snapshot(page)
    const [first, second, third] = ANA.items.map((id) => editionOf(db, id))
    await cartLink(page).click()
    await expect(lines(page)).toHaveCount(3)
    await expect(subtotal(page)).toHaveText(formatEth(ANA.subtotal))
    await expect(total(page)).toHaveText(formatEth(eth.add(ANA.subtotal, ANA.fee)))

    // +1 no primeiro item: subtotal soma exatamente um preço unitário.
    await quantity(page, first.nft.name).getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(quantity(page, first.nft.name).locator('output')).toHaveText('3')
    const increased = eth.add(ANA.subtotal, first.price)
    await expect(subtotal(page)).toHaveText(formatEth(increased))
    await expect(total(page)).toHaveText(formatEth(eth.add(increased, ANA.fee)))
    await badge('Carrinho, 18 itens')

    // −1 volta ao valor original.
    await quantity(page, first.nft.name).getByRole('button', { name: 'Diminuir quantidade' }).click()
    await expect(quantity(page, first.nft.name).locator('output')).toHaveText('2')
    await expect(subtotal(page)).toHaveText(formatEth(ANA.subtotal))

    // Remoção: a linha sai, o resumo desconta a linha inteira e o aviso confirma.
    await line(page, second.nft.name).getByRole('button', { name: `Remover ${second.nft.name}` }).click()
    await expect(page.getByText(`${second.nft.name} removido do carrinho.`)).toBeVisible()
    await expect(lines(page)).toHaveCount(2)
    const removed = eth.sub(ANA.subtotal, eth.mul(second.price, 6))
    await expect(subtotal(page)).toHaveText(formatEth(removed))
    await badge('Carrinho, 11 itens')
    expect(cartItems(await snapshot(page), 'user:usr_ana')).toEqual([
      { editionId: first.id, quantity: 2 },
      { editionId: third.id, quantity: 9 },
    ])

    // Refresh mantém exatamente o que o servidor guardou.
    await page.reload()
    await expect(lines(page)).toHaveCount(2)
    await expect(subtotal(page)).toHaveText(formatEth(removed))
  })

  test('cupom inexistente e expirado ficam no campo; o válido aplica o desconto e sobrevive ao refresh', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await page.goto('/cart')
    const withoutCoupon = formatEth(eth.add(ANA.subtotal, ANA.fee))
    await expect(total(page)).toHaveText(withoutCoupon)

    for (const [code, message] of [
      ['naoexiste', 'Cupom não encontrado'],
      ['EXPIRED5', 'Este cupom expirou'],
    ] as const) {
      await applyCoupon(page, code)
      await expect(page).toHaveURL(new RegExp(`coupon=${code.toUpperCase()}`))
      await expect(couponField(page)).toHaveAttribute('aria-invalid', 'true')
      await expect(couponField(page)).toHaveAccessibleDescription(message)
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
      // Recusado o cupom, os valores são os da cotação sem desconto.
      await expect(total(page)).toHaveText(withoutCoupon)
      await expect(page.getByText('(-) 00.00')).toBeVisible()
    }

    await applyCoupon(page, 'jungle10')
    await expect(page).toHaveURL(/coupon=JUNGLE10/)
    await expect(page.getByText('Cupom aplicado: JUNGLE10')).toBeVisible()
    const discount = eth.percent(ANA.subtotal, 10)
    const withCoupon = formatEth(eth.add(eth.sub(ANA.subtotal, discount), ANA.fee))
    await expect(page.getByText('Cupom JUNGLE10 (10%)')).toBeVisible()
    await expect(page.getByText(`(-) ${formatEth(discount)}`)).toBeVisible()
    await expect(total(page)).toHaveText(withCoupon)

    await page.reload()
    await expect(page.getByText('Cupom aplicado: JUNGLE10')).toBeVisible()
    await expect(total(page)).toHaveText(withCoupon)

    await page.getByRole('button', { name: 'Remover cupom JUNGLE10' }).click()
    await expect(page).not.toHaveURL(/coupon=/)
    await expect(total(page)).toHaveText(withoutCoupon)
    await expect(couponField(page)).not.toHaveAttribute('aria-invalid')
  })

  test('carrinho de visitante persiste no refresh e passa inteiro para a conta vazia no login', async ({ page, mock }) => {
    await mock.open('/')
    const db = await snapshot(page)
    const nft = db.nfts.find((n) => n.id === 'nft_003')!
    const edition = nft.editions.find((e) => e.available >= 2)!
    await addFromDetail(page, nft.id, edition.name)
    await page.goto('/cart')
    await quantity(page, nft.name).getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(quantity(page, nft.name).locator('output')).toHaveText('2')
    await expect(subtotal(page)).toHaveText(formatEth(eth.mul(edition.price, 2)))

    await page.reload()
    await expect(lines(page)).toHaveCount(1)
    await expect(quantity(page, nft.name).locator('output')).toHaveText('2')
    const guest = await guestOwner(page)
    expect(cartItems(await snapshot(page), guest)).toEqual([{ editionId: edition.id, quantity: 2 }])

    await mock.login(USERS.bruno)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
    await cartLink(page).click()
    await expect(lines(page)).toHaveCount(1)
    await expect(quantity(page, nft.name).locator('output')).toHaveText('2')
    const after = await snapshot(page)
    expect(cartItems(after, 'user:usr_bruno')).toEqual([{ editionId: edition.id, quantity: 2 }])
    // O carrinho anônimo foi consumido pela mesclagem.
    expect(after.carts.some((c) => c.owner === guest)).toBe(false)
  })

  test('login mescla o carrinho de visitante com o do usuário somando a mesma edição', async ({ page, mock }) => {
    await mock.open('/')
    const db = await snapshot(page)
    const shared = editionOf(db, ANA.items[0])
    const extra = db.nfts.find((n) => n.id === 'nft_003')!
    const extraEdition = extra.editions.find((e) => e.available > 0)!
    await addFromDetail(page, shared.nft.id, shared.name)
    await addFromDetail(page, extra.id, extraEdition.name)

    await mock.login(USERS.ana)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 19 itens')
    await cartLink(page).click()
    await expect(lines(page)).toHaveCount(4)
    await expect(quantity(page, shared.nft.name).locator('output')).toHaveText('3')
    await expect(quantity(page, extra.name).locator('output')).toHaveText('1')
    await expect(subtotal(page)).toHaveText(formatEth(eth.add(ANA.subtotal, shared.price, extraEdition.price)))

    await page.reload()
    await expect(lines(page)).toHaveCount(4)
    expect(cartItems(await snapshot(page), 'user:usr_ana')).toEqual([
      { editionId: ANA.items[0], quantity: 3 },
      { editionId: ANA.items[1], quantity: 6 },
      { editionId: ANA.items[2], quantity: 9 },
      { editionId: extraEdition.id, quantity: 1 },
    ])
  })
})
