import { useSyncExternalStore } from 'react'
import { sessionStore } from '@/session/store'

/**
 * Feedback acessível de mutations e eventos em tempo real: uma fila de avisos lida por
 * uma região `aria-live` global. `topic` permite que telas mostrem só o que lhes diz respeito
 * (ex.: o carrinho exibe avisos de mudança de preço dos seus itens).
 */
export type Notice = { id: number; message: string; tone: 'info' | 'error'; topic?: 'cart' | 'order'; retry?: () => void }

let notices: Notice[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

/**
 * `retry`: falha cuja ação some da tela (ex.: toggle desfeito) ganha "Tentar novamente" no aviso.
 * Só vale na sessão em que a falha ocorreu: com outro usuário (ou sem sessão) não executa, e a
 * troca de usuário limpa os avisos (`clearNotices`), o que também fecha o toast.
 */
export function announce(message: string, options: Partial<Pick<Notice, 'tone' | 'topic' | 'retry'>> = {}) {
  const { retry } = options
  const owner = sessionStore.userId()
  const guarded = retry && (() => sessionStore.userId() === owner && retry())
  notices = [...notices.slice(-19), { id: ++seq, message, tone: options.tone ?? 'info', topic: options.topic, retry: guarded }]
  emit()
}

export function dismissNotice(id: number) {
  notices = notices.filter((n) => n.id !== id)
  emit()
}

export function clearNotices() {
  notices = []
  emit()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useNotices = () => useSyncExternalStore(subscribe, () => notices)
