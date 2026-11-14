import { useId, useState, type ComponentProps } from 'react'
import { cn } from 'cn'
import { PasswordEyeIcon } from '@/components/icons/auth-icons'
import { Input } from '@/components/ui/input'

type AuthFieldProps = ComponentProps<typeof Input> & { label: string; name: string; error?: string; hint?: string }

/**
 * Campo das telas de acesso: o layout só tem placeholder, então o label (e a dica) são `sr-only`.
 * Erro e dica associados por aria-describedby; senha ganha o botão de mostrar/ocultar.
 */
export function AuthField({ label, name, error, hint, type, className, ...props }: AuthFieldProps) {
  const id = `${useId()}-${name}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={isPassword && visible ? 'text' : type}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={cn(
            'h-[50px] rounded-[10px] bg-transparent px-4 text-sm md:h-10 md:rounded-[5px]',
            isPassword && 'pr-11',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-[13px] my-auto grid size-6 cursor-pointer place-items-center rounded-sm text-subtle transition-colors hover:text-accent-text aria-pressed:text-accent-text md:right-[9px] md:w-[27px]"
          >
            <PasswordEyeIcon shown={visible} className="size-[18px] md:h-5 md:w-[23px]" />
            <span className="sr-only">Mostrar senha</span>
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="sr-only">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[13px] leading-4 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
