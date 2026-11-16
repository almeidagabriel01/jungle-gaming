import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'
import { logout } from './helpers/account'

const NOTE = 'Entregar na carteira principal'
const draft = (page: Page, userId: string) => page.evaluate((id) => sessionStorage.getItem(`jungle-checkout-draft:${id}`), userId)

/** Observação do pagamento (no mobile fica sob "Editar dados"). */
async function noteField(page: Page) {
  const edit = page.getByRole('button', { name: 'Editar dados' })
  if (await edit.isVisible()) await edit.click()
  return page.getByLabel('Observação do colecionador (opcional)')
}

test.describe('rascunho do checkout', () => {
  test('logout apaga o rascunho: ao voltar na mesma aba, o formulário vem vazio', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await page.goto('/cart')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await (await noteField(page)).fill(NOTE)
    await expect.poll(() => draft(page, USERS.ana.id)).toContain(NOTE)

    await logout(page, USERS.ana.name)
    expect(await draft(page, USERS.ana.id)).toBeNull()

    await mock.login(USERS.ana)
    await page.goto('/checkout')
    await expect(await noteField(page)).toHaveValue('')
  })

  test('login de outro usuário apaga o rascunho dos outros e mantém o dele', async ({ page, mock }) => {
    await mock.open('/')
    // Rascunhos deixados na aba (ex.: a sessão da Ana expirou sem logout).
    await page.evaluate(
      ([ana, bruno]) => {
        sessionStorage.setItem(`jungle-checkout-draft:${ana}`, JSON.stringify({ note: 'da Ana' }))
        sessionStorage.setItem(`jungle-checkout-draft:${bruno}`, JSON.stringify({ note: 'do Bruno' }))
      },
      [USERS.ana.id, USERS.bruno.id],
    )

    await mock.login(USERS.bruno)
    expect(await draft(page, USERS.ana.id)).toBeNull()
    expect(await draft(page, USERS.bruno.id)).toContain('do Bruno')
  })
})
