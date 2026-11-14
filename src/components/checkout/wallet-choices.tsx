import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { cn } from 'cn'
import { roundCheckClass } from '@/components/account/form-classes'
import { WalletIcon } from '@/components/icons/account-icons'
import type { Wallet, WalletProvider } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import { PROVIDER_LABEL } from '@/lib/labels'

/** Rádio do layout: anel primário (no mobile, anel `border-soft` quando desmarcado). */
const radioClass = cn(roundCheckClass, 'max-md:not-checked:border-border-soft')

const NETWORK_LINE: Record<Network, string> = { ethereum: 'Rede principal Ethereum', polygon: 'Rede Polygon', solana: 'Rede Solana' }
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/**
 * "Carteira conectada" (frame mobile): carteiras cadastradas como cartões de rádio — apelido,
 * ENS secundário ou endereço abreviado e rede. O menu ⋮ leva ao cadastro da carteira.
 */
export function WalletCards({ wallets, value, onChange, disabled }: { wallets: Wallet[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const group = useId()
  return (
    <div role="radiogroup" aria-label="Carteira de pagamento" className="grid gap-5">
      {wallets.map((w) => {
        const checked = w.id === value
        return (
          <div
            key={w.id}
            className={cn(
              'relative flex h-[93px] items-start gap-[19px] rounded-[14px] bg-card pt-[15px] pl-[19px] transition-shadow duration-300',
              checked && 'shadow-[0_20px_20px_rgb(10_6_4/0.45)]',
            )}
          >
            <input
              id={`${group}-${w.id}`}
              type="radio"
              name={group}
              value={w.id}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(w.id)}
              className={cn(radioClass, 'relative z-10 mt-[24px]')}
            />
            <label htmlFor={`${group}-${w.id}`} className="grid min-w-0 flex-1 cursor-pointer gap-[7px] pr-12 after:absolute after:inset-0 after:content-['']">
              <span className="text-base leading-4 font-bold">{w.label}</span>
              <span className="text-sm leading-[22px] text-muted-foreground">
                <span className="block truncate">{w.secondaryAddress || shortAddress(w.address)}</span>
                <span className="block">{NETWORK_LINE[w.network]}</span>
              </span>
            </label>
            <Link
              to="/wallets"
              aria-label={`Gerenciar carteira ${w.label}`}
              className="absolute top-[30px] right-[11px] z-10 grid h-8 w-6 place-items-center rounded-sm text-subtle transition-colors hover:text-accent-text"
            >
              <span aria-hidden="true" className="grid gap-[3px]">
                <span className="size-[3px] rounded-full bg-current" />
                <span className="size-[3px] rounded-full bg-current" />
                <span className="size-[3px] rounded-full bg-current" />
              </span>
            </Link>
          </div>
        )
      })}
    </div>
  )
}

const PROVIDERS: { value: WalletProvider; mark: string }[] = [
  { value: 'walletconnect', mark: 'W' },
  { value: 'metamask', mark: 'M' },
  { value: 'coinbase', mark: '' },
]

/**
 * "Carteira e rede": provedor usado para conectar. Desktop: linhas com borda e rádio à esquerda; a
 * de WalletConnect mostra a faixa de carteiras compatíveis (é o protocolo que as conecta). Mobile:
 * cartões com a marca à esquerda e o rádio à direita.
 */
export function ProviderOptions({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: string
  onChange: (p: WalletProvider) => void
  disabled?: boolean
  labelledBy: string
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-4">
      {PROVIDERS.map(({ value: provider, mark }) => {
        const checked = provider === value
        return (
          <label
            key={provider}
            className={cn(
              'flex cursor-pointer items-center transition-[border-color,box-shadow] duration-200',
              'h-[65px] gap-[11px] rounded-[15px] bg-card pr-4 pl-3.5 shadow-[0_0_20px_rgb(10_6_4/0.45)]',
              'md:h-[45px] md:gap-2.5 md:rounded-[3px] md:border md:bg-transparent md:pr-3 md:pl-3 md:shadow-none',
              checked ? 'md:border-primary' : 'md:border-border hover:md:border-border-soft',
            )}
          >
            <input
              type="radio"
              name="checkout-provider"
              value={provider}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(provider)}
              className={cn(radioClass, 'order-last ml-auto md:order-none md:ml-0', provider === 'coinbase' && 'md:ml-1')}
            />
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-raised text-sm leading-[18px] font-bold text-accent-text md:hidden">
              {mark || <WalletIcon className="size-6 text-primary" />}
            </span>
            {provider === 'walletconnect' ? (
              <>
                <span className="text-sm leading-4 md:sr-only">{PROVIDER_LABEL[provider]}</span>
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-2 rounded-md border border-border-soft bg-band px-2 py-2 text-[9px] leading-3 font-bold tracking-[0.1px] text-accent-text max-md:hidden"
                >
                  METAMASK <span>•</span> WALLETCONNECT <span>•</span> COINBASE
                </span>
              </>
            ) : (
              <span className={cn('text-sm leading-4 md:text-[15px] md:leading-5', provider === 'coinbase' && 'md:ml-1.5')}>{PROVIDER_LABEL[provider]}</span>
            )}
          </label>
        )
      })}
    </div>
  )
}
