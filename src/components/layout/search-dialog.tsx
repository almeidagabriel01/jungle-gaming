import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formValues } from '@/lib/forms'

/** Busca global (lupa do header e botão central da barra mobile): leva ao catálogo com `q` na URL. */
export function SearchDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const inputId = useId()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="top-24 translate-y-0 gap-3 p-5 sm:max-w-lg">
        <DialogTitle className="text-base font-bold">Buscar NFTs</DialogTitle>
        <DialogDescription className="text-muted-foreground">Nome, coleção ou criador.</DialogDescription>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const q = (formValues(e.currentTarget).q ?? '').trim()
            setOpen(false)
            void navigate({ to: '/', search: { q }, hash: 'mercado' })
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Termo de busca
          </label>
          <Input id={inputId} name="q" type="search" autoComplete="off" placeholder="Ex.: Emerald Ape" className="flex-1" />
          <Button type="submit" size="icon" aria-label="Buscar">
            <Search />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
