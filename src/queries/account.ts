import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { keys } from '@/api/keys'
import type { ChangePasswordBody, UpdateProfileBody, User, WalletBody } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import { announce } from '@/lib/announcer'
import { useUser } from '@/session/session'
import { sessionStore } from '@/session/store'

const useUserId = () => useUser()?.id ?? 'anonymous'

export const useProfile = () => {
  const userId = useUserId()
  return useQuery({ queryKey: keys.profile(userId), queryFn: ({ signal }) => api.profile.get(signal) })
}

function useProfileMutation<V>(fn: (vars: V) => Promise<User>, message: string) {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => {
      qc.setQueryData(keys.profile(userId), user)
      sessionStore.setUser(user)
      announce(message)
    },
  })
}

export const useUpdateProfile = () => useProfileMutation((body: UpdateProfileBody) => api.profile.update(body), 'Perfil atualizado.')
export const useUpdateAvatar = () => useProfileMutation((dataUrl: string) => api.profile.avatar(dataUrl), 'Avatar atualizado.')
export const useRemoveAvatar = () => useProfileMutation((_: undefined) => api.profile.avatar(null), 'Avatar removido.')

export const useChangePassword = () =>
  useMutation({
    mutationFn: (body: ChangePasswordBody) => api.profile.changePassword(body),
    onSuccess: () => {
      announce('Senha alterada.')
    },
  })

export const useWallets = () => {
  const userId = useUserId()
  return useQuery({ queryKey: keys.wallets(userId), queryFn: ({ signal }) => api.wallets.list(signal) })
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ walletId, body }: { walletId?: string; body: WalletBody }) =>
      walletId ? api.wallets.update(walletId, body) : api.wallets.create(body),
    onSuccess: (data, { walletId }) => {
      qc.setQueryData(keys.wallets(userId), data)
      announce(walletId ? 'Carteira atualizada.' : 'Carteira cadastrada.')
    },
  })
}

/**
 * Conexão da carteira guardada pelo servidor, por usuário (sob `['me', userId]`): sobrevive ao refresh
 * e sai do cache na troca de conta; o logout a encerra no servidor junto com a sessão.
 */
export const useWalletConnection = () => {
  const userId = useUserId()
  return useQuery({ queryKey: keys.walletConnection(userId), queryFn: ({ signal }) => api.wallets.connection(signal) })
}

export function useConnectWallet() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ walletId, network }: { walletId: string; network: Network }) => api.wallets.connect(walletId, network),
    onSuccess: (connection) => qc.setQueryData(keys.walletConnection(userId), connection),
  })
}

export function useDisconnectWallet() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (walletId: string) => api.wallets.disconnect(walletId),
    onSuccess: () => qc.setQueryData(keys.walletConnection(userId), null),
  })
}
