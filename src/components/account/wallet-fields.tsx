import type { ComponentProps } from 'react'
import { cn } from 'cn'
import type { FieldErrors } from '@/lib/forms'
import { controlClass } from './form-classes'
import { EnsControl, FormField, SelectControl } from './form-field'
import { NETWORK_OPTIONS, PROVIDER_OPTIONS, type DetailsValues } from './wallet-values'

const LAYOUT = {
  // Frame Carteiras: colunas de 417 px com 28 de vão, linhas a 24, input sobe 4 px sobre o label.
  wallet: { grid: 'gap-y-6 lg:grid-cols-2 lg:gap-x-7', label: '-mb-1', offset: 'lg:pt-[25px]' },
  // Frame Pagamento: colunas de 370 px com 24 de vão, linhas a 12.
  checkout: { grid: 'gap-y-3 md:grid-cols-2 md:gap-x-6', label: '', offset: 'md:pt-[29px]' },
}

/**
 * Os dez campos de carteira do layout (Carteiras e Pagamento), na ordem do frame: no Pagamento
 * "Apelido da carteira" dá lugar a "Nome de usuário" e o endereço reflete a carteira escolhida.
 */
export function WalletDetailsFields({
  values,
  onChange,
  errors,
  variant,
}: {
  values: DetailsValues
  onChange: (name: keyof DetailsValues, value: string) => void
  errors: FieldErrors
  variant: 'wallet' | 'checkout'
}) {
  const layout = LAYOUT[variant]
  const text = (name: keyof DetailsValues, label: string, extra: Partial<ComponentProps<'input'>> = {}) => (
    <FormField label={label} required error={errors[name]} labelClassName={layout.label}>
      {(control) => (
        <input
          {...control}
          name={name}
          value={values[name]}
          onChange={(e) => onChange(name, e.target.value)}
          className={controlClass}
          {...extra}
        />
      )}
    </FormField>
  )
  return (
    <div className={cn('grid', layout.grid)}>
      {text('displayName', 'Nome de exibição', { autoComplete: 'nickname' })}
      {variant === 'wallet' ? text('label', 'Apelido da carteira') : text('username', 'Nome de usuário', { autoComplete: 'username' })}

      <FormField label="Rede" required error={errors.network} labelClassName={layout.label}>
        {(control) => (
          <SelectControl
            {...control}
            name="network"
            value={values.network}
            onChange={(e) => onChange('network', e.target.value)}
            placeholder="Selecione uma rede"
            options={NETWORK_OPTIONS}
          />
        )}
      </FormField>
      {text('profileName', 'Nome do perfil')}

      {text('address', 'Endereço da carteira', {
        placeholder: 'Endereço 0x da carteira',
        spellCheck: false,
        autoComplete: 'off',
        readOnly: variant === 'checkout',
        className: cn(controlClass, variant === 'checkout' && 'text-muted-foreground'),
      })}
      <FormField label="ENS ou carteira secundária (opcional)" srLabel error={errors.secondaryAddress} className={layout.offset}>
        {(control) => (
          <input
            {...control}
            name="secondaryAddress"
            value={values.secondaryAddress}
            onChange={(e) => onChange('secondaryAddress', e.target.value)}
            placeholder="ENS ou carteira secundária (opcional)"
            spellCheck={false}
            autoComplete="off"
            className={controlClass}
          />
        )}
      </FormField>

      <FormField label="Tipo de carteira" required error={errors.provider} labelClassName={layout.label}>
        {(control) => (
          <SelectControl
            {...control}
            name="provider"
            value={values.provider}
            onChange={(e) => onChange('provider', e.target.value)}
            placeholder="Selecione uma carteira"
            options={PROVIDER_OPTIONS}
          />
        )}
      </FormField>
      {text('referralCode', 'Código de indicação', { autoComplete: 'off', spellCheck: false })}

      {text('email', 'E-mail', { type: 'email', autoComplete: 'email' })}
      <FormField label="Nome ENS" required error={errors.ensName} labelClassName={layout.label}>
        {(control) => <EnsControl control={control} value={values.ensName} onChange={(v) => onChange('ensName', v)} />}
      </FormField>
    </div>
  )
}
