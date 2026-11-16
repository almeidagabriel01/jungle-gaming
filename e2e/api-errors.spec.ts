import { expect, test } from './fixtures'

/** Rotas protegidas que leem corpo. Corpo `{}` é inválido em todas; o token não existe. */
const PROTECTED_WRITES = [
  ['PATCH', '/api/me/profile'],
  ['PUT', '/api/me/avatar'],
  ['POST', '/api/me/password'],
  ['POST', '/api/me/wallets'],
  ['PATCH', '/api/me/wallets/wal_00001'],
  ['POST', '/api/me/wallets/wal_00001/connection'],
  ['POST', '/api/cart/items'],
  ['PATCH', '/api/cart/items/itm_00001'],
  ['POST', '/api/cart/merge'],
  ['POST', '/api/quotes'],
  ['POST', '/api/orders'],
] as const

test.describe('§5 sessão inválida', () => {
  test('autenticação vem antes da validação do corpo: 401, nunca 422', async ({ page, mock }) => {
    await mock.open('/')
    const statuses = await page.evaluate(
      (routes) =>
        Promise.all(
          routes.map(async ([method, path]) => {
            const res = await fetch(path, {
              method,
              headers: { authorization: 'Bearer token-invalido', 'content-type': 'application/json' },
              body: '{}',
            })
            return `${method} ${path} → ${res.status}`
          }),
        ),
      PROTECTED_WRITES,
    )
    expect(statuses).toEqual(PROTECTED_WRITES.map(([method, path]) => `${method} ${path} → 401`))
  })
})

test.describe('§6 falhas de rede', () => {
  test('leitura sem resposta cai no erro com "tentar novamente" e se recupera', async ({ page, mock }) => {
    await page.clock.install()
    await mock.open('/', 'read-timeout')
    // Timeout do cliente (10 s) × 3 tentativas + backoff.
    await page.clock.runFor(60_000)
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(error).toContainText('O servidor demorou para responder')
    await mock.server((m) => m.setScenario('default'))
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(error).toBeHidden()
  })

  const WRITE_FAILURES = [
    ['write-server-error', 'Serviço temporariamente indisponível'],
    ['write-client-error', 'O servidor recusou a operação'],
  ] as const
  for (const [scenario, message] of WRITE_FAILURES) {
    test(`carrinho: escrita recusada (${scenario}) não aparece como sucesso`, async ({ page, mock }) => {
      await mock.open('/nfts/nft_003', scenario)
      const add = page.getByRole('button', { name: 'Adicionar ao carrinho' }).filter({ visible: true }).first()
      await add.click()
      await expect(page.getByText(message).first()).toBeVisible()
      await expect(page.getByText(/adicionado ao carrinho/)).toHaveCount(0)
      await expect(add).toBeEnabled()
      const items = await mock.server((m) => m.snapshot().carts.filter((c) => c.owner.startsWith('guest')).flatMap((c) => c.items).length)
      expect(items).toBe(0)
    })
  }
})
