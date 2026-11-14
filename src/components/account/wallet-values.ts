import { WalletProvider, type Wallet } from '@/contracts/account'
import { Network } from '@/contracts/common'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/labels'

export type DetailsValues = {
  displayName: string
  label: string
  username: string
  network: string
  profileName: string
  address: string
  secondaryAddress: string
  provider: string
  referralCode: string
  email: string
  ensName: string
}

export const EMPTY_DETAILS: DetailsValues = {
  displayName: '',
  label: '',
  username: '',
  network: '',
  profileName: '',
  address: '',
  secondaryAddress: '',
  provider: '',
  referralCode: '',
  email: '',
  ensName: '',
}

/** Campos do formulário preenchidos com os dados de uma carteira cadastrada. */
export const walletValues = (w: Wallet): Omit<DetailsValues, 'username'> => ({
  displayName: w.displayName,
  label: w.label,
  network: w.network,
  profileName: w.profileName,
  address: w.address,
  secondaryAddress: w.secondaryAddress,
  provider: w.provider,
  referralCode: w.referralCode,
  email: w.email,
  ensName: w.ensName,
})

export const NETWORK_OPTIONS = Network.options.map((n) => ({ value: n, label: NETWORK_LABEL[n] }))
export const PROVIDER_OPTIONS = WalletProvider.options.map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))
