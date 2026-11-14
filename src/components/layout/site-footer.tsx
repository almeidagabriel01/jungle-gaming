import { Link } from '@tanstack/react-router'
import { useSyncExternalStore, useState, type ComponentType, type SVGProps } from 'react'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/brand-icons'
import { Button } from '@/components/ui/button'
import type { Category } from '@/contracts/nft'
import { CATEGORY_LABEL } from '@/lib/labels'
import { unavailable } from '@/lib/unavailable'
import { realtimeStatus } from '@/realtime/realtime'

const FEATURES = [
  { mark: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_CATEGORIES: Category[] = ['digital-art', 'photography', 'music', '3d', 'utility']

const SOCIAL: { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
]

const linkClass = 'cursor-pointer text-left text-[15px] transition-colors hover:text-accent-text'

/** Item de rodapé fora do escopo: botão que avisa, nunca um link morto. */
const Soon = ({ children }: { children: string }) => (
  <li>
    <button type="button" className={linkClass} onClick={() => unavailable(children)}>
      {children}
    </button>
  </li>
)

export function SiteFooter() {
  return (
    <footer className="page mt-24 pb-28 md:pb-0">
      <div className="grid gap-8 rounded-t-md bg-card px-6 py-8 md:grid-cols-2 md:px-12 xl:grid-cols-[repeat(3,1fr)_1.25fr] xl:gap-0">
        {FEATURES.map((f) => (
          <section key={f.mark} className="grid content-start gap-3 xl:border-r xl:border-primary xl:px-[18px] xl:first:pl-0">
            <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {f.mark}
            </span>
            <h2 className="text-[17px] font-bold">{f.title}</h2>
            <p className="max-w-[240px] text-[15px] leading-[22px] text-muted-foreground">{f.text}</p>
          </section>
        ))}
        <Newsletter />
      </div>

      <div className="grid gap-3 bg-band px-6 py-6 text-[15px] md:grid-cols-4 md:items-center md:px-8">
        <p className="text-base font-bold tracking-[0.1em]">KURIO</p>
        <p className="max-w-[260px]">Feito para colecionadores, criadores e cultura</p>
        <a href="mailto:contato@email.com" className="hover:text-accent-text">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-accent-text">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid grid-cols-2 gap-8 bg-card px-6 py-8 md:grid-cols-4 md:px-8">
        <nav aria-labelledby="footer-profile">
          <h2 id="footer-profile" className="mb-3 text-xl font-bold">
            Meu perfil
          </h2>
          <ul className="grid gap-2">
            <li>
              <Link to="/profile" className={linkClass}>
                Meu perfil
              </Link>
            </li>
            <Soon>Minha coleção</Soon>
            <Soon>Atividade</Soon>
            <Soon>Estúdio do criador</Soon>
            <li>
              <Link to="/favorites" className={linkClass}>
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-3 text-xl font-bold">
            Central de ajuda
          </h2>
          <ul className="grid gap-2">
            <Soon>Central de ajuda</Soon>
            <Soon>Como comprar NFTs</Soon>
            <Soon>Carteira e segurança</Soon>
            <Soon>Política do mercado</Soon>
            <Soon>Denunciar item</Soon>
          </ul>
        </nav>
        <nav aria-labelledby="footer-categories">
          <h2 id="footer-categories" className="mb-3 text-xl font-bold">
            Coleções
          </h2>
          <ul className="grid gap-2">
            {FOOTER_CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/" search={{ categories: [c] }} hash="mercado" className={linkClass}>
                  {CATEGORY_LABEL[c]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 grid content-start gap-6 md:col-span-1">
          <section aria-labelledby="footer-social">
            <h2 id="footer-social" className="mb-3 text-xl font-bold">
              Redes sociais
            </h2>
            <ul className="flex gap-2">
              {SOCIAL.map(({ label, Icon }) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-label={`Kurio no ${label}`}
                    onClick={() => unavailable(`O perfil da Kurio no ${label}`)}
                    className="grid size-8 cursor-pointer place-items-center rounded-sm border border-primary text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="footer-wallets">
            <h2 id="footer-wallets" className="mb-3 text-xl font-bold">
              Carteiras compatíveis
            </h2>
            <WalletsStrip />
          </section>
        </div>
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-center text-[15px]">
        <span>© 2026 Kurio. Propriedade digital para todos.</span>
        <RealtimeStatus />
      </p>
    </footer>
  )
}

/** Faixa "METAMASK · WALLETCONNECT · COINBASE" do layout (rodapé e pagamento). */
export function WalletsStrip() {
  return (
    <p className="inline-flex items-center gap-2 rounded-md border border-primary/60 bg-band px-2.5 py-1.5 text-[9px] font-bold tracking-[0.06em] text-accent-text">
      <span>METAMASK</span>
      <span aria-hidden="true">•</span>
      <span>WALLETCONNECT</span>
      <span aria-hidden="true">•</span>
      <span>COINBASE</span>
    </p>
  )
}

function Newsletter() {
  const [error, setError] = useState<string | null>(null)
  return (
    <section aria-labelledby="newsletter-title" className="grid content-start gap-4 xl:pl-[18px]">
      <h2 id="newsletter-title" className="text-lg leading-tight font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <form
        noValidate
        className="flex"
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.elements.namedItem('email') as HTMLInputElement
          if (!input.checkValidity() || !input.value) {
            setError('Informe um e-mail válido.')
            input.focus()
            return
          }
          setError(null)
          unavailable('A inscrição na newsletter')
        }}
      >
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para a newsletter
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'newsletter-error' : 'newsletter-hint'}
          className="h-10 min-w-0 flex-1 rounded-l-md border border-r-0 border-input bg-band px-3 text-[15px] placeholder:text-subtle focus-visible:border-accent-text"
        />
        <Button type="submit" className="h-10 rounded-l-none text-lg">
          Enviar
        </Button>
      </form>
      {error && (
        <p id="newsletter-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p id="newsletter-hint" className="text-sm leading-[22px] text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </section>
  )
}

/** Estado da conexão Socket.IO: ponto visual + texto para leitores de tela. */
function RealtimeStatus() {
  const status = useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get)
  const label = status === 'connected' ? 'conectado' : status === 'connecting' ? 'conectando' : 'desconectado'
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${status === 'connected' ? 'bg-success' : status === 'connecting' ? 'animate-pulse bg-primary' : 'bg-destructive'}`}
      />
      <span data-testid="realtime-status">Tempo real: {label}</span>
    </span>
  )
}
