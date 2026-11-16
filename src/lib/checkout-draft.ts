import { z } from 'zod'

/**
 * Rascunho do checkout por usuário (sessionStorage da aba): sobrevive a refresh e a expiração de sessão.
 * Guarda só o que o usuário mudou, como texto livre (um campo pela metade não pode invalidar o resto);
 * a validação acontece no envio. Logout e login de outro usuário o apagam (dado pessoal em navegador
 * compartilhado), como a tentativa de pedido.
 */
const Draft = z.record(z.string(), z.string()).catch({})
export type CheckoutDraft = Record<string, string>

const DRAFT_PREFIX = 'jungle-checkout-draft:'
const draftKey = (userId: string) => `${DRAFT_PREFIX}${userId}`

export const checkoutDraft = {
  load(userId: string): CheckoutDraft {
    try {
      return Draft.parse(JSON.parse(sessionStorage.getItem(draftKey(userId)) ?? '{}'))
    } catch {
      return {}
    }
  },
  save(userId: string, draft: CheckoutDraft) {
    try {
      sessionStorage.setItem(draftKey(userId), JSON.stringify(draft))
    } catch {
      // Storage bloqueado ou cheio: o checkout segue, só sem retomar o rascunho.
    }
  },
  /** Apaga os rascunhos de todos menos `keep` (login de outro usuário) ou todos (logout). */
  clearAllExcept(keep?: string) {
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(DRAFT_PREFIX) && (!keep || key !== draftKey(keep))) sessionStorage.removeItem(key)
      }
    } catch {
      // Storage bloqueado (modo privado): não há rascunho guardado, e login/logout seguem.
    }
  },
}
