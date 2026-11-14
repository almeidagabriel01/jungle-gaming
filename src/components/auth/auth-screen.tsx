import { Link, useRouter } from '@tanstack/react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useSyncExternalStore, type ReactNode } from 'react'
import { cn } from 'cn'
import { FacebookLogo, GoogleLogo } from '@/components/brand-icons'
import { CloseIcon } from '@/components/icons/auth-icons'
import { unavailable } from '@/lib/unavailable'
import { isPrivatePath } from '@/session/session'

type Mode = 'login' | 'register'

const DESKTOP = '(min-width: 48rem)'
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(DESKTOP)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}
/** Mesmo breakpoint (md) em que o cabeçalho desktop aparece. Um único formulário no DOM, só o invólucro muda. */
const useIsDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches)

type AuthScreenProps = {
  mode: Mode
  title: string
  description: string
  redirect?: string
  children: ReactNode
}

/** Desktop: modal sobre um fundo decorativo. Mobile: tela cheia com a marca e o link para a outra tela. */
export function AuthScreen({ mode, title, description, redirect, children }: AuthScreenProps) {
  const isDesktop = useIsDesktop()
  const router = useRouter()

  if (!isDesktop) {
    // Frame mobile: coluna com padding 80/28/24 e 40 px entre blocos.
    return (
      <section aria-labelledby="auth-title" className="mx-auto flex w-full max-w-[414px] animate-rise flex-col gap-10 px-7 pt-20 pb-6">
        <p aria-hidden="true" className="grid h-[136px] place-items-center text-[32px] leading-[42px] font-bold tracking-[3.2px]">
          KURIO
        </p>
        <h1 id="auth-title" className={cn('text-center font-bold', mode === 'login' ? 'text-xl' : 'text-lg', 'leading-4')}>
          {title}
        </h1>
        {children}
        <p className="text-center text-[15px] leading-5 text-muted-foreground">
          {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
          <Link
            to={mode === 'login' ? '/register' : '/login'}
            search={{ redirect }}
            className="underline decoration-1 underline-offset-4 hover:text-accent-text"
          >
            {mode === 'login' ? 'Crie uma conta' : 'Entre'}
          </Link>
        </p>
      </section>
    )
  }

  const close = () => {
    // Voltar a uma rota privada sem sessão reabriria o login: nesse caso, vai ao início.
    const target = redirect && !isPrivatePath(new URL(redirect, window.location.origin).pathname) ? redirect : '/'
    router.history.push(target)
  }
  const tab = 'rounded-sm transition-colors hover:text-accent-text aria-[current=page]:text-accent-text'

  return (
    <>
      <AuthBackdrop />
      <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
        <DialogPrimitive.Portal>
          {/* No layout o fundo não escurece: a sobreposição só captura o clique fora. */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => {
              // Foco direto no primeiro campo, não nas abas.
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('input')?.focus()
            }}
            className={cn(
              'fixed left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[500px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-y-auto bg-card text-foreground outline-none data-[state=open]:animate-rise',
              // Posição do frame (topo em 160/158 px) quando cabe; senão, centralizado.
              'top-1/2 -translate-y-1/2 [@media(min-height:830px)]:max-h-[calc(100dvh-174px)] [@media(min-height:830px)]:translate-y-0',
              mode === 'login'
                ? 'min-h-[600px] [@media(min-height:830px)]:top-[160px]'
                : 'min-h-[656px] rounded-lg [@media(min-height:830px)]:top-[158px]',
            )}
          >
            <div className="flex flex-col gap-10 px-12 pt-12">
              <nav aria-label="Acesso à conta" className="flex h-5 items-center justify-center gap-2 text-xl leading-4 font-medium">
                <Link to="/login" search={{ redirect }} aria-current={mode === 'login' ? 'page' : undefined} className={tab}>
                  Entrar
                </Link>
                <span aria-hidden="true" className="h-5 w-px bg-[#f0805f]" />
                <Link to="/register" search={{ redirect }} aria-current={mode === 'register' ? 'page' : undefined} className={tab}>
                  Criar conta
                </Link>
              </nav>
              <DialogPrimitive.Title className="sr-only" asChild>
                <h1>{title}</h1>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-center text-[13px] leading-4">{description}</DialogPrimitive.Description>
            </div>
            <div className="flex flex-col gap-6 px-20 pt-6">{children}</div>
            <div aria-hidden="true" className="sticky bottom-0 mt-auto h-2.5 shrink-0 bg-primary" />
            <DialogPrimitive.Close className="absolute top-2 right-2 grid size-6 cursor-pointer place-items-center rounded-sm text-primary transition-colors hover:bg-raised">
              <CloseIcon className="size-[18px]" />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

/** Composição estática do herói da página inicial atrás do modal: decorativa, fora da árvore acessível e sem consultar a API. */
function AuthBackdrop() {
  return (
    <div aria-hidden="true" inert className="page pt-3 select-none">
      <div className="relative ml-[5px] h-[450px] overflow-hidden">
        <p className="absolute top-[68px] left-[43px] text-sm leading-4 font-medium tracking-[1.4px]">Bem-vindo à Kurio</p>
        <p className="absolute top-[91px] left-10 w-[600px] text-[43px] leading-[70px] font-bold">
          SEJA DONO DO FUTURO
          <br />
          DA ARTE DIGITAL
        </p>
        <p className="absolute top-[236px] left-[43px] w-[557px] text-sm leading-6 text-muted-foreground">
          Descubra NFTs selecionados de criadores independentes e colecione arte digital verificada.
        </p>
        <span className="absolute top-[325px] left-[41px] grid h-10 w-[140px] place-items-center rounded-md bg-primary text-base leading-5 font-bold text-primary-foreground">
          EXPLORAR
        </span>
        <img src="/nfts/emerald-960.webp" alt="" className="absolute top-0 right-0 size-[450px] rounded-2xl object-cover" />
      </div>
    </div>
  )
}

/** Divisor "Ou continue com" e os botões sociais (login social está fora do escopo: avisa em vez de simular). */
/** No mobile: 12 px divisor→botões e 16 px entre botões; no modal, `desktopGap` nos dois (12 no login, 16 no cadastro). */
export function SocialAuth({ desktopGap }: { desktopGap: 'md:gap-3' | 'md:gap-4' }) {
  const social =
    'flex h-10 cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-border text-[13px] leading-4 font-medium text-muted-foreground transition-colors hover:border-border-soft hover:bg-raised'
  return (
    <div className={cn('flex flex-col gap-3', desktopGap)}>
      <div className="flex h-4 items-center gap-2.5 text-[13px] leading-4 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border md:-mx-20 md:gap-3">
        Ou continue com
      </div>
      <div className={cn('flex flex-col gap-4', desktopGap)}>
        <button type="button" className={social} onClick={() => unavailable('O login com Google')}>
          <GoogleLogo className="size-5" />
          Continuar com Google
        </button>
        <button type="button" className={social} onClick={() => unavailable('O login com Facebook')}>
          <FacebookLogo className="size-5" />
          Continuar com Facebook
        </button>
      </div>
    </div>
  )
}
