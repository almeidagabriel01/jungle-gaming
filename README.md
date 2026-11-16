# Kurio — marketplace de NFTs

Marketplace de NFTs em React + TypeScript com descoberta, compra e conta do colecionador. Toda a
integração (REST e Socket.IO) roda contra uma API simulada com MSW no próprio navegador — em
desenvolvimento, nos testes e no build de demonstração.

Arquitetura, contratos e decisões: [ARCHITECTURE.md](./ARCHITECTURE.md).

Demonstração pública (mocks e tempo real ativos): https://jungle-gaming-lemon.vercel.app

## O que foi entregue

Por seção do enunciado. Entre parênteses, os specs E2E que comprovam o item (`e2e/`).

- **§3 Catálogo e detalhe:** destaques, busca, filtros combináveis, abas, ordenação e paginação na URL
  (refresh e histórico); estados vazio, erro e resposta fora de ordem; detalhe por link direto, 404,
  edição esgotada e limite de quantidade; favoritos por usuário com atualização otimista e rollback
  (`catalog`, `catalog-states`, `detail`, `favorites`).
- **§3 Carrinho:** adicionar, alterar e remover com disponibilidade por NFT + edição validada no servidor;
  cupom válido, inválido e expirado; valores da cotação da API em ETH decimal; refresh e mescla do carrinho
  de visitante no login; preço e disponibilidade em tempo real (`cart`, `foundation`).
- **§3 Pagamento e confirmação:** validação dos campos, carteira e rede, revisão antes do envio, revalidação da
  cotação no cliente e no servidor (`QUOTE_STALE`), pedido único com clique repetido, timeout e refresh,
  cupom revalidado no envio (recusado, volta aos dados sem reenviar), pendente → confirmado/recusado, recibo
  como snapshot e só exibido completo, falha preserva o carrinho e a reserva do próprio pedido não vira aviso de
  "esgotou" (`purchase`, `payment`, `foundation`, `realtime-checkout`, `realtime-resilience`, `regressions`). Conectar, recusar e desconectar a carteira, com a
  conexão mantida no refresh e encerrada no logout (`wallet-connection`, `wallet-persist`).
- **§3 Conta e sessão:** cadastro com conflito, login com retorno ao fluxo, sessão após refresh, expiração com
  renovação silenciosa e retomada, logout e troca de usuário sem dado da conta anterior; perfil, avatar, senha
  e carteiras com erros da API (`auth`, `profile`).
- **§3 Ações fora do escopo:** avisam "não disponível nesta demonstração"; o explorador do recibo e os contatos
  do rodapé são declarados simulados, sem `mailto`/`tel` nem link para explorador real (`responsive`).
- **§4 Integração e estado:** contratos zod do transporte à UI; carregando, vazio, erro com nova tentativa e
  atualização em segundo plano, inclusive herói, destaque, diário e sugestões (`loading-states`);
  cancelamento de respostas obsoletas; cache isolado por usuário.
- **§5 Contratos REST:** todos os recursos do enunciado; 422, 401, 403, 404, 409 e 5xx; sessão inválida responde
  401 antes de validar o corpo; idempotência do pedido (`api-errors`, `foundation`).
- **§6 MSW:** cenários combináveis pela URL, mock DB persistido e reset; falhas de leitura, timeout de leitura e
  falhas 4xx/5xx nas escritas (`api-errors`, `loading-states`).
- **§7 Socket.IO:** `nft.updated` e `order.updated` pelo `socket.io-client`; duplicatas e eventos antigos
  ignorados, também na reconexão e depois de reset ou troca de usuário; reconciliação na reconexão; o socket
  reconecta com o token vigente, lido no handshake pelo `auth` e renovado antes de reconectar; pedido pendente
  recuperado após queda e refresh (`realtime-checkout`, `realtime-resilience`, `regressions`).
- **§8 Interface e acessibilidade:** frames desktop e mobile do Figma, tablet derivado; teclado, foco preso em
  diálogos e gaveta, erros ligados aos campos (`a11y`); link para a tela atual volta ao topo, voltar e avançar restauram a rolagem,
  login e cadastro abrem sobre a página inicial (`navigation`); sem overflow a 320, 768 e 1440 px, inclusive com
  zoom de 200% e 400% (`responsive`); skeletons sem CLS e com `prefers-reduced-motion`.
- **§9 Testes:** unitários das funções puras (`pnpm test:unit`); E2E em Chromium desktop 1440 e mobile 390, estado isolado por teste, regressão visual com baselines
  versionadas, relatório HTML e traces. Grupos × specs abaixo.
- **§10 Lighthouse:** configuração e metas em `lighthouserc.cjs`; resultados em [Lighthouse](#lighthouse).

| Grupo do §9 | Spec |
| --- | --- |
| 1. Busca, filtros, ordenação, paginação, histórico | `catalog` |
| 2. Acesso direto ao detalhe e recurso inexistente | `detail` |
| 3. Cadastro, login, expiração, logout e troca de usuário | `auth` |
| 4. Favoritos com falha e rollback | `favorites` |
| 5. Carrinho, quantidades, remoção, cupom, refresh e login | `cart` |
| 6. Compra completa do catálogo ao recibo | `purchase` |
| 7. Pagamento recusado, clique repetido e timeout | `payment`, `foundation` |
| Carteira: conectar, recusar, desconectar e refresh | `wallet-connection`, `wallet-persist` |
| 8. Perfil, avatar, senha e carteiras com erros | `profile` |
| 9. Preço e disponibilidade via Socket.IO no checkout | `realtime-checkout` |
| 10. Duplicados, antigos, desconexão e pendente | `realtime-resilience` |
| 11. Teclado, foco em diálogos e validação | `a11y` |
| 12. Skeletons, falha e nova tentativa | `loading-states`, `catalog-states` |
| Extras: erros da API, reflow e ações simuladas, regressões de borda, navegação, regressão visual | `api-errors`, `responsive`, `regressions`, `navigation`, `visual` |

## Requisitos

- Node.js ≥ 22
- pnpm 10 (`corepack enable`)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # só para os testes E2E
pnpm dev                                # http://localhost:5173 (com mocks)
```

## Variáveis de ambiente

Versionadas em `.env` (sem segredos), para que um checkout limpo e o deploy funcionem sem configuração.
Sobrescreva em `.env.local` se precisar.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO), inclusive no build |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial dos mocks (lista abaixo) |
| `VITE_API_URL` | `/api` | Base da API REST |

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Desenvolvimento com mocks |
| `pnpm build` | Typecheck + build otimizado (mocks inclusos) |
| `pnpm preview` | Serve o build em http://localhost:4173 |
| `pnpm typecheck` | Verificação de tipos |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Testes unitários (Vitest) das funções puras: dinheiro, estoque, carrinho do mock e versões do tempo real |
| `pnpm test:e2e` | Playwright (Chromium desktop 1440 e mobile 390) contra o build próprio, sempre gerado na hora (`PW_PORT` muda a porta, padrão 4173; porta ocupada é erro); relatório em `playwright-report/` |
| `pnpm test:e2e:report` | Abre o relatório HTML (traces das falhas incluídos) |
| `pnpm test:e2e visual --update-snapshots` | Regera as baselines de regressão visual (início, detalhe, carrinho, pagamento, login, cadastro, perfil, carteiras e confirmação em 1440 e 390, mais tablet 768); gere no Linux, mesmo ambiente do CI |
| `pnpm lighthouse` | Build + Lighthouse CI (início e detalhe, mobile e desktop, 3 execuções, mediana); falha abaixo das metas (perf 90, a11y 95, boas práticas 95, SEO 90); relatórios em `.lighthouseci/` |

### Testes E2E

- `pnpm test:e2e` gera o build e sobe um servidor próprio na porta 4173; porta ocupada é erro.
- `PW_PORT=4200 pnpm test:e2e` usa outra porta, para rodar suítes de worktrees diferentes ao mesmo tempo.
- `CI=1 pnpm test:e2e` roda como no CI: `test.only` falha a suíte, cada teste tem 1 nova tentativa.
- `PW_DEV=1 pnpm test:e2e` roda contra o `pnpm dev`, para depurar.
- Um spec ou projeto: `pnpm test:e2e e2e/cart.spec.ts --project=desktop`.
- Regressão visual: `pnpm test:e2e visual`. As baselines são `*-linux.png`; regere no Linux.

## Lighthouse

As notas abaixo são do deploy do commit `96533df` (`dpl_D8L6KLimKpx8WdisADAQwe8gHwRM`, build otimizado, mocks no
cenário `default`), medido em https://jungle-gaming-lemon.vercel.app em 15/11/2026 às 22h25 (BRT), e não de
um deploy posterior.
Início (`/`) e detalhe (`/nfts/nft_001`), perfis mobile e desktop, 3 execuções por combinação. A tabela traz a
execução mediana (`median-run`, a mesma das asserções do `lighthouserc.cjs`). Metas: performance 90,
acessibilidade 95, boas práticas 95 e SEO 90; todas atingidas.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT | Relatório |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início (`/`) | Mobile | 97 | 100 | 100 | 100 | 1,7 s | 0,000 | 180 ms | [HTML](docs/lighthouse/mobile-inicio.html) · [JSON](docs/lighthouse/mobile-inicio.json) |
| Detalhe (`/nfts/nft_001`) | Mobile | 98 | 100 | 100 | 100 | 1,7 s | 0,000 | 170 ms | [HTML](docs/lighthouse/mobile-detalhe.html) · [JSON](docs/lighthouse/mobile-detalhe.json) |
| Início (`/`) | Desktop | 100 | 100 | 100 | 100 | 0,4 s | 0,004 | 0 ms | [HTML](docs/lighthouse/desktop-inicio.html) · [JSON](docs/lighthouse/desktop-inicio.json) |
| Detalhe (`/nfts/nft_001`) | Desktop | 100 | 100 | 100 | 100 | 0,5 s | 0,000 | 0 ms | [HTML](docs/lighthouse/desktop-detalhe.html) · [JSON](docs/lighthouse/desktop-detalhe.json) |

Performance nas 3 execuções: início mobile 97/96/97, detalhe mobile 91/99/98, desktop 100/100/100 nas duas
páginas. A categoria `agentic-browsing` do Lighthouse 13 fica fora da tabela: não é meta do enunciado.

- **Ferramentas e ambiente:** Lighthouse 13.6.0 (pelo `@lhci/cli` 0.16.1 do projeto), Chrome for Testing
  158.0.8127.18 headless (o Chromium do Playwright), Node 26.13.1, Linux (WSL2).
- **Condições:** throttling simulado do Lighthouse. Mobile: RTT 150 ms, 1,6 Mbps e CPU 4x. Desktop: RTT 40 ms,
  10 Mbps e CPU 1x.
- **Método:** o Chrome é aberto à parte, porque no WSL o `chrome-launcher` não consegue abri-lo, e o `lhci collect`
  roda o Lighthouse nele pela porta de depuração. Os arquivos em `docs/lighthouse/` são as execuções marcadas como
  representativas (`isRepresentativeRun`) no `manifest.json` de cada perfil, renomeadas para `<perfil>-<página>`.

```bash
CHROME=~/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome
PROFILE=$(mktemp -d)
"$CHROME" --headless=new --no-sandbox --remote-debugging-port=9222 --user-data-dir="$PROFILE" about:blank &
CHROME_PID=$!
URL=https://jungle-gaming-lemon.vercel.app
for preset in mobile desktop; do
  pnpm exec lhci collect --no-lighthouserc --url="$URL/" --url="$URL/nfts/nft_001" -n 3 \
    --settings.port=9222 $([ "$preset" = desktop ] && echo --settings.preset=desktop)
  pnpm exec lhci upload --no-lighthouserc --target=filesystem --outputDir=".lighthouseci/$preset"
done
kill "$CHROME_PID"; rm -rf "$PROFILE"
```

Fora do WSL, `pnpm lighthouse` mede o build local com as mesmas URLs, execuções e metas.

## Deploy (Vercel)

SPA estática em `dist/`, configurada no `vercel.json`: build `pnpm build`, saída `dist`, Node 22+.

- **Mocks:** ligados pelo `.env` versionado (`VITE_ENABLE_MOCKS=true`), então o build de demonstração já
  sobe com MSW. Uma variável definida no projeto da Vercel tem prioridade sobre ele.
- **Rotas internas:** o rewrite para `/index.html` só entra depois dos arquivos estáticos, então
  `mockServiceWorker.js`, `robots.txt` e `/assets/*` continuam servidos como arquivo.
- **Cache:** `mockServiceWorker.js` sem cache (o worker atualiza a cada deploy); `/assets/*`, com hash no
  nome, cache longo e imutável.

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana (carrinho do layout: 3 itens, 26,83 ETH; 2 carteiras; favoritos) | `ana@jungle.test` | `Senha@123` |
| Bruno (1 carteira) | `bruno@jungle.test` | `Senha@123` |

Cupons: `JUNGLE10` (10%), `WELCOME25` (25%), `EXPIRED5` (expirado). Qualquer outro código é inválido.

## Cenários da simulação

Selecione pela URL (`?scenario=nome`, combináveis por vírgula: `?scenario=slow,payment-declined`) ou por
`VITE_MOCK_SCENARIO`. O cenário da URL fica salvo na aba (sessionStorage) até ser trocado.

| Cenário | Efeito |
| --- | --- |
| `default` | Latência curta e determinística; pagamento confirma em 2 s |
| `slow` | +2,5 s nas leituras (skeletons) |
| `out-of-order` | `GET /nfts` alterna 1500 ms e 100 ms (respostas fora de ordem) |
| `empty` | Catálogo vazio |
| `offline` | Toda chamada falha como erro de rede; o socket recusa conexão |
| `server-error` | Leituras respondem 503 |
| `session-expired` | Access e refresh tokens rejeitados |
| `register-conflict` | Cadastro responde 409 |
| `favorite-fails` | Favoritar responde 500 (rollback otimista) |
| `price-change-on-checkout` | Preço do 1º item sobe ao enviar o pedido |
| `sold-out-on-checkout` | Edição do 1º item esgota ao enviar o pedido |
| `order-timeout` | O pedido é criado, mas a resposta só chega após 30 s (cliente estoura 10 s) |
| `wallet-rejected` | A carteira recusa a conexão |
| `payment-declined` | Pagamento recusado |
| `payment-slow` | Pagamento liquida em 15 s |
| `read-timeout` | Leituras nunca respondem (o cliente estoura o timeout) |
| `write-server-error` | Escritas (login, cadastro, carrinho, cupom, favoritos, pedido, perfil, senha, carteiras) respondem 503 |
| `write-client-error` | As mesmas escritas respondem 403 |

### Reset

`?mockReset=1` em qualquer URL restaura integralmente o cenário conhecido (seed) e é removido da URL em
seguida. No console: `window.__mock.reset()`.

### Controle da simulação (`window.__mock`)

Disponível só com mocks ativos. Atua no "servidor": muda o mock DB, e a UI recebe o efeito pela API REST e
pelo evento Socket.IO — nunca por escrita direta em cache ou componente.

```js
__mock.updateEdition('nft_001', 'nft_001_ed3', { price: '1.5' })   // emite nft.updated
__mock.updateEdition('nft_001', 'nft_001_ed3', { available: 0 })   // esgota
__mock.dropSockets()                                                // derruba o socket (reconexão automática)
__mock.recentEvents()                                               // eventos emitidos (para reenviar)
__mock.emitRaw(event)                                               // reenvia um evento (duplicado/antigo)
__mock.settleNow()                                                  // liquida pedidos pendentes agora
__mock.setScenario('payment-declined')
```

## Reproduzindo os fluxos de falha

| Fluxo | Como reproduzir |
| --- | --- |
| Carregamento lento e skeletons | `/?scenario=slow` |
| Respostas fora de ordem | `/?scenario=out-of-order` e troque filtros rapidamente |
| Falha e nova tentativa | `/?scenario=server-error`, depois `__mock.setScenario('default')` e clique em "Tentar novamente" |
| Sem conexão | `/?scenario=offline` |
| Sessão expirada no checkout | Entre, vá ao pagamento e rode `__mock.setScenario('session-expired')`; a próxima ação leva ao login. Rode `__mock.setScenario('default')`, entre de novo e o checkout volta com o rascunho |
| Favorito com rollback | `/?scenario=favorite-fails`, entre e favorite um NFT |
| Cupom inválido/expirado | Carrinho → cupom `XYZ` ou `EXPIRED5` |
| Preço muda no checkout | `?scenario=price-change-on-checkout`, confirme a compra: a revisão exige nova confirmação |
| Preço muda com o carrinho aberto | Com o carrinho aberto, `__mock.updateEdition(...)` |
| Timeout com recuperação | `?scenario=order-timeout`, confirme; após o timeout, "Reenviar pedido" recupera o mesmo pedido |
| Pagamento recusado | `?scenario=payment-declined` |
| Pedido pendente + queda/refresh | `?scenario=payment-slow`, confirme e recarregue ou rode `__mock.dropSockets()` |
| Timeout de leitura | `/?scenario=read-timeout`: erro com "Tentar novamente" depois do timeout |
| Escrita recusada | `?scenario=write-server-error` (ou `write-client-error`) e altere o carrinho: erro visível, nada salvo |
| Acesso a pedido de outro usuário | Entre como Ana e abra `/orders/ord_seed_bruno` (403) |

## O que ficou de fora

- **Cotação do carrinho na rede Ethereum:** a taxa de rede mostrada no carrinho pode diferir da do checkout,
  que usa a rede escolhida.
