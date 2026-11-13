import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'

/** Falha de consulta com ação de nova tentativa (refaz a request). */
export function QueryError({ error, onRetry, title = 'Não foi possível carregar' }: { error: unknown; onRetry: () => void; title?: string }) {
  const message = error instanceof ApiError ? error.message : 'Erro inesperado.'
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-lg border border-destructive/40 p-4">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}
