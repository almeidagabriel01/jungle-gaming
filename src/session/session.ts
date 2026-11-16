import { useMutation, type QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { setSessionExpiredHandler } from '@/api/client'
import { api } from '@/api/endpoints'
import { keys } from '@/api/keys'
import type { AuthResponse, LoginBody, RegisterBody } from '@/contracts/account'
import { announce, clearNotices } from '@/lib/announcer'
import { checkoutDraft } from '@/lib/checkout-draft'
import { queryClient } from '@/lib/query-client'
import { orderAttempt } from '@/queries/orders'
import { ownerKey, sessionStore } from './store'

export const PRIVATE_PATHS = ['/checkout', '/orders', '/profile', '/wallets', '/favorites']
export const isPrivatePath = (pathname: string) => PRIVATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/**
 * Liga a sessão ao resto do app. Troca de usuário (login, logout, expiração ou outra aba)
 * remove do cache tudo o que é privado ou ligado ao dono anterior e reavalia as rotas.
 */
export function bindSession(qc: QueryClient, router: AnyRouter) {
  const unsubscribe = sessionStore.subscribe((next, prev) => {
    if (next?.user.id === prev?.user.id) return
    qc.removeQueries({ queryKey: ['me'] })
    qc.removeQueries({ queryKey: ['cart'] })
    qc.removeQueries({ queryKey: keys.quoteAll })
    qc.removeQueries({ queryKey: ['session'] })
    clearNotices()
    void router.invalidate()
  })

  setSessionExpiredHandler(() => {
    const { pathname, href } = router.state.location
    sessionStore.clear()
    if (isPrivatePath(pathname)) {
      void router.navigate({ to: '/login', search: { redirect: href, reason: 'expired' } })
    } else {
      announce('Sua sessão expirou. Entre novamente para acessar sua conta.', { tone: 'error' })
    }
  })
  return unsubscribe
}

/** Valida a sessão salva uma vez por carregamento (recupera o usuário após refresh). */
export async function ensureSession(): Promise<boolean> {
  const session = sessionStore.get()
  if (!session) return false
  try {
    const { user } = await queryClient.query({
      queryKey: ['session', session.user.id],
      queryFn: ({ signal }) => api.auth.session(signal),
      staleTime: 'static',
    })
    sessionStore.setUser(user)
    return true
  } catch {
    return sessionStore.get() !== null
  }
}

const subscribe = (listener: () => void) => sessionStore.subscribe(listener)
export const useSession = () => useSyncExternalStore(subscribe, sessionStore.get)
export const useUser = () => useSession()?.user ?? null

/** Autentica e preserva o carrinho do visitante, mesclando-o ao do usuário. */
async function signIn(auth: AuthResponse) {
  const guestId = sessionStore.guestId()
  orderAttempt.clearAllExcept(auth.user.id)
  checkoutDraft.clearAllExcept(auth.user.id)
  sessionStore.set(auth)
  try {
    queryClient.setQueryData(keys.cart(ownerKey()), await api.cart.merge(guestId))
  } catch {
    // O carrinho segue recuperável: a consulta normal busca o do usuário.
    announce('Não foi possível juntar o carrinho de visitante. Tente adicionar os itens novamente.', { tone: 'error' })
  }
}

export const useLogin = () =>
  useMutation({ mutationFn: async (body: LoginBody) => signIn(await api.auth.login(body)) })

export const useRegister = () =>
  useMutation({ mutationFn: async (body: RegisterBody) => signIn(await api.auth.register(body)) })

export const useLogout = () =>
  useMutation({
    mutationFn: async () => {
      const session = sessionStore.get()
      // Encerrar no servidor é melhor esforço: localmente a sessão termina de qualquer forma.
      if (session) await api.auth.logout(session.tokens.refreshToken).catch(() => undefined)
      sessionStore.rotateGuestId()
      orderAttempt.clearAllExcept()
      checkoutDraft.clearAllExcept()
      sessionStore.clear()
    },
  })
