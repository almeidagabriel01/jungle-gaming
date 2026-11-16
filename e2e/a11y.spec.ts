import type { Locator, Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'
import { accountEntry, cartLink } from './helpers/account'

const containsFocus = (container: Locator) => container.evaluate((el) => el.contains(document.activeElement))

/** Tab e Shift+Tab percorrem o diálogo várias voltas sem o foco escapar dele. */
async function expectFocusTrapped(page: Page, dialog: Locator) {
  const stops = await dialog.evaluate(
    (el) => el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])').length,
  )
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press(key)
      expect(await containsFocus(dialog), `${key} #${i + 1} manteve o foco no diálogo`).toBe(true)
    }
  }
}

test.describe('navegação por teclado', () => {
  test('o atalho "Pular para o conteúdo" é o primeiro foco e leva ao conteúdo principal', async ({ page, mock }) => {
    await mock.open('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#conteudo')).toBeFocused()
  })

  test('login, adicionar ao carrinho, alterar quantidade e remover só com o teclado', async ({ page, mock }) => {
    await mock.open('/login')
    await page.getByLabel('E-mail', { exact: true }).focus()
    await page.keyboard.type(USERS.ana.email)
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Senha', { exact: true })).toBeFocused()
    await page.keyboard.type(USERS.ana.password)
    await page.keyboard.press('Enter')
    await expect(accountEntry(page, USERS.ana.name)).toBeVisible()

    await page.goto('/nfts/nft_003')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).focus()
    await page.keyboard.press('Enter')
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 18 itens')

    await cartLink(page).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/cart$/)
    const items = page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('article')
    await expect(items).toHaveCount(4)

    const stepper = items.first().getByRole('group', { name: /^Quantidade de / })
    const increase = stepper.getByRole('button', { name: 'Aumentar quantidade' })
    await increase.focus()
    await page.keyboard.press('Enter')
    await expect(stepper.locator('output')).toHaveText('3')
    // O botão fica desabilitado durante a mutation; ao reabilitar, o foco continua nele.
    await expect(increase).toBeEnabled()
    await expect(increase).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(stepper.locator('output')).toHaveText('4')

    const removeFirst = items.first().getByRole('button', { name: /^Remover / })
    await removeFirst.focus()
    await page.keyboard.press('Enter')
    await expect(items).toHaveCount(3)
    // A linha removida sai do DOM: o foco vai para o "Remover" da próxima linha, nunca se perde no body.
    await expect(items.first().getByRole('button', { name: /^Remover / })).toBeFocused()

    // Sem próxima linha, vai para a anterior.
    await items.last().getByRole('button', { name: /^Remover / }).focus()
    await page.keyboard.press('Enter')
    await expect(items).toHaveCount(2)
    await expect(items.last().getByRole('button', { name: /^Remover / })).toBeFocused()

    // Esvaziada a lista, o foco vai para o título do carrinho.
    for (const count of [1, 0]) {
      await page.keyboard.press('Enter')
      await expect(items).toHaveCount(count)
    }
    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs', level: 1 })).toBeFocused()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})

test.describe('foco ao remover itens de lista', () => {
  test('lista de interesse: o foco vai para o card seguinte, depois o anterior e, vazia, para o título', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await page.goto('/favorites')
    const hearts = page.getByTestId('favorites-list').getByRole('button', { name: /dos favoritos$/ })
    await expect(hearts).toHaveCount(3)

    await hearts.first().focus()
    await page.keyboard.press('Enter')
    await expect(hearts).toHaveCount(2)
    await expect(hearts.first()).toBeFocused()

    await hearts.last().focus()
    await page.keyboard.press('Enter')
    await expect(hearts).toHaveCount(1)
    await expect(hearts.first()).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page.getByText('Você ainda não favoritou nenhum NFT.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lista de interesse', level: 1 })).toBeFocused()
    // A remoção é otimista: espera o servidor confirmar a última.
    await expect.poll(() => mock.server((m, id) => m.snapshot().favorites[id], USERS.ana.id)).toEqual([])
  })
})

test.describe('foco em diálogos e gaveta', () => {
  test('busca: abre pelo teclado com foco no campo, prende o foco e devolve ao gatilho no Escape', async ({ page, mock }) => {
    await mock.open('/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('searchbox', { name: 'Termo de busca' })).toBeFocused()
    await expectFocusTrapped(page, dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    // Enviar a busca também fecha o diálogo e leva ao catálogo filtrado.
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await page.keyboard.type('golden')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/q=golden/)
  })

  test('gaveta de filtros (mobile): prende o foco e devolve ao botão que a abriu', async ({ page, mock }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'A gaveta de filtros só existe no mobile; no desktop os filtros ficam na lateral.')
    await mock.open('/')
    const trigger = page.getByRole('button', { name: 'Filtros e ordenação' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    expect(await containsFocus(drawer)).toBe(true)
    await expectFocusTrapped(page, drawer)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('modal de login (desktop): foco começa no e-mail e fica preso no modal', async ({ page, mock }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'No mobile o login é uma tela cheia, não um modal.')
    await mock.open('/login')
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused()
    await expectFocusTrapped(page, dialog)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('validação de formulários', () => {
  test('login vazio: erros ligados aos campos e foco no primeiro inválido', async ({ page, mock }) => {
    await mock.open('/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByLabel('E-mail', { exact: true })
    const password = page.getByLabel('Senha', { exact: true })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('E-mail inválido')
    await expect(password).toHaveAttribute('aria-invalid', 'true')
    await expect(password).toHaveAccessibleDescription('Informe a senha')

    // Corrigido e reenviado, o erro some do campo.
    await email.fill('nao-e-email')
    await password.fill('x')
    await page.keyboard.press('Enter')
    await expect(email).toHaveAccessibleDescription('E-mail inválido')
    await expect(password).not.toHaveAttribute('aria-invalid')
  })

  test('cadastro: cada regra aparece no próprio campo, junto da dica, e o foco vai ao primeiro erro', async ({ page, mock }) => {
    await mock.open('/register')
    await page.getByLabel('Nome de usuário').fill('Ana Souza')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@')
    await page.getByLabel('Senha', { exact: true }).fill('curta')
    await page.getByLabel('Confirmar senha').fill('outra')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    const username = page.getByLabel('Nome de usuário')
    await expect(username).toBeFocused()
    await expect(username).toHaveAccessibleDescription('Use de 3 a 20 letras minúsculas, números ou _')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAccessibleDescription('E-mail inválido')
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAccessibleDescription('Mínimo de 8 caracteres, com letras e números. Mínimo de 8 caracteres')
    await expect(username).toHaveAttribute('aria-invalid', 'true')

    // Com o resto válido, a confirmação divergente é o erro que recebe o foco.
    await username.fill('ana_nova')
    await page.getByLabel('E-mail', { exact: true }).fill('ana.nova@jungle.test')
    await page.getByLabel('Senha', { exact: true }).fill('Segredo123')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    const confirm = page.getByLabel('Confirmar senha')
    await expect(confirm).toBeFocused()
    await expect(confirm).toHaveAttribute('aria-invalid', 'true')
    await expect(confirm).toHaveAccessibleDescription('As senhas não conferem')
    await expect(username).not.toHaveAttribute('aria-invalid')
    expect(await mock.server((m) => m.snapshot().users.length)).toBe(2)
  })
})
