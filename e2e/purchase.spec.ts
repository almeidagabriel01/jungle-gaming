import { expect, test, USERS } from './fixtures'
import { acceptedTotal, orders, orderView, reviewFromCart, SLOW_SETTLE } from './helpers/checkout'

test.describe('compra completa', () => {
  test('do catálogo ao recibo: busca → detalhe → carrinho → pagamento → revisão → pendente → confirmado', async ({ page, mock }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile'
    await page.clock.install()
    // Liquidação em 15 s: o estado pendente fica observável e o relógio decide quando confirma.
    await mock.open('/', 'payment-slow')
    await mock.login(USERS.bruno)
    const before = await orders(mock.server)

    // Catálogo: busca pelo nome (no mobile, campo do topo com debounce; no desktop, diálogo do header).
    await mock.open('/')
    if (mobile) {
      await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('Cosmic Bloom')
    } else {
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.getByRole('searchbox', { name: 'Termo de busca' }).fill('Cosmic Bloom')
      await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    }
    await expect(page).toHaveURL(/q=Cosmic/)
    const grid = page.getByTestId('catalog-grid')
    await expect(grid).toHaveAttribute('aria-busy', 'false')
    await grid.getByRole('link', { name: 'Cosmic Bloom #118' }).click()

    // Detalhe: edição e quantidade.
    await expect(page).toHaveURL(/\/nfts\/nft_004/)
    await expect(page.getByRole('heading', { level: 1, name: 'Cosmic Bloom #118' })).toBeVisible()
    await page.getByRole('radio', { name: '1/50' }).check()
    const stepper = page.getByRole('group', { name: 'Quantidade de Cosmic Bloom #118' }).filter({ visible: true })
    await stepper.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).filter({ visible: true }).click()
    await expect(page.getByRole('link', { name: /Carrinho, 2 itens/ }).filter({ visible: true })).toBeVisible()

    const edition = await mock.server((m) => {
      const ed = m.snapshot().nfts.find((n) => n.id === 'nft_004')!.editions.find((e) => e.name === '1/50')!
      return { id: ed.id, price: ed.price, available: ed.available }
    })

    // Carrinho → pagamento → revisão: o total da revisão é o da cotação da API.
    const confirm = await reviewFromCart(page)
    const summary = page.getByRole('complementary', { name: 'Resumo do pedido' })
    await expect(summary.getByRole('list', { name: 'NFTs do pedido' })).toContainText('Cosmic Bloom #118')
    await expect(summary.getByRole('list', { name: 'NFTs do pedido' })).toContainText('(x 2)')
    await expect(page.getByText(USERS.bruno.email)).toBeVisible()
    const total = await acceptedTotal(confirm)
    await confirm.click()

    // Pendente: o servidor criou o pedido e reservou o estoque.
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    const created = await orders(mock.server)
    expect(created).toHaveLength(before.length + 1)
    const order = created.at(-1)!
    expect(order.total).toBe(total.replace(' ETH', ''))
    expect(order.lines).toEqual([expect.objectContaining({ nftId: 'nft_004', editionId: edition.id, quantity: 2, unitPrice: edition.price })])
    expect(await mock.server((m, id) => m.snapshot().nfts.find((n) => n.id === 'nft_004')!.editions.find((e) => e.id === id)!.available, edition.id)).toBe(
      edition.available - 2,
    )

    // A liquidação chega pelo order.updated do socket: confirmado, com recibo.
    await page.clock.fastForward(SLOW_SETTLE)
    await expect(orderView(page)).toHaveAttribute('data-status', 'confirmed')
    const receipt = page.getByTestId('receipt')
    await expect(receipt.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toHaveText(total)
    const rows = receipt.getByRole('table', { name: 'Itens do pedido' }).getByRole('row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('Cosmic Bloom #118')
    await expect(rows.nth(1)).toContainText('(x 2)')
    const txHash = (await mock.server((m, id) => m.snapshot().orders.find((o) => o.id === id)!.txHash, order.id))!
    await expect(receipt.getByText(txHash)).toBeAttached()
    // O hash é do mock: o explorador fica declarado como simulado, sem link para um explorador real (§3).
    await expect(receipt.getByRole('button', { name: 'Explorador (simulado)' })).toBeVisible()

    // Recibo é snapshot: mudança posterior no catálogo (via REST + socket) não altera os valores, nem após refresh.
    await mock.server((m, id) => m.updateEdition('nft_004', id, { price: '7.5' }), edition.id)
    await expect(page.getByTestId('receipt-total')).toHaveText(total)
    await page.reload()
    await expect(orderView(page)).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByTestId('receipt-total')).toHaveText(total)

    // Só os itens comprados saem do carrinho.
    await page.goto('/cart')
    await expect(page.getByRole('region', { name: 'Carrinho vazio' })).toBeVisible()
    expect(await orders(mock.server)).toHaveLength(before.length + 1)
  })
})
