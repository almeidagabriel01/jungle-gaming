import { announce } from './announcer'

/**
 * Ações do layout fora do escopo da entrega (§3: editoriais, suporte, login social…).
 * Respondem com um aviso honesto em vez de simular sucesso.
 */
export const unavailable = (feature: string) => {
  announce(`${feature} não está disponível nesta demonstração.`)
}
