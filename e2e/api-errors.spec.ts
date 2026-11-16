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
