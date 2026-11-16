import { expect, test, USERS } from './fixtures'

test.describe('pedido idempotente', () => {
  test('timeout após criar o pedido: reenvio recupera o mesmo pedido, sem duplicar', async ({ page, mock }) => {
    // Tempo do cenário, não `page.clock`: o timeout de 10 s do cliente é o `xhr.timeout` nativo do Axios
    // (adapter xhr, src/api/client.ts), um timer do navegador fora do relógio falso. Já o atraso de 30 s
    // da resposta (MSW `delay`) roda no relógio da página: avançá-lo entregaria a resposta antes do
    // timeout e o cenário deixaria de existir. Por isso o teste espera o timeout real do cliente.
    test.setTimeout(90_000)
    await mock.open('/', 'order-timeout')
    await mock.login(USERS.ana)
    const ordersBefore = await mock.server((m) => m.snapshot().orders.length)

    await page.goto('/cart')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    // Formulário vem preenchido pelo perfil e pela carteira principal.
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
    await page.getByRole('button', { name: 'Revisar pedido' }).click()

    const confirm = page.getByRole('button', { name: /Confirmar compra/ })
    await expect(confirm).toBeEnabled()
    // Clique repetido: o botão trava e a tentativa usa uma única chave.
    await confirm.dblclick()

    // O servidor criou o pedido, mas a resposta se perde (timeout de 10 s do cliente).
    const resend = page.getByRole('button', { name: 'Reenviar pedido' })
    await expect(resend).toBeVisible({ timeout: 20_000 })
    // Sem resposta, uma nova confirmação abriria outra chave: só o reenvio fica disponível.
    await expect(confirm).toBeDisabled()
    expect(await mock.server((m) => m.snapshot().orders.length)).toBe(ordersBefore + 1)

    await resend.click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-view')).toHaveAttribute('data-status', 'confirmed', { timeout: 15_000 })
    await expect(page.getByTestId('receipt')).toBeVisible()
    expect(await mock.server((m) => m.snapshot().orders.length)).toBe(ordersBefore + 1)

    // Mesma chave com corpo diferente é conflito (contrato REST via handler MSW).
    const conflict = await page.evaluate(async () => {
      const session = JSON.parse(localStorage.getItem('jungle-session:v1') ?? 'null') as { tokens: { accessToken: string } }
      const db = window.__mock!.snapshot()
      const order = db.orders.at(-1)!
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.tokens.accessToken}`, 'Idempotency-Key': order.idempotencyKey },
        body: JSON.stringify({ quoteId: 'qte_x', fingerprint: 'diferente', walletId: order.wallet.id, network: order.network, buyer: order.buyer }),
      })
      return { status: res.status, body: (await res.json()) as { error: { code: string } } }
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })
})

test.describe('tempo real', () => {
  test('nft.updated via socket.io-client atualiza preço e resumo do carrinho aberto', async ({ page, mock }) => {
    await mock.open('/nfts/nft_002')
    await page.getByRole('radio', { name: '1/50' }).check()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('link', { name: /Carrinho, 1 item/ })).toBeVisible()

    await page.getByRole('link', { name: /Carrinho, 1 item/ }).click()
    await expect(page.getByTestId('quote-total')).toBeVisible()
    await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
    const totalBefore = await page.getByTestId('quote-total').innerText()

    // Mudança no "servidor": o mock DB emite nft.updated pelo socket; nada é escrito na UI ou no cache.
    const editionId = await mock.server((m) => m.snapshot().carts.find((c) => c.owner.startsWith('guest:'))!.items[0].editionId)
    await mock.server((m, id) => m.updateEdition('nft_002', id, { price: '9.87654321' }), editionId)

    await expect(page.getByTestId('cart-notices')).toContainText('mudou')
    await expect(page.getByText('9.87654321 ETH').first()).toBeVisible()
    await expect(page.getByTestId('quote-total')).not.toHaveText(totalBefore)
    await expect(page.getByTestId('quote-subtotal')).toHaveText('9.87654321 ETH')
  })
})
