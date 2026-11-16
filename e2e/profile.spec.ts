import type { Locator, Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

/**
 * §9.8: perfil (dados, avatar, senha) e carteiras, com os erros de validação do cliente e da API
 * visíveis, ligados ao campo (aria-describedby) e com o foco no primeiro campo inválido.
 * Toda alteração confirmada é conferida depois de um refresh (persistência no mock).
 */

/** PNG 1×1 válido. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

type User = (typeof USERS)[keyof typeof USERS]
type Mock = { open: (path: string) => Promise<void>; login: (user: User) => Promise<void> }

async function openProfile(page: Page, mock: Mock) {
  await mock.open('/')
  await mock.login(USERS.ana)
  await mock.open('/profile')
  await expect(page.getByRole('form', { name: 'Perfil do colecionador' })).toBeVisible()
}

/** O erro aparece, fica na descrição acessível do campo e o campo é marcado como inválido. */
async function expectFieldError(field: Locator, message: string | RegExp) {
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveAccessibleDescription(message)
}

test.describe('perfil do colecionador', () => {
  test('edita os dados com erros do cliente e da API ligados aos campos e persiste após refresh', async ({ page, mock }) => {
    await openProfile(page, mock)
    const form = page.getByRole('form', { name: 'Perfil do colecionador' })
    const name = form.getByLabel('Nome de exibição')
    const username = form.getByLabel('Nome de usuário')
    const email = form.getByLabel('E-mail')
    const save = form.getByRole('button', { name: 'Salvar' })

    // Validação do cliente: todos os erros aparecem e o foco vai para o primeiro.
    await name.fill('A')
    await username.fill('Ana Souza!')
    await email.fill('ana@')
    await save.click()
    await expectFieldError(name, 'Informe o nome de exibição')
    await expectFieldError(username, 'Use de 3 a 20 letras minúsculas, números ou _')
    await expectFieldError(email, 'E-mail inválido')
    await expect(name).toBeFocused()

    // Conflito devolvido pela API (409 USERNAME_TAKEN) cai no campo certo.
    await name.fill('Ana Prado')
    await username.fill('bruno_lima')
    await email.fill(USERS.ana.email)
    await save.click()
    await expectFieldError(username, 'Este nome de usuário já está em uso')
    await expect(username).toBeFocused()
    await expect(name).not.toHaveAttribute('aria-invalid')

    await username.fill('ana_prado')
    await form.getByLabel('Apelido da carteira').fill('Cofre')
    await save.click()
    await expect(page.getByText('Perfil atualizado.').first()).toBeAttached()
    await expect(username).not.toHaveAttribute('aria-invalid')

    await page.reload()
    await expect(form.getByLabel('Nome de exibição')).toHaveValue('Ana Prado')
    await expect(form.getByLabel('Nome de usuário')).toHaveValue('ana_prado')
    await expect(form.getByLabel('Apelido da carteira')).toHaveValue('Cofre')
  })

  test('troca o avatar e recusa tipo e tamanho inválidos com erro ligado ao botão', async ({ page, mock }) => {
    await openProfile(page, mock)
    const change = page.getByRole('button', { name: 'Alterar avatar' })
    const pick = async (file: { name: string; mimeType: string; buffer: Buffer }) => {
      const chooser = page.waitForEvent('filechooser')
      await change.click()
      await (await chooser).setFiles(file)
    }
    await expect(page.getByText('Sem avatar')).toBeAttached()

    await pick({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
    await expect(page.getByRole('alert').filter({ hasText: 'Use PNG, JPEG ou WebP' })).toBeVisible()
    await expect(change).toHaveAccessibleDescription('Use PNG, JPEG ou WebP')

    // ~1,1 MB declarado como PNG: passa do limite de 1 MB.
    await pick({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.alloc(1_100_000)]) })
    await expect(change).toHaveAccessibleDescription('Imagem acima de 1 MB')
    await expect(page.getByText('Sem avatar')).toBeAttached()

    await pick({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    const avatar = page.getByRole('img', { name: 'Avatar de Ana Souza' })
    await expect(avatar).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: /Use PNG|acima de 1 MB/ })).toHaveCount(0)
    await expect(change).toHaveAccessibleDescription('PNG, JPEG ou WebP até 1 MB.')

    await page.reload()
    await expect(avatar).toBeVisible()

    await page.getByRole('button', { name: 'Remover avatar' }).click()
    await expect(page.getByText('Sem avatar')).toBeAttached()
    await page.reload()
    await expect(page.getByText('Sem avatar')).toBeAttached()
    await expect(avatar).toHaveCount(0)
  })

  test('troca a senha com senha atual errada, confirmação diferente e regra de força', async ({ page, mock }) => {
    await openProfile(page, mock)
    const form = page.getByRole('form', { name: 'Perfil do colecionador' })
    const current = form.getByLabel('Senha atual', { exact: true })
    const next = form.getByLabel('Nova senha', { exact: true })
    const confirm = form.getByLabel('Confirmar nova senha', { exact: true })
    const save = form.getByRole('button', { name: 'Salvar' })

    // Força: a dica continua na descrição junto do erro.
    await current.fill(USERS.ana.password)
    await next.fill('curta1')
    await confirm.fill('curta1')
    await save.click()
    await expectFieldError(next, /Mínimo de 8 caracteres$/)
    await expect(next).toHaveAccessibleDescription(/^Mínimo de 8 caracteres, com letras e números\./)
    await expect(next).toBeFocused()
    await next.fill('somenteletras')
    await confirm.fill('somenteletras')
    await save.click()
    await expectFieldError(next, /Inclua ao menos um número$/)

    // Confirmação diferente.
    await next.fill('NovaSenha@456')
    await confirm.fill('NovaSenha@457')
    await save.click()
    await expectFieldError(confirm, 'As senhas não conferem')
    await expect(confirm).toBeFocused()
    await expect(next).not.toHaveAttribute('aria-invalid')

    // Senha atual errada: recusada pela API (422 WRONG_PASSWORD).
    await current.fill('Errada@999')
    await confirm.fill('NovaSenha@456')
    await save.click()
    await expectFieldError(current, 'Senha atual incorreta')
    await expect(current).toBeFocused()

    await current.fill(USERS.ana.password)
    await save.click()
    await expect(page.getByText('Senha alterada.').first()).toBeAttached()
    await expect(current).toHaveValue('')

    // A senha antiga deixa de valer; a nova entra.
    await page.getByRole('navigation', { name: 'Menu da conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/login')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' })).toBeVisible()
    await page.getByLabel('Senha', { exact: true }).fill('NovaSenha@456')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Ana ?: menu da conta$/ }).or(page.getByRole('link', { name: 'Perfil de Ana Souza' }))).toBeVisible()
  })
})

test.describe('carteiras', () => {
  async function openWallets(page: Page, mock: Mock, user: User) {
    await mock.open('/')
    await mock.login(user)
    await mock.open('/wallets')
    await expect(page.getByRole('heading', { name: 'Carteira secundária' })).toBeVisible()
  }
  const secondary = (page: Page) => page.getByRole('region', { name: 'Carteira secundária' })

  test('adiciona a carteira secundária com endereço inválido e duplicado recusados', async ({ page, mock }) => {
    await openWallets(page, mock, USERS.bruno)
    await expect(secondary(page).getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()

    // "Igual à carteira principal" copia os dados de perfil; apelido e endereço ficam vazios.
    await secondary(page).getByLabel('Igual à carteira principal').check()
    await secondary(page).getByRole('button', { name: 'Adicionar' }).click()
    const form = page.getByRole('form', { name: 'Nova carteira secundária' })
    const label = form.getByLabel('Apelido da carteira')
    const address = form.getByLabel('Endereço da carteira')
    await expect(form.getByLabel('Nome de exibição')).toHaveValue('Bruno Lima')
    await expect(label).toHaveValue('')
    await expect(address).toHaveValue('')

    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(label, 'Informe o apelido da carteira')
    await expectFieldError(address, 'Endereço deve ter 0x + 40 caracteres hexadecimais')
    await expect(label).toBeFocused()

    await label.fill('Reserva')
    await address.fill('0x12345')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(address, 'Endereço deve ter 0x + 40 caracteres hexadecimais')
    await expect(address).toBeFocused()
    await expect(label).not.toHaveAttribute('aria-invalid')

    // Mesmo endereço da principal (com outra caixa): a API recusa como duplicada.
    await address.fill('0x' + 'D4'.repeat(20))
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(address, 'Este endereço já está cadastrado')
    await expect(address).toBeFocused()

    await address.fill('0x' + 'e5'.repeat(20))
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form).toHaveCount(0)
    await expect(secondary(page).getByText('Reserva')).toBeVisible()
    await expect(secondary(page).getByText('0xe5e5…e5e5')).toBeVisible()

    await page.reload()
    await expect(secondary(page).getByText('Reserva')).toBeVisible()
    await expect(secondary(page).getByText('0xe5e5…e5e5')).toBeVisible()
    // Principal + secundária: o limite fecha o "Adicionar" da principal.
    await expect(page.getByRole('region', { name: 'Carteira principal' }).getByRole('button', { name: 'Adicionar' })).toHaveCount(0)
  })

  test('edita as carteiras principal e secundária com validação e persiste após refresh', async ({ page, mock }) => {
    await openWallets(page, mock, USERS.ana)
    const primary = page.getByRole('form', { name: 'Carteira Principal', exact: true })
    const primaryAddress = primary.getByLabel('Endereço da carteira')
    await expect(primaryAddress).toHaveValue('0xA91F3c5d7e9b1a2c4d6e8f0a1b3c5d7e9f0bE82C')

    // Endereço da secundária na principal: duplicada.
    await primaryAddress.fill('0x' + 'c3'.repeat(20))
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(primaryAddress, 'Este endereço já está cadastrado')
    await primaryAddress.fill('0xZZ')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(primaryAddress, 'Endereço deve ter 0x + 40 caracteres hexadecimais')
    await expect(primaryAddress).toBeFocused()
    await primaryAddress.fill('0x' + 'ab'.repeat(20))
    await primary.getByRole('combobox', { name: 'Rede', exact: true }).selectOption('polygon')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira atualizada.').first()).toBeAttached()

    await secondary(page).getByRole('button', { name: 'Editar' }).click()
    const form = page.getByRole('form', { name: 'Carteira Reserva' })
    await form.getByLabel('Apelido da carteira').fill('')
    await form.getByLabel('ENS ou carteira secundária (opcional)').fill('não é ens')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(form.getByLabel('Apelido da carteira'), 'Informe o apelido da carteira')
    await expectFieldError(form.getByLabel('ENS ou carteira secundária (opcional)'), 'Use um nome ENS (ex.: nome.eth) ou um endereço 0x')
    await expect(form.getByLabel('Apelido da carteira')).toBeFocused()
    await form.getByLabel('Apelido da carteira').fill('Cofre frio')
    await form.getByLabel('ENS ou carteira secundária (opcional)').fill('cofre.kurio.eth')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form).toHaveCount(0)
    await expect(secondary(page).getByText('Cofre frio')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira Principal', exact: true }).getByLabel('Endereço da carteira')).toHaveValue('0x' + 'ab'.repeat(20))
    await expect(page.getByRole('form', { name: 'Carteira Principal', exact: true }).getByRole('combobox', { name: 'Rede', exact: true })).toHaveValue('polygon')
    await expect(secondary(page).getByText('Cofre frio')).toBeVisible()
    await expect(secondary(page).getByText('cofre.kurio.eth')).toBeVisible()
  })
})
