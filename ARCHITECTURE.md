# Arquitetura

## Visão geral

```
UI (src/routes, src/components)          ← só consome hooks; nenhum dado fictício
  │ hooks TanStack Query (src/queries)
  │ sessão (src/session) · tempo real (src/realtime)
  ▼
API (src/api: Axios + funções por recurso, resposta validada com zod)
  ▼  HTTP e WebSocket reais do navegador
Mocks (src/mocks: MSW REST + ws/socket.io-binding, mock DB, cenários)
  ▲
Contratos (src/contracts: schemas zod) e dinheiro (src/lib/money.ts) — compartilhados por API, mocks e UI
```

Regras de dependência: `contracts` e `lib` não importam o app; `mocks` importa só `contracts`/`lib`; a UI
nunca importa `mocks` (regra `no-restricted-imports` no ESLint). Os mocks entram por um único ponto, o
boot em `main.tsx`.

| Pasta | Responsabilidade |
| --- | --- |
| `src/contracts` | Schemas zod (DTOs, busca, erros, eventos). Fonte única de tipos para transporte, estado e UI; os formulários validam com os mesmos schemas |
| `src/lib/money.ts` | Aritmética e formatação de ETH com `decimal.js` (strings decimais, nunca float) |
| `src/api` | Instância Axios, normalização de erro (`ApiError`), refresh de sessão, endpoints e query keys |
| `src/session` | Store da sessão (localStorage + sincronização entre abas), ações de login/cadastro/logout, guard |
| `src/queries` | Hooks TanStack Query por domínio, mutations e política de cache |
| `src/realtime` | Cliente `socket.io-client`: dedupe, versão, reconciliação e isolamento por sessão |
| `src/routes` | Rotas file-based do TanStack Router com search params validados |
| `src/mocks` | MSW: handlers REST, servidor Socket.IO simulado, mock DB persistido, cenários e controle |

## Boot

1. `main.tsx` importa e inicia o MSW (`VITE_ENABLE_MOCKS=true`) **antes** de importar o app.
   O `engine.io-client` captura `globalThis.WebSocket` na avaliação do módulo; se o `socket.io-client`
   fosse importado antes do worker, usaria o WebSocket nativo e nenhum evento passaria pelo mock.
2. `app.tsx` cria router e QueryClient, liga a sessão ao cache/router e inicia o tempo real.
3. A rota raiz valida a sessão salva (`GET /session`) antes da primeira tela.

## Contratos REST (base `/api`)

Erro padrão: `{ "error": { "code", "message", "fields"?, "details"? } }`. O cliente converte qualquer falha
em `ApiError { status, code, message, fields }`; rede e timeout viram `status 0` com `NETWORK`/`TIMEOUT`.

| Recurso | Endpoint | Respostas |
| --- | --- | --- |
| Cadastro | `POST /auth/register` | 201 `{user, tokens}` · 409 `EMAIL_TAKEN` · 422 `VALIDATION` |
| Login | `POST /auth/login` | 200 `{user, tokens}` · 401 `INVALID_CREDENTIALS` |
| Refresh | `POST /auth/refresh` | 200 `{user, tokens}` (rotação) · 401 `SESSION_EXPIRED` |
| Sessão | `GET /session` | 200 `{user}` · 401 |
| Logout | `POST /auth/logout` | 204 |
| Catálogo | `GET /nfts?q&tab&categories&networks&collection&minPrice&maxPrice&sort&page` | 200 `{items, page, pageSize, total, totalPages, facets}` |
| Destaques | `GET /nfts/featured` | 200 `{items}` |
| Detalhe | `GET /nfts/:id` | 200 `Nft` · 404 `NFT_NOT_FOUND` |
| Favoritos | `GET /me/favorites` · `PUT`/`DELETE /me/favorites/:nftId` | 200 `{items}` · 401 · 404 |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH`/`DELETE /cart/items/:id` | 200/201 `Cart` · 409 `INSUFFICIENT_AVAILABILITY` · 404 |
| Merge | `POST /cart/merge {guestId}` | 200 `Cart` (após login/cadastro) |
| Cotação | `POST /quotes {couponCode?, network}` | 200 `Quote` · 422 `COUPON_INVALID` / `COUPON_EXPIRED` |
| Pedido | `POST /orders` + `Idempotency-Key` | 201 novo · 200 mesma chave e corpo · 409 `IDEMPOTENCY_CONFLICT` / `QUOTE_STALE` / `QUOTE_NOT_PURCHASABLE` / `WALLET_NOT_CONNECTED` · 422 |
| Pedidos | `GET /orders?status` · `GET /orders/:id` | 200 · 403 `FORBIDDEN` (de outro usuário) · 404 |
| Perfil | `GET`/`PATCH /me/profile` · `PUT /me/avatar` · `POST /me/password` | 200 `User` · 204 · 409 `USERNAME_TAKEN` · 422 `WRONG_PASSWORD` |
| Carteiras | `GET`/`POST /me/wallets` · `PATCH /me/wallets/:id` | 200/201 `{items}` · 409 `WALLET_LIMIT` · 422 |
| Conexão | `POST`/`DELETE /me/wallets/:id/connection` | 200 `{walletId, network, connectedAt}` · 204 · 409 `WALLET_REJECTED` |

Carrinho e cotação pertencem ao usuário autenticado ou ao visitante (`X-Guest-Id`, UUID local). Com token
presente o servidor nunca cai para o carrinho de visitante, mesmo com sessão vencida.

ETH trafega sempre como string decimal (até 18 casas). Quantidades são inteiras. Subtotal, desconto, taxa
de rede e total exibidos vêm da cotação da API; o cliente não soma valores para exibir totais.

## Eventos Socket.IO

Transporte: `@mswjs/socket.io-binding@0.2.0` sobre o `ws` do MSW 2 (o binding exige `msw ^2.10`).
Cliente: `io({ path: '/socket.io', transports: ['websocket'], query: { token } })`.

```
{ eventId, type, resource: { type, id }, version, occurredAt, payload }
nft.updated    payload { nftId, minPrice, available, editions[{ id, price, available }] }  → todas as conexões
order.updated  payload { orderId, userId, status, failureReason }                         → só conexões do dono
```

Toda escrita em NFT ou pedido no mock DB passa por uma única função (`updateEdition` / `transitionOrder`)
que incrementa `version` e enfileira o evento. O evento só é publicado depois que o estado é persistido, então
uma reconciliação disparada pelo evento sempre lê o estado novo pela API.

Limitações do transporte simulado:

- só o namespace `/`, eventos de texto, sem acks, rooms ou binários;
- só WebSocket (sem long-polling);
- o handshake do binding é fixo (`pingInterval 25 s`); o mock envia ping a cada 20 s para a conexão não cair;
- o "servidor" vive na aba: eventos não atravessam abas. O estado (mock DB) é compartilhado pelo localStorage
  e relido a cada request, e a sessão sincroniza entre abas pelo evento `storage`.

## Reconciliação REST × Socket.IO

- **Dedupe e ordem:** `eventId` já visto é ignorado; `version` menor ou igual à última aplicada ao recurso
  também. Duplicatas e eventos antigos não regridem estado nem repetem avisos.
- **Aplicação:** `nft.updated` atualiza o cache do detalhe, das listas e dos destaques só se a versão do
  evento for maior que a do dado em cache. As listas e os favoritos também são invalidados, porque filtro
  e ordenação por preço/disponibilidade só o servidor recalcula. Se o NFT está no carrinho, avisa o que
  mudou (`aria-live`) e invalida carrinho e cotação, que voltam a vir da API.
- **Pedidos:** `order.updated` só é aplicado se `payload.userId` é o usuário atual; o pedido é recarregado da
  API para trazer o recibo completo. Enquanto pendente, o pedido também é consultado a cada 5 s (fallback).
- **Reconexão:** ao reconectar, catálogo, carrinho, cotação e pedidos do usuário são invalidados.
- **Sessão:** o servidor identifica o usuário no handshake, então cada token novo (login, logout, troca de
  usuário, refresh) recria o socket: listeners do anterior são removidos, eventos que ainda chegarem por ele
  são descartados e o novo socket reconcilia ao conectar.

## Sessão

- Access token de 15 min e refresh token de 7 dias (simulados), guardados em localStorage — recuperáveis
  após refresh. Senhas no mock DB só como SHA-256 com salt por usuário.
- 401 em request autenticada dispara **um único** `POST /auth/refresh` compartilhado e repete a request.
  Refresh recusado (400/401) = sessão expirada: em rota privada leva ao login com `redirect` (caminho
  interno validado) e motivo; em rota pública mantém o visitante e avisa. Falha de rede/5xx no refresh não
  desloga (devolve o erro original), e um refresh que termina depois de logout ou troca de conta é descartado.
- Login, logout, expiração e troca de usuário em outra aba passam pelo mesmo caminho: o store emite a troca,
  o cache privado (`['me']`, `['cart']`, `['quote']`) é removido, avisos limpos, rotas reavaliadas e o socket
  recriado.
- O rascunho do checkout (dados, carteira, rede) fica em sessionStorage por usuário e volta após o login.

## Carrinho

- Visitante tem carrinho próprio (`X-Guest-Id`). No login/cadastro o carrinho do visitante é mesclado ao do
  usuário (soma de quantidades limitada à disponibilidade). No logout o visitante recomeça vazio.
- Toda mutação devolve o carrinho completo, gravado no cache; a cotação é invalidada em seguida. As
  mutações rodam em série (`scope`), então uma resposta antiga nunca sobrescreve uma mais nova.
- Disponibilidade é validada no servidor (409 com a quantidade disponível); a UI limita a quantidade ao
  disponível menos o que já está no carrinho.

## Checkout e idempotência

1. Dados do colecionador, carteira e rede; a conexão da carteira é simulada no servidor (conectar, recusar,
   desconectar) e exigida na criação do pedido.
2. Na revisão, a primeira cotação vista é a aceita. Se a cotação mudar (evento em tempo real ou
   revalidação), a confirmação é bloqueada até o usuário aceitar os novos valores.
3. Ao confirmar, a cotação é revalidada na hora; o servidor também revalida (`fingerprint`) e responde
   `QUOTE_STALE` com a nova cotação, que exige nova confirmação.
4. A tentativa (`Idempotency-Key` + corpo) é gravada antes do envio. Clique repetido, timeout, queda ou
   refresh reenviam exatamente a mesma tentativa, e o servidor devolve o mesmo pedido. A tentativa só é
   descartada com resposta definitiva (pedido ou 4xx que não seja 401). Enquanto existir, a confirmação fica
   bloqueada e só "Reenviar pedido" envia: uma nova cotação geraria outra chave e outro pedido.
5. Pedido nasce `pending` com estoque reservado; termina `confirmed` (remove do carrinho só o que foi
   comprado) ou `declined` (devolve o estoque, carrinho intacto). Estados terminais não mudam. A liquidação é
   persistida (`settleAt`), então refresh e queda não deixam pedido pendente para sempre.
6. O recibo é o snapshot do pedido: mudanças posteriores no catálogo não alteram seus valores.

## Estratégia de cache (TanStack Query)

| Dado | Chave | staleTime | Observações |
| --- | --- | --- | --- |
| Catálogo | `['nfts','list',search]` | 30 s | `keepPreviousData`; `signal` cancela a request anterior |
| Destaques / detalhe | `['nfts','featured']` / `['nfts','detail',id]` | 30 s | atualizados por `nft.updated` |
| Carrinho | `['cart', dono]` | 0 | refetch no foco da janela |
| Cotação | `['quote', dono, cupom, rede]` | 0 | sempre da API |
| Privados | `['me', userId, ...]` | 0 | removidos na troca de usuário |
| Pedido | `['me', userId, 'orders', id]` | 0 | poll de 5 s só enquanto pendente |

Retries: queries repetem até 2 vezes só em falhas transitórias (rede, timeout, 5xx), com backoff.
Mutations nunca repetem sozinhas; o pedido usa idempotência explícita. Atualização otimista: favoritos
(snapshot → aplica → rollback no erro → invalida ao final).

## Mock DB

Estado único (`src/mocks/db.ts`) em localStorage com chave versionada pelo seed. Seed determinístico
(`src/mocks/seed.ts`), derivado do Figma: 239 NFTs com as contagens exatas da lateral "Coleções" do frame
Início, os 9 primeiros iguais aos cards do layout (nomes, preços, preço riscado), redes Ethereum/Polygon/Solana,
tiragens 1/1, 1/10, 1/50 e Aberta, preços de `0.02` a `12.3` ETH (incluindo `0.123456789`), edições esgotadas
e de última unidade, 2 usuários, favoritos, o carrinho do frame Carrinho (subtotal 26,83 ETH), carteiras e
pedidos. As imagens são as 4 artes do arquivo (exportadas pela API do Figma, em WebP 480/960 px, com uma
vista aproximada para a galeria). Toda mutação é síncrona dentro de `withDb` (sem atualização perdida) e os eventos são
publicados após persistir.

## Decisões e desvios

- **MSW 2.15 em vez de 3.x:** exigência de peer do `@mswjs/socket.io-binding` publicado.
- **Contrato e telas derivados do Figma:** dados, filtros, campos e visual seguem o layout (valores em px do
  `file.json`/API do Figma). Os desvios estão listados em "Fidelidade ao Figma".
- **"Coleções" × coleção:** a lateral "Coleções" do layout (Arte digital, Música…) é `category`; a coleção do
  projeto ("Coleção: Kurio Apes" no detalhe) é `collection`, filtrável por id para "Mais desta coleção".
- **Facetas:** a contagem de cada opção aplica todos os outros filtros, menos o próprio grupo; a faixa de
  preço ignora o filtro de preço. Os números do Figma para redes (119/78/86) não fecham com o total do
  layout; o seed mantém a proporção.
- **Abas:** "Novos lançamentos" e "Em alta" usam marcações do catálogo (`isNew`, `trending`), não o relógio,
  para manter testes e baselines estáveis.
- **Preços em ETH em todas as redes:** como no layout; Polygon e Solana não usam unidade própria.
- **Sem runner de teste unitário:** as regras de negócio do mock e de dinheiro são exercitadas pelos E2E
  através dos handlers MSW, como pede o enunciado.

## Fidelidade ao Figma

Medidas, cores, fontes, raios, sombras e textos vêm do arquivo do Figma (nunca a olho); os ícones de
interface são os vetores Iconly do próprio arquivo, gerados da geometria (`geometry=paths`) em
`src/components/icons/`. Cada tela foi comparada por pixel com o PNG do frame (1440 e 414×896).
Telas e estados que o Figma não tem (carregando, erro, vazio, 404, pendente, recusado, tablet) usam os
mesmos tokens e componentes.

Desvios, todos exigidos pelo enunciado (acessibilidade AA, alvos de toque, estado não só por cor) e
mínimos:

| Onde | Figma | Implementado | Motivo |
|---|---|---|---|
| Bordas de campos | `#3F2319` (1,5:1) | `#8A6744` | WCAG 1.4.11: contorno de componente ≥ 3:1 |
| Filtros (Coleções, Rede) | seleção só pela cor laranja | caixa de seleção de 16 px à esquerda | WCAG 1.4.1: estado não só por cor |
| Pontos do carrossel | 8/7 px a cada 16/13 px | mesmos pontos, passo de 24 px | WCAG 2.5.8: alvo ≥ 24 px |
| Slider de preço | controle de 21 px de altura | área de 24 px (polegar igual) | WCAG 2.5.8 |
| Lupa do header | 20×20 | alvo 24×35 (ícone igual) | WCAG 2.5.8 |
| "Aplicar" do cupom (mobile) | texto `#F5F1EB` no gradiente (≈2,5:1) | texto `#140D0A` | WCAG 1.4.3 |
| Tempo real | sem indicador | região `role=status` só para leitor de tela | live region pedida no enunciado |
| Ações fora do escopo (Criadores, newsletter, redes, "Ler mais") | links | botões que avisam "não disponível nesta demonstração" | sem link morto |
| Busca no desktop | lupa sem destino definido | abre um diálogo de busca que compõe com os filtros | a busca do catálogo precisa de campo |
| Filtros no mobile | botão de filtro sem tela | gaveta com filtros e ordenação | o frame mobile não mostra a lateral |
| Tablet (768–1023) | sem frame | estrutura mobile com cards do desktop | as medidas fixas do desktop só cabem a partir de 1024 |
| Coração nos cards mobile | só no 1º card | em todos os cards | ação consistente por item |
| Login/Cadastro: olho da senha (mobile) | `#55321F` (≈1,6:1) | `#B39463` | WCAG 1.4.11 |
| Login/Cadastro: fechar, mostrar senha | ícone de 18 px | alvo de 24 px | WCAG 2.5.8 |
| Login/Cadastro: "Crie uma conta" / "Entre" (mobile) | só cor | sublinhados | WCAG 1.4.1 |
| Cadastro desktop: "Confirmar senha" | sem olho | com olho, como no frame mobile | mesma ação nos dois campos |
| Detalhe: trilha | Início › Mercado | + nome do NFT | contexto da página atual |
| Detalhe desktop: adicionar ao carrinho | só COMPRAR | botão-ícone extra ao lado de COMPRAR | adicionar sem sair da página |
| Detalhe mobile: carrinho | sem atalho | link com contador na barra superior | a barra inferior não aparece nesta rota |
| Detalhe: edição esgotada | só riscada | riscada + "esgotada" | WCAG 1.4.1 |
| Detalhe: rótulos "Contrato" e "Direitos autorais" | textos trocados entre os dois | cada texto sob o rótulo certo | o frame inverte endereço e royalties |
| Carrinho desktop: edição | não aparece | só para leitor de tela | duas edições do mesmo NFT seriam idênticas |
| Carrinho mobile: lixeira | sobre o stepper | canto superior direito do card | sobreposição do frame tornaria o alvo ambíguo |
| Confirmação | cartão sobre fundo escuro | cartão dentro da página (header e rodapé) | rota navegável, não modal |
| Pagamento: conexão da carteira | sem estado de conexão | status + "Conectar/Desconectar carteira" sob "Carteira e rede" | simular conexão, recusa e desconexão |
| Pagamento: envio | um botão | "Revisar pedido" → revisão → "Confirmar compra (total)" | confirmação explícita antes de pagar |
| Pagamento mobile: dados do colecionador | não aparecem | seção recolhível "Perfil do colecionador", aberta quando há erro | o pedido exige esses campos |
| Pagamento: faixa METAMASK • WALLETCONNECT • COINBASE | rádio sem significado | opção WalletConnect | cada rádio escolhe uma carteira |
| Pagamento: nome ENS | só o seletor `.eth` | seletor + campo de texto | o nome precisa ser digitado |
| Pagamento: endereço da carteira | editável | só leitura; troca em "Usar outra carteira?" | o endereço é o da carteira que paga |
| Perfil/Carteiras: labels "ENS ou carteira secundária" e dica de senha | só placeholder | label/dica para leitor de tela | WCAG 1.3.1/3.3.2 |
| Perfil: olho da senha | só o estado oculto | estado visível com o mesmo ícone sem o risco | estado que o Figma não tem |
| Carteiras: "Adicionar" | sempre visível | some com duas carteiras | o servidor recusa a terceira (`WALLET_LIMIT`) |
| Carteiras: "Igual à carteira principal" | — | não copia apelido nem endereço | o servidor recusa endereço repetido |

Conteúdo divergente entre frames: o seed segue o frame desktop quando os dois discordam. O carrinho
mobile do Figma tem outros itens e quantidades (4 itens, 1/1/2/2) que o desktop (3 itens, 2/6/9), e a
segunda linha da grade mobile do Início repete "Emerald/Sage" com outra arte e selo. Nessas telas o diff
por pixel separa o que é conteúdo do que é layout.

Lighthouse no mobile (4G lento + CPU 4x simulados), mediana de 3: início 0,88 → 0,94 e detalhe
0,92 → 0,96, LCP ~3,2 s → ~2,6 s. A imagem LCP (arte do destaque) depende dos dados da API simulada,
então o caminho crítico é o chunk dos mocks, que caiu de 170 para 59 kB gzip:
- **`tldts` fora do bundle:** a lista de sufixos públicos (~100 kB gzip) só serve ao `tough-cookie`, que
  o MSW usa para cookies; a API simulada autentica por Bearer e não usa cookies. Um alias troca o pacote
  por `src/mocks/public-suffix.ts` (dois últimos rótulos do host).
- **Socket.IO sob demanda:** o cliente é importado depois do primeiro render (o app já monta com o
  worker ativo, então o WebSocket interceptado continua valendo).
- **Boot em série mantido:** renderizar o app em paralelo com o worker e segurar só as requisições foi
  medido e piorou o LCP (~3,9 s): a imagem LCP espera os dados de qualquer forma, e o download em
  paralelo divide a banda com o chunk dos mocks. Pré-carregar os chunks (`modulepreload`) também piorou.

