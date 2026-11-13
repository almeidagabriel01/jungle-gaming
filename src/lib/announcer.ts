import { useSyncExternalStore } from 'react'

/**
 * Feedback acessível de mutations e eventos em tempo real: uma fila de avisos lida por
 * uma região `aria-live` global. `topic` permite que telas mostrem só o que lhes diz respeito
 * (ex.: o carrinho exibe avisos de mudança de preço dos seus itens).
 */
export type Notice = { id: number; message: string; tone: 'info' | 'error'; topic?: 'cart' | 'order' }

let notices: Notice[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

export function announce(message: string, options: { tone?: Notice['tone']; topic?: Notice['topic'] } = {}) {
  notices = [...notices.slice(-19), { id: ++seq, message, tone: options.tone ?? 'info', topic: options.topic }]
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
