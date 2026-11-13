import type { z } from 'zod'
import { ApiError } from '@/api/client'

export type FieldErrors = Record<string, string>

/** Valida com o mesmo schema do contrato; devolve dados ou erros por campo. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): { data: z.infer<S>; errors: null } | { data: null; errors: FieldErrors } {
  const parsed = schema.safeParse(input)
  if (parsed.success) return { data: parsed.data, errors: null }
  const errors: FieldErrors = {}
  for (const issue of parsed.error.issues) errors[issue.path.join('.') || '_'] ??= issue.message
  return { data: null, errors }
}

/** Erros vindos da API: por campo quando houver, senão a mensagem geral em `_`. */
export function apiFieldErrors(error: unknown): FieldErrors {
  if (error instanceof ApiError) return Object.keys(error.fields).length > 0 ? error.fields : { _: error.message }
  return { _: 'Algo deu errado. Tente novamente.' }
}

export const formValues = (form: HTMLFormElement) => Object.fromEntries(new FormData(form)) as Record<string, string>

/** Move o foco para o primeiro campo com erro (acessibilidade). */
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  const first = Object.keys(errors).find((name) => name !== '_')
  const field = first ? form.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`) : null
  field?.focus()
}
