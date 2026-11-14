import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from 'cn'
import { ArrowDownIcon } from '@/components/icons/account-icons'
import { controlClass } from './form-classes'

export type ControlProps = { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; required?: boolean }

/**
 * Campo dos formulários de conta e pagamento (frames Carteiras, Perfil e Pagamento): label de 15 px
 * com o asterisco coral do layout (decorativo; o campo leva `required`), controle e erro associado.
 */
export function FormField({
  label,
  required = false,
  error,
  hint,
  className,
  labelClassName,
  srLabel = false,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  labelClassName?: string
  /** O layout só mostra placeholder: label fica para leitores de tela. */
  srLabel?: boolean
  children: (control: ControlProps) => ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid min-w-0 content-start', className)}>
      <label htmlFor={id} className={cn(srLabel ? 'sr-only' : 'flex h-[29px] items-center text-[15px] leading-[15px]', labelClassName)}>
        {label}
        {required && !srLabel && (
          <span aria-hidden="true" className="text-[22px] leading-[29px] text-[#f0805f]">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required: required || undefined })}
      {hint && (
        <p id={hintId} className="sr-only">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-[13px] leading-4 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}



/** `<select>` nativo com a seta do layout; sem valor mostra o placeholder em `text-subtle`. */
export function SelectControl({
  placeholder,
  options,
  className,
  arrowClassName,
  ...props
}: Omit<ComponentProps<'select'>, 'children'> & { placeholder?: string; options: { value: string; label: string }[]; arrowClassName?: string }) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(controlClass, 'cursor-pointer appearance-none pr-9 invalid:text-subtle [&_option]:bg-card [&_option]:text-foreground', className)}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ArrowDownIcon className={cn('pointer-events-none absolute inset-y-0 right-2 my-auto size-5 text-subtle', arrowClassName)} />
    </div>
  )
}

/** "Nome ENS": sufixo `.eth` (único domínio aceito) + nome. O valor é o nome completo (`nome.eth`). */
export function EnsControl({ control, value, onChange, name = 'ensName' }: { control: ControlProps; value: string; onChange: (v: string) => void; name?: string }) {
  const bare = value.replace(/\.eth$/, '')
  return (
    <div className="flex gap-2.5">
      <SelectControl
        aria-label="Domínio ENS"
        value=".eth"
        onChange={() => undefined}
        options={[{ value: '.eth', label: '.eth' }]}
        className="w-[78px] shrink-0 pr-7 pl-2.5 text-[15px]"
        arrowClassName="right-1.5 text-foreground"
      />
      <input
        {...control}
        name={name}
        value={bare}
        onChange={(e) => onChange(e.target.value.trim() ? `${e.target.value.trim().replace(/\.eth$/, '')}.eth` : '')}
        autoComplete="off"
        spellCheck={false}
        className={controlClass}
      />
    </div>
  )
}
