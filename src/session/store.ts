import { z } from 'zod'
import { Tokens, User } from '@/contracts/account'

/**
 * Fonte única da sessão no cliente. Persiste em localStorage (recuperável após refresh)
 * e sincroniza entre abas pelo evento `storage`. Quem precisa reagir a troca de usuário
 * (cache, socket, router) assina `subscribe` — um único caminho para login, logout,
 * expiração e troca em outra aba.
 */
const SESSION_KEY = 'jungle-session:v1'
const GUEST_KEY = 'jungle-guest-id'

const Stored = z.object({ user: User, tokens: Tokens })
export type SessionState = z.infer<typeof Stored> | null

function read(): SessionState {
  try {
    const parsed = Stored.safeParse(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

let state: SessionState = read()
const listeners = new Set<(next: SessionState, prev: SessionState) => void>()

function emit(next: SessionState) {
  const prev = state
  state = next
  for (const listener of listeners) listener(next, prev)
}

window.addEventListener('storage', (event) => {
  if (event.key === SESSION_KEY) emit(read())
})

export const sessionStore = {
  get: () => state,
  userId: () => state?.user.id ?? null,
  set(next: NonNullable<SessionState>) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    emit(next)
  },
  setUser(user: User) {
    if (state) this.set({ ...state, user })
  },
  clear() {
    localStorage.removeItem(SESSION_KEY)
    emit(null)
  },
  subscribe(listener: (next: SessionState, prev: SessionState) => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Identidade do visitante para o carrinho anônimo. */
  guestId(): string {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  },
  /** Após logout o visitante recomeça com carrinho vazio. */
  rotateGuestId() {
    localStorage.setItem(GUEST_KEY, crypto.randomUUID())
  },
}

/** Chave do dono do carrinho/cotação no cache: isola visitante e cada usuário. */
export const ownerKey = () => {
  const userId = sessionStore.userId()
  return userId ? `user:${userId}` : `guest:${sessionStore.guestId()}`
}
