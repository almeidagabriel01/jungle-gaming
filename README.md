# Kurio — marketplace de NFTs

Marketplace de NFTs em React + TypeScript com descoberta, compra e conta do colecionador. Toda a
integração (REST e Socket.IO) roda contra uma API simulada com MSW no próprio navegador — em
desenvolvimento, nos testes e no build de demonstração.

Arquitetura, contratos e decisões: [ARCHITECTURE.md](./ARCHITECTURE.md).

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
| `pnpm test:e2e` | Playwright (Chromium desktop 1440 e mobile 390) contra o build; relatório em `playwright-report/` |
| `pnpm test:e2e:report` | Abre o relatório HTML (traces das falhas incluídos) |
| `pnpm test:e2e visual --update-snapshots` | Regera as baselines de regressão visual (início, detalhe, carrinho e pagamento em 1440 e 390); gere no Linux, mesmo ambiente do CI |
| `pnpm lighthouse` | Build + Lighthouse CI (início e detalhe, mobile e desktop, 3 execuções, mediana); falha abaixo das metas (perf 90, a11y 95, boas práticas 95, SEO 90); relatórios em `.lighthouseci/` |

## Deploy

O build é uma SPA estática em `dist/`, independente do host. Configure com build `pnpm build`, saída `dist`
e Node 22+.

- **Mocks:** vêm ligados pelo `.env` versionado (`VITE_ENABLE_MOCKS=true`). Uma variável de ambiente
  definida no host tem prioridade sobre ele.
- **Rotas internas:** no Vercel, o rewrite do `vercel.json` só entra depois dos arquivos estáticos. No
  Cloudflare Pages, a ausência de `404.html` em `dist/` ativa o modo SPA; não adicione esse arquivo.
- **Service worker:** `mockServiceWorker.js` é servido na raiz, sem cache, nos dois hosts (`vercel.json` e
  `public/_headers`). `/assets/*`, com hash no nome, recebe cache longo e imutável.

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
| Acesso a pedido de outro usuário | Entre como Ana e abra `/orders/ord_seed_bruno` (403) |
