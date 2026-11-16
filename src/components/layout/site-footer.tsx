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

const linkClass = 'cursor-pointer text-left text-sm leading-[30px] transition-colors hover:text-accent-text'
const heading = 'text-lg leading-4 font-bold'
/** Colunas do layout: 211 px a cada 303 px (gap 92) na faixa e nos links. */
const columns = 'md:grid-cols-2 xl:grid-cols-[211px_211px_211px_minmax(0,1fr)] xl:gap-x-[92px]'

/** Item de rodapé fora do escopo: botão que avisa, nunca um link morto. */
const Soon = ({ children }: { children: string }) => (
  <li>
    <button type="button" className={linkClass} onClick={() => unavailable(children)}>
      {children}
    </button>
  </li>
)

/**
 * Rodapé do frame Desktop / Início (1200×610): serviços + newsletter, faixa da marca, links e copyright.
 * Faixa de serviços no xl: colunas de 265 px coladas (o fio fica no px-4 de cada uma) e newsletter de 357 px,
 * com 16 px de respiro à direita do card (32 + 3 × 265 + 357 + 16 = 1200).
 */
export function SiteFooter() {
  return (
    <footer className="page mt-24 pb-28 md:pb-6">
      <div className="grid grid-cols-1 gap-8 bg-card p-8 md:grid-cols-2 xl:flex xl:gap-0 xl:pr-4 xl:pb-4">
        {FEATURES.map((f) => (
          <section key={f.mark} className="grid content-start gap-3 xl:w-[265px] xl:shrink-0 xl:border-r xl:border-primary xl:px-4">
            <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl leading-8 font-bold text-primary-foreground">
              {f.mark}
            </span>
            <h2 className="text-[17px] leading-4 font-bold">{f.title}</h2>
            <p className="max-w-[204px] text-sm leading-[22px] text-muted-foreground">{f.text}</p>
          </section>
        ))}
        <Newsletter />
      </div>

      <div className={`grid gap-3 bg-band p-8 text-sm leading-[22px] xl:h-[88px] xl:items-center xl:py-0 ${columns}`}>
        <p className="text-sm leading-[18px] font-bold tracking-[1.4px]">KURIO</p>
        <p className="whitespace-pre-line xl:whitespace-pre">{'Feito para colecionadores,\ncriadores e cultura'}</p>
        {/* Contato de demonstração: domínio reservado (.test) e número zerado, em texto, sem link que aparente funcionar (§3). */}
        <p>
          contato@kurio.test<span className="sr-only"> (e-mail fictício da demonstração)</span>
        </p>
        <p>
          +55 11 0000 0000<span className="sr-only"> (telefone fictício da demonstração)</span>
        </p>
      </div>

      <div className={`grid grid-cols-2 gap-8 bg-card p-8 ${columns}`}>
        <nav aria-labelledby="footer-profile" className="grid content-start gap-2">
          <h2 id="footer-profile" className={heading}>
            Meu perfil
          </h2>
          <ul>
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
        <nav aria-labelledby="footer-help" className="grid content-start gap-2">
          <h2 id="footer-help" className={heading}>
            Central de ajuda
          </h2>
          <ul>
            <Soon>Central de ajuda</Soon>
            <Soon>Como comprar NFTs</Soon>
            <Soon>Carteira e segurança</Soon>
            <Soon>Política do mercado</Soon>
            <Soon>Denunciar item</Soon>
          </ul>
        </nav>
        <nav aria-labelledby="footer-categories" className="grid content-start gap-2">
          <h2 id="footer-categories" className={heading}>
            Coleções
          </h2>
          <ul>
            {FOOTER_CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/" search={{ categories: [c] }} hash="mercado" className={linkClass}>
                  {CATEGORY_LABEL[c]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 grid content-start gap-8 md:col-span-1">
          <section aria-labelledby="footer-social" className="grid gap-5">
            <h2 id="footer-social" className={heading}>
              Redes sociais
            </h2>
            <ul className="flex gap-2.5">
              {SOCIAL.map(({ label, Icon }) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-label={`Kurio no ${label}`}
                    onClick={() => unavailable(`O perfil da Kurio no ${label}`)}
                    className="grid size-[30px] cursor-pointer place-items-center rounded-md border border-primary text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon className="h-4 w-auto max-w-[19px]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="footer-wallets" className="grid gap-3">
            {/* Uma linha como no layout: o texto passa 3 px da coluna de 227 px, dentro do respiro do card. */}
            <h2 id="footer-wallets" className={`${heading} xl:whitespace-nowrap`}>
              Carteiras compatíveis
            </h2>
            <WalletsStrip />
          </section>
        </div>
      </div>

      <p className="mt-1.5 text-center text-sm leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
      <RealtimeStatus />
    </footer>
  )
}

/** Faixa "METAMASK · WALLETCONNECT · COINBASE" do layout (rodapé e pagamento). */
export function WalletsStrip() {
  return (
    <p className="inline-flex h-[26px] w-fit items-center rounded-lg border border-border-soft bg-band pr-0.5 pl-[11px] text-[9px] leading-3 font-bold tracking-[0.1px] whitespace-pre text-accent-text">
      METAMASK<span aria-hidden="true">{'  •  '}</span>
      <span className="sr-only">, </span>WALLETCONNECT<span aria-hidden="true">{'  •  '}</span>
      <span className="sr-only">, </span>COINBASE
    </p>
  )
}

function Newsletter() {
  const [error, setError] = useState<string | null>(null)
  return (
    <section aria-labelledby="newsletter-title" className="grid grid-cols-1 content-start gap-3 xl:w-[357px] xl:px-4">
      <h2 id="newsletter-title" className="text-lg leading-4 font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <form
        noValidate
        className="mt-1 flex h-10 rounded-lg shadow-[0_0_20px_rgb(10_6_4/0.45)]"
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
          Seu e-mail para receber novidades
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'newsletter-error' : 'newsletter-hint'}
          className="h-10 min-w-0 flex-1 rounded-l-lg border border-r-0 border-input bg-band pl-3 text-sm leading-4 placeholder:text-subtle focus-visible:border-accent-text"
        />
        <Button type="submit" className="h-10 w-[85px] rounded-l-none rounded-r-lg pr-1 pl-4 text-lg leading-4 font-bold">
          Enviar
        </Button>
      </form>
      {error && (
        <p id="newsletter-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p id="newsletter-hint" className="text-[13px] leading-[22px] text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </section>
  )
}

/** Estado da conexão Socket.IO para leitores de tela (o layout não tem indicador visual). */
function RealtimeStatus() {
  const status = useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get)
  const label = status === 'connected' ? 'conectado' : status === 'connecting' ? 'conectando' : 'desconectado'
  return (
    <p role="status" className="sr-only" data-testid="realtime-status">
      Tempo real: {label}
    </p>
  )
}
