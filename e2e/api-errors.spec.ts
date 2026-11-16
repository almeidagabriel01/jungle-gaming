import type { Page } from '@playwright/test'
import { expect, test, USERS, waitForApp } from './fixtures'

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
})

/**
 * §6: cada escrita que falha (503 transitório e 403 definitivo) mostra uma mensagem clara, não
 * aparece como sucesso, não muda o servidor e pode ser repetida; com o cenário desligado, a
 * repetição grava.
 */
const WRITE_FAILURES = [
  ['write-server-error', 'Serviço temporariamente indisponível'],
  ['write-client-error', 'O servidor recusou a operação'],
] as const

const switchScenario = (mock: { server: <T, A>(fn: (m: import('../src/mocks/browser').MockControl, a: A) => T, a: A) => Promise<T> }, name: string) =>
  mock.server((m, n) => m.setScenario(n), name)

/** Atalho da conta no header (desktop) ou na barra inferior (mobile). */
const accountShortcut = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name.split(' ')[0]} ?: menu da conta$`) }).or(page.getByRole('link', { name: `Perfil de ${name}` }))

const alertWith = (page: Page, text: string | RegExp) => page.getByRole('alert').filter({ hasText: text }).first()
const toastWith = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast]').filter({ hasText: text })

/**
 * Com o relógio pausado, avança em passos de 100 ms (abaixo da latência mínima do mock, 120 ms)
 * até `ready`: a próxima request fica parada no atraso e o cenário pode ser trocado antes dela.
 */
async function stepUntil(page: Page, ready: () => Promise<boolean>) {
  await expect
    .poll(async () => {
      if (await ready()) return true
      await page.clock.runFor(100)
      return ready()
    })
    .toBe(true)
}

for (const [scenario, message] of WRITE_FAILURES) {
  test.describe(`§6 escrita com falha (${scenario})`, () => {
    test('login', async ({ page, mock }) => {
      await mock.open('/login', scenario)
      const sessions = await mock.server((m) => m.snapshot().sessions.length)
      await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
      await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
      const submit = page.getByRole('button', { name: 'Entrar', exact: true })
      await submit.click()

      await expect(alertWith(page, message)).toBeVisible()
      await expect(page).toHaveURL(/\/login/)
      await expect(accountShortcut(page, USERS.ana.name)).toHaveCount(0)
      expect(await mock.server((m) => m.snapshot().sessions.length)).toBe(sessions)

      // O formulário mantém os dados e o próprio botão repete.
      await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(USERS.ana.email)
      await switchScenario(mock, 'default')
      await submit.click()
      await expect(accountShortcut(page, USERS.ana.name)).toBeVisible()
      expect(await mock.server((m) => m.snapshot().sessions.length)).toBe(sessions + 1)
    })

    test('cadastro', async ({ page, mock }) => {
      await mock.open('/register', scenario)
      const users = await mock.server((m) => m.snapshot().users.length)
      await page.getByLabel('Nome de usuário', { exact: true }).fill('carla_nova')
      await page.getByLabel('E-mail', { exact: true }).fill('carla@jungle.test')
      await page.getByLabel('Senha', { exact: true }).fill('Senha@123')
      await page.getByLabel('Confirmar senha', { exact: true }).fill('Senha@123')
      const submit = page.getByRole('button', { name: /^Criar (conta|perfil)$/ })
      await submit.click()

      await expect(alertWith(page, message)).toBeVisible()
      await expect(page).toHaveURL(/\/register/)
      expect(await mock.server((m) => m.snapshot().users.length)).toBe(users)

      await expect(page.getByLabel('Nome de usuário', { exact: true })).toHaveValue('carla_nova')
      await switchScenario(mock, 'default')
      await submit.click()
      await expect(page).not.toHaveURL(/\/register/)
      expect(await mock.server((m) => m.snapshot().users.some((u) => u.email === 'carla@jungle.test'))).toBe(true)
    })

    test('carrinho', async ({ page, mock }) => {
      await mock.open('/nfts/nft_003', scenario)
      const guestItems = () => mock.server((m) => m.snapshot().carts.filter((c) => c.owner.startsWith('guest')).flatMap((c) => c.items).length)
      const add = page.getByRole('button', { name: 'Adicionar ao carrinho' }).filter({ visible: true }).first()
      await add.click()

      await expect(page.getByText(message).first()).toBeVisible()
      await expect(toastWith(page, /adicionado ao carrinho/)).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Carrinho, 0 itens' }).first()).toBeAttached()
      expect(await guestItems()).toBe(0)

      // O botão segue habilitado ao lado da mensagem: ele mesmo é o "tentar de novo".
      await expect(add).toBeEnabled()
      await switchScenario(mock, 'default')
      await add.click()
      await expect(toastWith(page, /adicionado ao carrinho/)).toBeVisible()
      expect(await guestItems()).toBe(1)
    })

    test('cupom', async ({ page, mock }) => {
      await page.clock.install()
      await mock.open('/')
      await mock.login(USERS.ana)
      await page.goto('/cart')
      await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toBeVisible()
      const quotes = await mock.server((m) => m.snapshot().quotes.length)
      await switchScenario(mock, scenario)
      await page.getByLabel('Código promocional').fill('JUNGLE10')
      await page.getByRole('button', { name: 'Aplicar' }).click()

      // 503 é transitório: a cotação repete com backoff antes de desistir (relógio adiantado).
      const error = alertWith(page, 'Não foi possível calcular o resumo')
      await stepUntil(page, () => error.isVisible())
      await expect(error).toContainText(message)
      await expect(page.getByText('Cupom aplicado')).toHaveCount(0)
      expect(await mock.server((m) => m.snapshot().quotes.length)).toBe(quotes)

      await switchScenario(mock, 'default')
      await error.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByText('Cupom aplicado')).toContainText('JUNGLE10')
    })

    test('favoritos', async ({ page, mock }) => {
      await mock.open('/')
      await mock.login(USERS.ana)
      await page.goto('/nfts/nft_003')
      const heart = page.getByRole('button', { name: /^Favoritar / }).filter({ visible: true }).first()
      await expect(heart).toHaveAttribute('aria-pressed', 'false')
      const favorites = () => mock.server((m) => m.snapshot().favorites.usr_ana)
      const before = await favorites()
      await switchScenario(mock, scenario)
      await heart.click()

      // O coração volta sozinho (rollback): a nova tentativa fica no aviso de erro.
      const toast = toastWith(page, 'Não foi possível favoritar')
      await expect(toast).toBeVisible()
      await expect(heart).toHaveAttribute('aria-pressed', 'false')
      await expect(toastWith(page, 'adicionado aos favoritos')).toHaveCount(0)
      expect(await favorites()).toEqual(before)

      await switchScenario(mock, 'default')
      await toast.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByRole('button', { name: /^Remover .* dos favoritos$/ }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(favorites).toContain('nft_003')
    })

    test('POST /orders no checkout completo', async ({ page, mock }) => {
      await page.clock.install()
      await mock.open('/')
      await mock.login(USERS.ana)
      const state = () =>
        mock.server((m) => {
          const db = m.snapshot()
          return { orders: db.orders.length, available: db.nfts.find((n) => n.id === 'nft_001')?.editions.find((e) => e.id === 'nft_001_ed3')?.available }
        })
      const before = await state()

      await page.goto('/cart')
      await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
      await page.getByRole('button', { name: 'Conectar carteira' }).click()
      await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
      await page.getByRole('button', { name: 'Revisar pedido' }).click()
      const confirm = page.getByRole('button', { name: /Confirmar compra/ })
      await expect(confirm).toBeEnabled()

      // A confirmação revalida a cotação (sem falha) e só então envia o pedido: o cenário liga
      // quando a tentativa já está gravada e o POST /orders está parado na latência.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
      await confirm.click()
      await stepUntil(page, () => page.evaluate(() => sessionStorage.getItem('jungle-order-attempt:usr_ana') !== null))
      await switchScenario(mock, scenario)
      await page.clock.resume()

      if (scenario === 'write-server-error') {
        // Transitório: o pedido pode existir; só o reenvio com a mesma chave é oferecido.
        await expect(alertWith(page, 'Não recebemos a confirmação')).toBeVisible()
        await expect(confirm).toBeDisabled()
      } else {
        await expect(alertWith(page, message)).toBeVisible()
        await expect(confirm).toBeEnabled()
      }
      await expect(page).toHaveURL(/\/checkout/)
      expect(await state()).toEqual(before)

      await switchScenario(mock, 'default')
      await (scenario === 'write-server-error' ? page.getByRole('button', { name: 'Reenviar pedido' }) : confirm).click()
      await expect(page).toHaveURL(/\/orders\/ord_/)
      expect((await state()).orders).toBe(before.orders + 1)
    })

    test('perfil', async ({ page, mock }) => {
      await mock.open('/')
      await mock.login(USERS.ana)
      await page.goto('/profile')
      const name = page.getByRole('textbox', { name: 'Nome de exibição', exact: true })
      await expect(name).toHaveValue(USERS.ana.name)
      await name.fill('Carla Souza')
      await switchScenario(mock, scenario)
      const save = page.getByRole('button', { name: 'Salvar', exact: true })
      await save.click()

      await expect(alertWith(page, message)).toBeVisible()
      await expect(toastWith(page, 'Perfil atualizado.')).toHaveCount(0)
      // O nome salvo (header/sessão) segue o antigo; o campo guarda só o rascunho para repetir.
      await expect(accountShortcut(page, USERS.ana.name)).toBeVisible()
      expect(await mock.server((m) => m.snapshot().users.find((u) => u.id === 'usr_ana')?.name)).toBe(USERS.ana.name)

      await switchScenario(mock, 'default')
      await save.click()
      await expect(toastWith(page, 'Perfil atualizado.')).toBeVisible()
      expect(await mock.server((m) => m.snapshot().users.find((u) => u.id === 'usr_ana')?.name)).toBe('Carla Souza')
    })

    test('senha', async ({ page, mock }) => {
      await page.clock.install()
      await mock.open('/')
      await mock.login(USERS.ana)
      await page.goto('/profile')
      await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue(USERS.ana.name)
      const hash = () => mock.server((m) => m.snapshot().users.find((u) => u.id === 'usr_ana')?.passwordHash)
      const before = await hash()
      await page.getByRole('textbox', { name: 'Senha atual', exact: true }).fill(USERS.ana.password)
      await page.getByRole('textbox', { name: 'Nova senha', exact: true }).fill('NovaSenha@1')
      await page.getByRole('textbox', { name: 'Confirmar nova senha', exact: true }).fill('NovaSenha@1')
      const save = page.getByRole('button', { name: 'Salvar', exact: true })

      // O perfil é salvo antes da senha: o cenário liga só para o POST /me/password.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
      await save.click()
      await stepUntil(page, () => toastWith(page, 'Perfil atualizado.').isVisible())
      await switchScenario(mock, scenario)
      await page.clock.resume()

      await expect(alertWith(page, message)).toBeVisible()
      await expect(toastWith(page, 'Senha alterada.')).toHaveCount(0)
      await expect(page.getByRole('textbox', { name: 'Nova senha', exact: true })).toHaveValue('NovaSenha@1')
      expect(await hash()).toBe(before)

      await switchScenario(mock, 'default')
      await save.click()
      await expect(toastWith(page, 'Senha alterada.')).toBeVisible()
      expect(await hash()).not.toBe(before)
    })

    test('carteiras', async ({ page, mock }) => {
      await mock.open('/')
      await mock.login(USERS.ana)
      await page.goto('/wallets')
      const section = page.getByRole('region', { name: 'Carteira secundária' })
      await section.getByRole('button', { name: 'Editar' }).click()
      const form = page.getByRole('form', { name: 'Carteira Reserva' })
      await form.getByRole('textbox', { name: 'Apelido da carteira', exact: true }).fill('Cofre')
      await switchScenario(mock, scenario)
      const save = form.getByRole('button', { name: 'Salvar carteira' })
      await save.click()

      await expect(alertWith(page, message)).toBeVisible()
      await expect(toastWith(page, /Carteira (atualizada|cadastrada)/)).toHaveCount(0)
      // O formulário continua aberto, com o rascunho e o botão de salvar ao lado do erro.
      await expect(form.getByRole('textbox', { name: 'Apelido da carteira', exact: true })).toHaveValue('Cofre')
      expect(await mock.server((m) => m.snapshot().wallets.find((w) => w.id === 'wal_ana_2')?.label)).toBe('Reserva')

      await switchScenario(mock, 'default')
      await save.click()
      await expect(form).toBeHidden()
      await expect(section).toContainText('Cofre')
      expect(await mock.server((m) => m.snapshot().wallets.find((w) => w.id === 'wal_ana_2')?.label)).toBe('Cofre')
    })
  })
}

test('checkout: revalidação da cotação que falha não envia o pedido com a cotação antiga', async ({ page, mock }) => {
  await mock.open('/')
  await mock.login(USERS.ana)
  const orders = await mock.server((m) => m.snapshot().orders.length)
  await page.goto('/cart')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  const confirm = page.getByRole('button', { name: /Confirmar compra/ })
  await expect(confirm).toBeEnabled()

  await switchScenario(mock, 'write-client-error')
  await confirm.click()
  const error = alertWith(page, 'O servidor recusou a operação')
  await expect(error).toBeVisible()
  // Nenhuma tentativa aberta: o pedido nem chegou a ser enviado.
  expect(await page.evaluate(() => sessionStorage.getItem('jungle-order-attempt:usr_ana'))).toBeNull()
  expect(await mock.server((m) => m.snapshot().orders.length)).toBe(orders)

  await switchScenario(mock, 'default')
  await error.getByRole('button', { name: 'Tentar novamente' }).click()
  await confirm.click()
  await expect(page).toHaveURL(/\/orders\/ord_/)
})

test('"Tentar novamente" do favorito não sobrevive à troca de usuário', async ({ page, mock, context }) => {
  await page.clock.install()
  await mock.open('/')
  await mock.login(USERS.ana)
  // Outra aba, já pronta para Bruno entrar: a sessão sincroniza entre abas pelo evento `storage`.
  const other = await context.newPage()
  await other.goto('/login')
  await waitForApp(other)
  await other.getByLabel('E-mail', { exact: true }).fill(USERS.bruno.email)
  await other.getByLabel('Senha', { exact: true }).fill(USERS.bruno.password)

  await page.goto('/nfts/nft_003')
  const heart = page.getByRole('button', { name: /^Favoritar / }).filter({ visible: true }).first()
  await expect(heart).toHaveAttribute('aria-pressed', 'false')
  const brunoBefore = await mock.server((m) => m.snapshot().favorites.usr_bruno)
  await switchScenario(mock, 'write-server-error')
  await heart.click()
  const retry = toastWith(page, 'Não foi possível favoritar').getByRole('button', { name: 'Tentar novamente' })
  await expect(retry).toBeVisible()
  await switchScenario(mock, 'default')

  // Relógio congelado (vale para as duas abas): o toast (4 s) não some sozinho; avança em passos
  // de 100 ms só até Bruno entrar, bem abaixo disso.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
  await other.getByRole('button', { name: 'Entrar', exact: true }).click()
  const sessionUser = () => page.evaluate(() => (JSON.parse(localStorage.getItem('jungle-session:v1') ?? 'null') as { user: { id: string } } | null)?.user.id)
  await stepUntil(page, async () => (await sessionUser()) === 'usr_bruno')
  await page.clock.runFor(500)

  await expect(retry).toHaveCount(0)
  expect(await mock.server((m) => m.snapshot().favorites.usr_bruno)).toEqual(brunoBefore)
})
