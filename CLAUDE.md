# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ LEIA PRIMEIRO — A virada estratégica de maio/2026

A Zafe **não é mais uma plataforma de mercado preditivo**. A Resolução CMN nº 5.298, de 24 de abril de 2026 (em vigor a partir de 4 de maio de 2026), proibiu expressamente a oferta e negociação de contratos derivativos baseados em eventos esportivos, políticos, eleitorais, sociais, culturais e de entretenimento. O modelo antigo (peer-to-peer livre sobre qualquer evento com depósito de dinheiro real) ficou ilegal.

A Zafe pivotou para uma **liga de previsões** com três pilares + uma camada de assinatura. Toda decisão de produto, código, copy e marketing deve respeitar o novo posicionamento.

### O que a Zafe é agora

> **Zafe é a liga onde você compete prevendo o que vai acontecer no Brasil e no mundo.**

Posicionamento de referência mental: **Cartola FC das previsões**. Não é bet, não é mercado preditivo, não é cassino, **não é exchange**. É competição de habilidade preditiva com prêmios e curadoria de informação.

---

## 🔒 REGRA DE OURO MONETÁRIA — entender isso antes de tudo

A mudança mais importante do pivot é como o dinheiro flui. Esta regra vale para o produto inteiro:

> **Em nenhum momento o usuário deposita dinheiro real e recebe Z$ em troca. Nunca. Não existe conversão depósito → Z$. Não existe saque Z$ → conta bancária.**

A Zafe **não custodiá nem move o dinheiro do usuário** dentro da plataforma. O dinheiro real entra e sai apenas em duas situações específicas, e cada uma vai para uma direção:

### O dinheiro real entra (do usuário para a Zafe) apenas em:

1. **Pagamento da assinatura Zafe Premium** (mensalidade)
2. **Pagamento de inscrição em concurso** (quando virar pago no futuro — começa grátis)

### O dinheiro real sai (da Zafe para o usuário) apenas em:

1. **Recebimento de prêmio do concurso** vencido pelo usuário (via PIX ou conforme regulamento)

### O Z$ é virtual para todos os efeitos

Z$ é a moeda de jogo da plataforma. Funciona em Econômico, Privadas e Liga. **Não é convertível em dinheiro real**, nunca, em hipótese alguma. Você ganha Z$ por:
- Bônus de onboarding (1.000 Z$ ao criar conta)
- Bônus semanal (cron de engajamento)
- Vencer eventos e concursos *internos* (palpites no Econômico, Privadas, Liga)
- Promoções e ações pontuais

**A inscrição no concurso é o único ponto onde o usuário decide gastar dinheiro real para participar de algo. E o prêmio vai para a conta bancária dele, não vira Z$.** A Zafe não toca em saldo bancário do usuário pra nada além de cobrar a mensalidade Premium ou pagar o prêmio do concurso. Por isso a conta bancária do usuário é **opcional** — só obrigatória se ele quiser assinar Premium ou se inscrever em concurso pago futuro.

### Por que essa regra existe

Eliminar a conversão Real → Z$ → Real fecha simultaneamente vários problemas:

- **Regulatório**: a Zafe deixa de se parecer com casa de apostas, exchange ou intermediadora financeira. Vira plataforma de software com mensalidade (modelo SaaS) e concurso (modelo Lei 5.768/71).
- **Antifraude**: sem fluxo de depósito/saque, não há lavagem de dinheiro, multi-conta com bônus, ou operação Hawala disfarçada de palpite.
- **Tesouraria**: a Zafe não precisa custodiar dinheiro de cliente nem cumprir requisitos de instituição de pagamento (BC). Conta PJ comum basta.
- **KYC**: pode ser leve no início. Real só sai pra vencedor de concurso, e só nesse momento exige verificação completa (CPF + dados bancários).
- **Comunicação**: a frase "a Zafe nunca pega seu dinheiro pra te devolver depois" é o melhor argumento de confiança que você tem.

---

## Os três pilares + Premium (atualizados)

| Pilar | O que é | Moeda | Quem cria eventos | Lastro jurídico |
|---|---|---|---|---|
| **Zafe Econômico** | Eventos sobre indicadores econômicos (Selic, IPCA, dólar, BTC). | Z$ (virtual) | Apenas admin/sistema | Lei 5.768/71 — concurso de previsões |
| **Zafe Privadas** | Bolão entre amigos confirmados sobre qualquer evento. | Z$ (virtual) | Usuários (entre amigos) | Acordo privado entre indivíduos, sem oferta pública |
| **Zafe Liga** | Competição de habilidade sobre qualquer evento. | Z$ (virtual) | Usuários e admin | Lei 5.768/71, Art. 1º — concurso de previsões |
| **Zafe Premium** | Assinatura paga que dá curadoria de informação (Claude API com web search) sobre eventos selecionados. | R$ (real, mensalidade) | — | Mensalidade de plataforma (modelo Cartola Pro / Bloomberg Terminal mini) |

**Regra de moeda na fase atual (período beta e pós-beta inicial):** todos os três pilares (Econômico, Privadas, Liga) usam **Z$ virtual**. Não há saldo em Reais dentro de nenhum pilar. O Real só aparece em duas telas isoladas: cadastro de cartão/PIX recorrente para Premium, e tela de cadastro de dados bancários para receber prêmio de concurso vencido.

---

## 🚫 Vocabulário proibido

Estas palavras **não podem aparecer em conteúdo voltado ao usuário** (UI strings, copy, blog, e-mails, push, redes sociais). Em código (variáveis, rotas, tabelas) elas existem por legado e serão renomeadas gradualmente — ver "Plano de migração de nomenclatura".

### Termos tóxicos — substituir sempre

| ❌ Não usar | ✅ Usar no lugar |
|---|---|
| aposta, apostar, apostador | palpite, palpitar, previsor, previsão, prever |
| bet, betting, sportsbook | liga, concurso, competição |
| odds | probabilidade, cotação (só no Econômico) |
| cassino, jogo de azar | competição de habilidade |
| mercado preditivo, prediction market | (não tem substituto — não falar) |
| trader, trading de evento | competidor, participante (Liga); investidor (Econômico) |
| stake, stakar, stakear | inscrição, alocação |
| house edge, vig, juice, banca | (não falar — vocabulário de bet) |
| casa de apostas, plataforma de apostas | plataforma de previsões, liga |
| risco, arriscar dinheiro | competir, prever |
| cash out, sair antes | encerrar posição (só no Econômico) |
| bolão pago | bolão entre amigos (Privadas) |
| **depósito, depositar** | (não falar — não existe na Zafe) |
| **saque, sacar** | (só no contexto de receber prêmio) |
| **carteira, wallet, balance, saldo em reais** | saldo em Z$ (virtual) |

### Termos cinzas — usar com cuidado e só no contexto certo

- **Prêmio em dinheiro** — só acompanhado de "concurso" ou "competição".
- **Comprar contrato, liquidar, expirar** — só dentro do Econômico, com linguagem técnica de derivativo.
- **Mercado** — pode usar como "mercado financeiro" no Econômico. Evitar "mercado de previsões".

### Termos seguros

Previsão, prever, previsor, palpite, palpitar, concurso, competição, campeonato, torneio, liga, habilidade, perícia, acurácia, calibração, consistência, pontos, pontuação, ranking, classificação, temporada, participante, competidor, jogador, mensalidade, assinatura, premium, plano, inscrição, Brier score, log loss, bolão entre amigos, **curadoria, contexto, informação, análise**.

### Teste mental

> "Isso é compatível com como o Cartola FC fala de si mesmo?"

Se a resposta é não, troca a palavra.

---

## Comandos

```bash
npm run dev       # Dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint check
npx vercel --prod # Deploy (no GitHub auto-deploy)
```

---

## Arquitetura

### Stack
- **Next.js 14** (App Router) + TypeScript (strict mode)
- **Supabase** (Postgres + Auth + Realtime)
- **Tailwind CSS** + shadcn/ui
- **@anthropic-ai/sdk** para resolução automatizada de eventos, avaliação de provas e **curadoria de informação Premium**

### Route Groups
- `app/(auth)/` — rotas públicas (login, OAuth callback)
- `app/(main)/` — rotas protegidas (requer sessão Supabase)
- `app/admin/` — admin only (`profiles.is_admin = true`)
- `app/api/` — backend logic

Auth guard e admin check ficam em `middleware.ts`.

### Supabase Clients
Dois clients, nunca misturar:
- `lib/supabase/client.ts` → `createBrowserClient()` para Client Components
- `lib/supabase/server.ts` → `createServerClient()` para Server Components/API routes; `createAdminClient()` (service role) para operações privilegiadas

**Regra:** API routes que escrevem em tabelas devem usar `createAdminClient()` depois de validar `auth.getUser()`. O client de usuário está sujeito a RLS e falha silenciosamente se as policies estão ausentes.

### Data Types
Em `types/database.ts`. Tipos-chave: `Topic`, `Bet`, `BetMatch`, `Profile`, `Wallet`, `Transaction`, `Friendship`, `PrivateBetInvite`, `Notification`.

Enums:
- `TopicStatus`: `pending` → `active` → `resolving` → `resolved` | `cancelled`. Não existe `closed`.
- `BetSide`: `sim` | `nao` (Português)
- `TopicCategory`: `politica` | `esportes` | `cultura` | `economia` | `tecnologia` | `entretenimento` | `outros`
- `DesafioStatus`: `active` → `resolving` → `awaiting_proof` → `proof_submitted` → `under_contestation` → `admin_review` → `resolved` | `cancelled`

### Estrutura de pilares no código (estado-alvo)

```
app/(main)/
  economico/        # Pilar 1 — Z$ virtual, só admin/sistema cria, indicadores econômicos
  privadas/         # Pilar 2 — Z$ virtual, bolão entre amigos
  liga/             # Pilar 3 — Z$ virtual, qualquer evento, concurso por cima
  premium/          # Pilar 4 — Real (mensalidade), curadoria de informação
  concurso/         # Página própria do concurso ativo (regulamento, ranking, inscrição)
```

A migração é gradual. Ver "Plano de migração" abaixo.

### Estilização
Dark theme (black bg). Verde primário `#86efac`. Lados do palpite: `--sim` (verde) e `--nao` (vermelho). Componentes usam `cn()` de `lib/utils.ts`.

---

## Pilar 1 — Zafe Econômico

**Localização:** `/economico` (renomeação de `/topicos` filtrado por categoria `economia`)

### O que é
Plataforma onde usuários competem em palpites sobre indicadores econômico-financeiros. **Moeda virtual: Z$.** Comissão de plataforma de **6%** (94% para vencedores, parimutuel — preserva exatamente o `lib/odds.ts` atual).

**No período beta e pós-beta inicial, este pilar é exclusivamente Z$ virtual. Não existe versão "com dinheiro real" do Econômico.** Se no futuro a Zafe quiser oferecer um produto pago equivalente, será via inscrição em torneio paralelo (modelo de buy-in regulamentado pela SECAP) — nunca via depósito/saque livre.

### Quem cria eventos
**Apenas admin ou sistema (cron de reposição).** Usuários não criam eventos econômicos. Isso protege o pilar de:
- Eventos disfarçados ("X político vai afetar a Selic em Y?" tentando driblar a vedação)
- Eventos mal-formulados que o oracle não consegue resolver
- Spam e baixa qualidade

Implementação: `POST /api/economico/criar` aceita request apenas se `profiles.is_admin = true` OU se origem é o cron `repor-mercados` (validar via header interno ou service role).

### Universo permitido
- **Macro Brasil**: Selic (Copom), IPCA, IGP-M, PIB trimestral, taxa de desemprego
- **Mercados**: Ibovespa fechamento, dólar (PTAX), euro, ouro, petróleo Brent, commodities (soja, café, boi, milho)
- **Cripto**: Bitcoin, Ethereum em janelas curtas e longas
- **Indicadores globais**: Fed funds rate, CPI americano, decisões do BCE
- **Empresas (fase 2)**: lucro trimestral de listadas

### O que NÃO entra
Esporte, política, eleição, BBB, Oscar, cultura, entretenimento. Tudo isso vai para a **Liga** (também em Z$).

### Mecânica do evento individual (idêntica ao tópico atual)

Cada evento individual em `/economico/[id-or-slug]` preserva **toda** a mecânica atual:
- Status: `pending` → `active` → `resolving` → `resolved` | `cancelled`
- Slug URLs: `/economico/[slug-or-uuid]` — lookup aceita ambos
- Lados SIM/NÃO com cores `--sim` / `--nao`
- Probabilidade ao vivo via `v_topic_stats` (`prob_sim`, `prob_nao`)
- Volume agregado em Z$ (`volume_sim`, `volume_nao`, `total_volume`, `bet_count`)
- Gráfico histórico de probabilidade via `topic_snapshots`
- Componente `ProbabilityChart`, `LiveStats`, `MercadoSecundario`, `ResolvingBanner`
- OG Image dinâmica via `/api/og?id=[uuid]&type=economico`
- `generateMetadata` com Twitter card large image

### Resolução do evento — pipeline em 4 camadas (preservado)

`lib/oracles/index.ts` orquestra:

**Camada 1 — API fixa por categoria** (gratuita), via `oracle_api_id`:
- `lib/oracles/economia.ts` — Banco Central (PTAX, Selic, IPCA), Yahoo Finance, CoinGecko
- `oracleEconomia(id, query)` consulta API conforme `oracle_api_id`

**Camada 1b — Auto-detecção por categoria.** `oracleEconomiaAuto` infere indicador a partir do título quando `oracle_api_id` é null.

**Camada 2 — Claude com tripla verificação** (`lib/oracles/ai-triple-check.ts`):
- `oracleAITripleCheck()` faz dois checks independentes via Claude com tool `web_search`
- Cada check retorna `{ resultado, fonte, confianca }`
- Resolve apenas se `check1.resultado === check2.resultado` E ambas `confianca >= 0.85`
- Registra `check1_*` e `check2_*` em `resolucoes`

**Camada 3 — Retry em 2h, máx 3 tentativas** (`RETRY_INTERVAL_MS`, `MAX_RETRIES`).

**Camada 4 — Reembolso automático em Z$** via `reembolsarTodos()` de `lib/payout.ts`.

`salvarResolucao()` registra cada tentativa em `resolucoes`.

### Mercado secundário (Order Book) — preservado em Z$

`lib/order-matching.ts` continua exatamente como está, ativo no Econômico:
- **Engine FIFO price-time matching** com **2% de comissão sobre o vendedor**
- **Endpoints**:
  - `GET /api/economico/[id]/orderbook`
  - `POST /api/economico/[id]/ordem`
  - `DELETE /api/economico/[id]/ordem/[orderId]`
- **Validação**: `tryMatchOrders()` recebe `topicId`
- **Componente UI**: `MercadoSecundario` aceita `topicId` ou `apiBase` prop
- **Cron `match-orders`** continua processando matches periodicamente
- **Cancelamento em massa**: `cancelTopicOrders(topicId)` quando evento muda de status

**Wallet flow no secundário (Z$):** balance validado na criação da ordem, **débito só na execução do trade**. Permite múltiplas ordens abertas sem prender saldo.

### API endpoints do Econômico

```
POST   /api/economico/criar           # Apenas admin/sistema
POST   /api/economico/[id]/palpitar    # Mercado primário
POST   /api/economico/[id]/sair        # Sair de posição (mercado primário)
GET    /api/economico/[id]/orderbook   # Mercado secundário
POST   /api/economico/[id]/ordem       # Criar ordem secundário
DELETE /api/economico/[id]/ordem/[orderId]
GET    /api/economico/[id]/chart       # Histórico de probabilidade
GET    /api/economico/[id]/status      # Polling para ResolvingBanner
```

### Copy e UI
- Linguagem técnica de mercado financeiro: "contrato", "cotação", "vencimento", "liquidação", "encerrar posição"
- Saldo sempre rotulado como "Z$" — explicitar "moeda virtual da Zafe" em onboarding e tooltip permanente
- Header: **"Zafe Econômico — palpite sobre indicadores econômicos"**

---

## Pilar 2 — Zafe Privadas

**Localização:** `/privadas` (renomeação de `/apostas-privadas`)

### O que é
**Literalmente o sistema atual de apostas privadas, com 4 travas novas e usando Z$ virtual.** Bolão entre amigos confirmados. Dois ou mais combinam um palpite, alocam Z$, a Zafe segura e libera para o vencedor após apuração. **Comissão de 6%** (3% de cada lado).

### As 4 travas novas (obrigatórias para legalidade pós-5.298)

Embutidas no produto, não só nos termos:

1. **Só entre amigos confirmados mutuamente** com tempo mínimo de conexão de **24h após aceite**
2. **Mercado fechado** — participantes definidos no momento da criação
3. **Sem revenda de posição** — sem mercado secundário neste pilar
4. **Limite anual por par de usuários: 5.000 Z$** entre os mesmos dois usuários (configurável via env, default 5000)

Validação dessas 4 travas ocorre em `POST /api/privadas/criar` e `POST /api/privadas/[id]/aceitar`. Falha em qualquer trava → 403 com mensagem amigável.

### Mecânica preservada do código atual

Tudo o que existe hoje em `app/(main)/apostas-privadas/` e `app/api/apostas-privadas/` continua funcionando idêntico, em Z$ virtual.

### Criação e aceite

- Criação via `POST /api/privadas/criar`
- Convite via `POST /api/amigos/convidar-aposta`
- Aceite via `POST /api/amigos/aceitar-aposta`
- Recusa via `POST /api/amigos/recusar-aposta`
- Cancelamento via `POST /api/privadas/[id]/cancelar`

### Resolução com supermaioria 67% (`lib/private-bets.ts`)

Sistema de eleição de líderes preservado integralmente:

- `elegerLider(privadaId, side)` — recebe votos de cada lado em quem foi o vencedor; requer **67% de supermaioria por lado**
- `checkLideresEleitos(privadaId)` — verifica se ambos os lados elegeram líderes
- Se há divergência → ativa sistema de juízes
- `fecharVotacao(privadaId)` — fecha votação após quórum
- `checkRecrutamento(privadaId)` — verifica se ainda precisa de mais juízes
- `checkJuizesConfirmados(privadaId)` — confirma quórum de juízes

### Sistema de juízes (preservado integralmente)

- `POST /api/privadas/[id]/juizes/propor`
- `POST /api/privadas/[id]/juizes/responder`
- `POST /api/privadas/[id]/juizes/disponibilidade`
- `POST /api/privadas/[id]/votar-lider`
- `POST /api/privadas/[id]/votar-resultado`

### Timeout
Cron `apostas-privadas-timeout` continua expirando convites pendentes.

### Mecânica do evento individual no Privadas
- **Não há `MercadoSecundario` aqui** (trava 3 — sem revenda)
- **Não há gráfico de probabilidade pública** (mercado é fechado)
- **Não há OG image pública** (privacidade dos participantes)

### Comissão
**6% total** (3% de cada lado), em Z$.

### Copy e UI
- Linguagem coloquial de bolão: "combinar", "palpite", "vencedor", "liberar"
- Frase-âncora: **"Zafe Privadas — bolão entre amigos com Z$. Combine, aloque, ganhe."**

---

## Pilar 3 — Zafe Liga (carro-chefe)

**Localização:** `/liga` (substitui `/topicos` para tudo que **não** é categoria `economia`)

### O que é
**Pilar principal da nova Zafe.** Funciona **exatamente como os tópicos atuais** (criação, palpite SIM/NÃO, resolução por oracle ou admin, ranking, perfil, mercado secundário, gráficos, OG image, trending feed), com **três diferenças cruciais**:

1. **Z$ virtual.** (Mesma moeda do Econômico e Privadas — não há mais distinção de carteiras durante a fase atual.)
2. **Acima da listagem de eventos há um banner do concurso ativo**, com regulamento, prêmios e botão de inscrição.
3. **Universo de eventos é qualquer coisa**: esporte, política, BBB, Oscar, cultura, eleição, tecnologia, entretenimento.

### Quem cria eventos
- **Usuários** podem criar eventos via `POST /api/liga/criar`. Vão para `pending` até aprovação admin
- **Admin** aprova/rejeita via `/api/admin/aprovar`, `/api/admin/rejeitar`
- **Sistema** (cron `repor-mercados`) injeta eventos automáticos

### Mecânica do evento individual (idêntica ao tópico atual)

Tudo igual ao Econômico:
- Status, slug URLs, lados SIM/NÃO, probabilidade ao vivo, volume agregado em Z$, gráfico histórico, componentes UI, OG image, notificação 2h antes
- Mercado secundário ativo (em Z$, FIFO, 2% comissão sobre vendedor)

### Resolução do evento — pipeline em 4 camadas preservado

Idêntico ao Econômico, com oracles específicos por categoria:
- `oracles/sports.ts` — APIs de esporte
- `oracles/politica.ts` — fontes oficiais (TSE, etc.)
- `oracles/entretenimento.ts` — fontes do tema (BBB, Oscar)
- `oracles/tecnologia.ts` — fontes técnicas
- Camada 2: `oracleAITripleCheck` com Claude e dois checks via web search
- Camada 3: retry em 2h
- Camada 4: reembolso em Z$

### Concurso por cima da Liga

**Estrutura visual** na página `/liga`:

```
┌─────────────────────────────────────────────────┐
│ 🏆 Concurso Liga Zafe — Temporada Maio          │
│                                                 │
│ Prêmios totais: R$ 2.500                        │
│  • 1º lugar: R$ 1.000                           │
│  • 2º lugar: R$ 500                             │
│  • 3º lugar: R$ 250                             │
│  • 4º a 10º: R$ 100 cada                        │
│  • 11º a 25º: R$ 35 cada                        │
│                                                 │
│ Critério: maior acurácia agregada (Brier score) │
│ em pelo menos 30 previsões no mês.              │
│                                                 │
│ Período: 01/05 a 31/05                          │
│                                                 │
│ [ Inscrever-se grátis ]    Ver regulamento →    │
└─────────────────────────────────────────────────┘
```

Abaixo do banner, listagem normal de eventos da Liga, com tabs:
- **Em Alta 🔥** — `/liga?tab=em-alta`, calcula volume Z$ por evento nas últimas 2h, badge "+Z$ X / 2h", ranking #1/#2/#3
- **Todos**
- **Por categoria**

### Inscrição no concurso

**Por enquanto, gratuita para todos.** Botão "Inscrever-se grátis" registra em `inscricoes_concurso`.

Quando virar pago no futuro: a inscrição passará a custar **dinheiro real** (R$ X de inscrição). Aqui é o **único momento em que a Zafe vai cobrar inscrição em Real para participar de algo que dá prêmio em Real** — formato clássico de concurso de habilidade (Lei 5.768/71 categoria "concurso de previsões/cálculos").

**Crítico:** mesmo na fase paga, o pagamento da inscrição **não vira Z$**. Vai direto para a conta operacional Zafe que financia os prêmios. Sem conversão, sem saldo. O usuário paga R$ X uma vez, ganha o direito de competir, e se vencer recebe o prêmio em R$ direto na conta dele.

### Critério de vitória — habilidade preponderante

Defesa jurídica de habilidade depende disso:
- **Brier score agregado** sobre todas as previsões do participante no período
- **Mínimo de 30 previsões no mês** para qualificação
- **Diversidade**: previsões em ao menos 3 categorias diferentes

Cálculo via `lib/concursos/brier-score.ts`. Recálculo diário via cron `atualizar-ranking-concurso`.

### Estrutura de prêmios

- **Concurso mensal regular**: R$ 2.500 totais. ~25 vencedores (1º R$1k, 2º R$500, 3º R$250, 4º-10º R$100, 11º-25º R$35)
- **Concurso major trimestral patrocinado**: R$ 10k-25k totais
- Concursos majores são registrados na SECAP quando passarem do limite (10% do valor dos prêmios), coberto por patrocínio

### Bônus semanal e onboarding (em Z$)
- Cron `bonus-semanal` credita Z$ semanal aos ativos
- Onboarding: 1.000 Z$ de presente

### Pagamento do prêmio (Real, não Z$)

Quando o concurso é apurado, `lib/concursos/payout-concurso.ts` paga vencedores em **Real** via PIX, com base nos dados bancários cadastrados no perfil. **Não credita Z$.** É a única ocasião em que dinheiro real sai da plataforma para o usuário.

Antes do primeiro pagamento, o usuário precisa:
1. Cadastrar nome completo
2. Cadastrar CPF
3. Cadastrar chave PIX
4. Aceitar declaração de tributação (prêmios acima de R$ 1.903,98 sofrem IR retido na fonte de 30% conforme Lei 11.196)

### API endpoints da Liga

```
POST   /api/liga/criar
POST   /api/liga/[id]/palpitar
POST   /api/liga/[id]/sair
GET    /api/liga/[id]/orderbook
POST   /api/liga/[id]/ordem
DELETE /api/liga/[id]/ordem/[orderId]
GET    /api/liga/[id]/chart
GET    /api/liga/[id]/status
POST   /api/concurso/inscrever       # Inscrição (grátis no início, paga futuramente)
GET    /api/concurso/atual
GET    /api/concurso/ranking
POST   /api/concurso/cadastrar-dados-bancarios   # Para vencedores receberem
```

### Copy e UI
- Linguagem esportiva: "temporada", "ranking", "campeonato", "previsão", "palpite", "competidor"
- Saldo sempre rotulado como "Z$" com tooltip explicando virtual
- Frase-âncora: **"Zafe Liga — a liga onde você compete prevendo o que vai acontecer."**

---

## Pilar 4 — Zafe Premium

**Localização:** `/premium`

### O que é (atualizado e bem mais focado)

Assinatura paga (sugestão R$ 19,90/mês) que entrega **uma única coisa principal**: **curadoria de informação contextual sobre eventos selecionados, gerada pela API do Claude com web search**.

Não é "dica de quem vai ganhar". Não é "previsão do Premium". É **contexto extra que ajuda o assinante a formar opinião melhor por conta própria**.

### Como funciona na prática

Em cada evento da Zafe (Econômico ou Liga), há um botão/seção visível para todos:

> 🔓 **Curadoria Premium**
> Veja contexto, declarações recentes e análises sobre este evento. (Disponível para assinantes)

Quando o assinante clica/abre, a Zafe chama a API do Claude com web search e retorna um bloco de informação balanceada. Por exemplo:

**Evento:** "Bitcoin vai chegar a US$ 100k até 31/12?"

**Curadoria Premium:**
> *Contexto recente sobre Bitcoin (atualizado em [data]):*
>
> *Argumentos para alta:* O Tesouro dos EUA recentemente sinalizou abertura à inclusão de cripto em reservas estratégicas. Trump declarou em [data] que pretende [...]. ETFs de Bitcoin acumularam fluxo líquido positivo de US$ X bi nos últimos 30 dias.
>
> *Argumentos para baixa:* O Federal Reserve manteve postura hawkish em [...]. O analista [Y] do JPMorgan publicou nota argumentando que [...]. Volume de transações em on-chain caiu Z% no mês passado.
>
> *Fontes:* [link 1, link 2, link 3]
>
> *Esta é uma curadoria informativa. A Zafe não recomenda ou prediz resultados — você decide com base no contexto.*

A curadoria **sempre apresenta os dois lados**, com fontes citáveis, e termina com disclaimer explícito de que não é recomendação.

### Por que essa estrutura

- **Vende valor real** — usuário Premium tem informação que o gratuito não tem
- **É juridicamente seguro** — não é recomendação de investimento (que exigiria credenciamento CVM como analista), é curadoria de informação pública
- **Aproveita exatamente o que o Claude faz bem** — fazer web search, sintetizar argumentos opostos, citar fontes
- **Diferencia da concorrência** — Polymarket/Kalshi têm dado, mas não têm essa camada de "explicação balanceada"
- **Custo controlado** — uma chamada Sonnet por evento por dia (cacheable), volume baixo

### Outras vantagens do Premium (secundárias)

- Badge premium no perfil
- Inscrição automática nos concursos (sem precisar lembrar)
- Pool de premiação separada para premium em concursos majores (SECAP aceita "concurso para grupo determinado")
- Análise de calibração pessoal (gráfico do próprio Brier score ao longo do tempo)
- Histórico ilimitado (gratuito tem limite de 30 dias)

### Como o pagamento entra

Mensalidade recorrente via PIX recorrente, cartão de crédito ou Pix mensal. Provedor: Stripe, Pagar.me ou Iugu (decidir antes do lançamento).

**Crítico:** **a mensalidade Premium não vira Z$.** O usuário paga R$ 19,90/mês e ganha acesso aos benefícios listados. Não há crédito interno. A separação contábil é clara: dinheiro de Premium vai para conta operacional Zafe, dinheiro de prêmio sai dessa mesma conta para vencedor de concurso.

### Como funciona juridicamente

Termos de uso devem deixar explícito:

> "A assinatura Zafe Premium dá acesso a ferramentas de análise, curadoria de informação e benefícios de plataforma. Como benefício acessório, assinantes podem ser inscritos automaticamente em concursos promovidos pela Zafe. A curadoria de informação é gerada por inteligência artificial a partir de fontes públicas e não constitui recomendação de investimento ou predição de resultado."

Modelo de referência: Cartola FC Pro, Strava Premium, Bloomberg Terminal (versão mini).

### Tabelas e API

- `subscriptions` — id, user_id, plan, status, started_at, current_period_end, canceled_at, provider, provider_subscription_id
- `subscription_events` — id, subscription_id, event_type, payload_jsonb, created_at
- `curadorias` — id, topic_id, conteudo (jsonb), gerada_em, modelo, tokens_input, tokens_output (cache de curadoria por evento)

Endpoints:
- `POST /api/premium/assinar` — inicia checkout
- `POST /api/premium/cancelar` — cancela assinatura
- `GET /api/premium/curadoria/[topicId]` — retorna curadoria para o evento (cacheada por X horas)
- `GET /api/premium/calibracao` — análise de calibração pessoal

### Geração e cache de curadoria

A curadoria é cara (Claude Sonnet com web search). Estratégia:

- **Cache por evento de 6h** — primeira chamada gera, próximas servem do cache até expirar
- **Pré-geração para top 20 eventos por volume** — cron a cada 6h gera curadoria pra eventos mais ativos
- **On-demand para os outros** — só gera quando primeiro Premium pedir

Implementação em `lib/premium/curadoria.ts`. Salva em `curadorias` com `gerada_em` e `valida_ate`.

### Quando lançar

**Não imediatamente.** Sequência:
1. Pivot Liga (Z$, banner do concurso, inscrição grátis) — semanas 1-4
2. Premium em beta fechado para 50-100 testers — semanas 5-12 (validar valor da curadoria)
3. Premium pleno — após validar PMF do produto-base (Liga)

---

## Lógica de negócio (`/lib`) — preservar e estender

### Mantidos integralmente
- **`odds.ts`** — odds parimutuel, **6% comissão**, 94% payout. Vale para Econômico, Privadas e Liga (todos em Z$).
- **`order-matching.ts`** — order book FIFO price-time, **2% comissão sobre vendedor**. Ativo no Econômico e Liga (Z$). Aceita `topicId` ou `desafioId`.
- **`webpush.ts`** — `sendPushToUser(userId, payload)` via VAPID, auto-limpa subscriptions stale.
- **`oracles/`** — agentes Anthropic por categoria, estrutura completa preservada (4 camadas).
- **`proof-processor.ts`** — pipeline de prova de desafios: links → fetchText, fotos → base64 + Google Vision, YouTube → oEmbed.
- **`desafios-payout.ts`** — `pagarDesafio(id)` / `reembolsarDesafio(id)`.
- **`payout.ts`** — `pagarVencedores()`, `reembolsarTodos()` (em Z$).
- **`private-bets.ts`** — supermaioria 67%, juízes. **Adicionar enforcement das 4 travas novas**.
- **`slugify.ts`**, **`utils.ts`** (`cn()`, `formatZ()`, `formatPercent()`, `applyCommission()`, `CATEGORIES`).

### Novos
- **`lib/concursos/brier-score.ts`** — cálculo agregado por usuário no período
- **`lib/concursos/inscricao.ts`** — gestão de inscrições, validação de elegibilidade
- **`lib/concursos/ranking-concurso.ts`** — geração do ranking final
- **`lib/concursos/payout-concurso.ts`** — pagamento **em Real via PIX** aos vencedores, debitado de conta operacional Zafe
- **`lib/premium/curadoria.ts`** — geração e cache de curadoria via Claude API com web search
- **`lib/premium/billing.ts`** — integração com provedor de pagamento (Stripe/Pagar.me/Iugu)
- **`lib/limits/private-bet-limit.ts`** — checagem da trava de 5.000 Z$/ano por par no Privadas

---

## Banco de dados

### Views existentes (preservar)
- **`v_topic_stats`** — agregadas: `volume_sim`, `volume_nao`, `total_volume`, `prob_sim`, `prob_nao`, `bet_count` (em Z$)
- **`v_desafio_stats`**, **`topic_snapshots`**, **`desafio_snapshots`**

### Tabelas existentes (preservar)
- **`topics`** — eventos da Liga e do Econômico (categoria discrimina)
- **`bets`** — palpites em Z$
- **`orders`**, **`trades`** — secundário
- **`resolucoes`** — preservar campos `check1_*`, `check2_*`
- **`desafios`**, `private_bets`, `private_bet_invites`, `friendships`
- **`profiles`**, **`wallets`** (carteira Z$ virtual única, sem distinção de moeda real), **`transactions`**
- **`notifications`**

### Tabelas novas (a criar)

#### Concursos
- **`concursos`** — id, titulo, descricao, periodo_inicio, periodo_fim, premiacao_total_brl, premios_jsonb, regulamento_url, status, created_at
  - Atenção: campo é `premiacao_total_brl` (Real), não Z$. Concurso paga em Real.
- **`inscricoes_concurso`** — id, user_id, concurso_id, qualificado, num_previsoes_atuais, num_categorias_atuais, brier_score_atual, posicao_atual, created_at
- **`concurso_resultados`** — id, concurso_id, user_id, brier_score, num_previsoes, num_categorias, posicao, premio_brl, pago_em (PIX), pix_transaction_id

#### Privadas (enforcement das travas)
- **`private_bet_pair_volume`** — pair_user_a, pair_user_b, year, total_z (em Z$, limite 5.000/ano)

#### Premium
- **`subscriptions`** — id, user_id, plan, status, started_at, current_period_end, canceled_at, provider, provider_subscription_id, provider_customer_id, price_brl
- **`subscription_events`** — id, subscription_id, event_type, payload_jsonb, created_at
- **`curadorias`** — id, topic_id, conteudo (jsonb), gerada_em, valida_ate, modelo, tokens_input, tokens_output

#### Dados bancários do usuário (para receber prêmio)
- **`user_payout_info`** — user_id (PK), nome_completo, cpf (unique), pix_key, pix_key_type, declaracao_tributacao_aceita_em, created_at, updated_at

#### Profiles (extensão)
- **`pode_criar_economico`** (bool, default false) — admins sempre podem
- **`is_premium`** (bool, default false) — atualizada por subscription_events trigger

### Wallet flow

#### Z$ (Econômico, Privadas, Liga — todos juntos numa carteira só)
- **Mercado primário**: débito na criação do palpite (optimistic lock)
- **Mercado secundário**: balance validado na ordem, débito só na execução do trade
- **Tipos de transação**: `palpite_aberto`, `palpite_ganho`, `palpite_reembolso`, `comissao`, `palpite_encerrado`, `bonus_semanal`, `bonus_onboarding`, `trade_compra`, `trade_venda`, `comissao_secundario`
- Toda mutação usa optimistic locking
- **Não permite saque, não permite conversão para Real**

#### Real (R$ — fora da carteira Z$)
- **Entrada**: pagamento de Premium (mensal recorrente) ou inscrição em concurso (futuro)
- **Saída**: pagamento de prêmio de concurso vencido (PIX direto da conta operacional Zafe → conta do vencedor)
- **Nunca cruza com Z$.** Não há tabela `wallets` em Real. Não há saldo em Real do usuário dentro da plataforma.

**Regra crítica:** as duas economias (Z$ virtual e R$ real) **nunca se misturam**. O Z$ vive nas tabelas `wallets` e `transactions`. O R$ vive em `subscriptions`, `concurso_resultados.premio_brl`, e `user_payout_info`. Não há query, função ou trigger que converta entre os dois.

---

## Notificações

Dois canais: insert em `notifications` (in-app) + `sendPushToUser()` (Web Push). Não-bloqueante via `Promise.allSettled`.

### Tipos existentes (preservar)
- `market_closing` — 2h antes do fechamento (cron `fechar-mercados` envia push **e** insere)
- `bet_won`, `bet_lost`, `bet_refund`
- Convites e respostas em Privadas, juízes, votação

### Tipos novos
- `concurso_iniciado`, `concurso_inscrito`, `concurso_finalizado`, `concurso_premiado` (esse último com link pra cadastro de PIX)
- `liga_subiu_ranking`
- `economico_evento_proximo`
- `premium_ativado`, `premium_renovado`, `premium_cancelado`, `premium_pagamento_falhou`
- `curadoria_disponivel` — quando nova curadoria é gerada para um evento que o Premium tem palpite

---

## Crons

### Existentes (preservar)
- **`POST /api/cron/fechar-mercados`** — eventos expirados → `resolving`, snapshots, paga contestações expiradas, dispara oracle para desafios. Notifica `market_closing` 2h antes.
- **`POST /api/cron/resolver-oracle`** — processa eventos em `resolving` via 4 camadas
- **`POST /api/cron/match-orders`** — matching periódico do secundário
- **`POST /api/cron/repor-mercados`** — popula listagem automática (Econômico e Liga)
- **`POST /api/cron/bonus-semanal`** — distribui Z$ semanal aos ativos
- **`POST /api/cron/apostas-privadas-timeout`** — expira convites pendentes

### Crons novos
- **`POST /api/cron/atualizar-ranking-concurso`** (diário) — recalcula Brier score de cada inscrito
- **`POST /api/cron/finalizar-concurso`** (diário, idempotente) — congela ranking ao fim do período e dispara payout em Real
- **`POST /api/cron/zerar-volume-anual-privadas`** (1× ao ano em 31/12)
- **`POST /api/cron/cobrar-premium`** (diário) — verifica assinaturas expirando, dispara cobrança/cancelamento
- **`POST /api/cron/gerar-curadorias`** (a cada 6h) — pré-gera curadoria para top 20 eventos por volume

---

## Avaliação de prova (Desafios)

Mantida como está:

1. Frontend envia `proof_url` ou `raw_image_base64` para `POST /api/desafios/[id]/submeter-prova`
2. `processProof()` em `lib/proof-processor.ts`:
   - Links → `fetchText`
   - Fotos → base64 + Google Vision (`GOOGLE_VISION_API_KEY`)
   - YouTube → oEmbed + thumbnail
   - Retorna `ProcessedProof`
3. Sonnet 4.6 recebe e retorna `{ aprovado, confianca, motivo }`
4. Aprovado → `under_contestation` (48h); rejeitado → `+24h` para nova prova

### Status de desafio (preservar)
`active` → `resolving` → `awaiting_proof` → `proof_submitted` → `under_contestation` → `admin_review` → `resolved` | `cancelled`

### Comissão dos Desafios
6% creator + 6% platform + 88% para vencedores (em Z$).

### Onde ficam os Desafios pós-pivot

Decisão pendente — mover para `/privadas/desafios/` como subcategoria de Privadas, ou manter como categoria própria em `/liga/desafios/`. Ambas em Z$.

---

## SEO / Sitemap

- **`app/sitemap.xml/route.ts`** — dynamic route handler usando `createAdminClient()`. Inclui `/economico/*`, `/liga/*`, `/privadas/*`, `/premium`, `/concurso`.
- **Deploy:** `zafe-rho.vercel.app` (vai virar `zafe.com.br` na Fase 2 do roadmap operacional). Sem GitHub auto-deploy — `npx vercel --prod`.

---

## OG Image

- **`GET /api/og?id=[uuid]&type=economico|liga|privada|desafio|concurso`** — gera 1200×630 via `next/og` (edge runtime)
- Mostra título, barra de probabilidade SIM/NÃO, volume total em Z$, categoria, badge do pilar
- Usado em `generateMetadata` de cada página individual

---

## Trending Feed

- **`/liga?tab=em-alta`** — calcula volume de palpites por evento nas últimas 2h
- Badge "+Z$ X / 2h" por card
- Ranking #1/#2/#3
- **Não** existe trending no Econômico no MVP

---

## ResolvingBanner

- **`components/topicos/ResolvingBanner.tsx`** — client component com polling (renomear para `EventoResolvingBanner` na Fase 4)
- Polling a cada 5s via `GET /api/economico/[id]/status`, `GET /api/liga/[id]/status`, `GET /api/desafios/[id]/status`
- `router.refresh()` automático quando status muda
- Após 120s mostra fallback ("admin resolverá em breve")

---

## Notificação in-app 2h antes do fechamento

- Cron `fechar-mercados` envia push 2h antes **e** insere em `notifications` com type `market_closing`
- Continua valendo para Econômico e Liga

---

## Perfil público

- **`app/(main)/u/[username]/page.tsx`**
- Mostra:
  - Vitórias, derrotas, taxa de acerto
  - **P&L em Z$** (Econômico/Privadas/Liga unificado)
  - Sequência atual, melhor categoria, histórico de palpites
  - **Brier score agregado** (vida toda + temporada atual)
  - Posições em concursos passados
  - Badge premium se `is_premium = true`
  - Badge "Top 1%", "Top 10%" baseado em ranking de calibração
- **Não mostra valores em Real** — perfil é público, dados de prêmios bancários são privados

---

## Plano de migração de nomenclatura

### Fase 1 — Copy e UI (sem mexer em banco)
- Substituir todas as strings voltadas ao usuário usando o vocabulário desta doc
- Renomear seções: "Tópicos" → "Liga", "Apostas Privadas" → "Privadas", criar "Econômico"
- Filtrar tópicos: categoria `economia` → `/economico`, resto → `/liga`
- Adicionar banner de concurso em `/liga` com inscrição grátis
- Adicionar restrição: criação de evento só admin/sistema no Econômico
- **Adicionar tooltip permanente em cada saldo Z$**: "Z$ é a moeda virtual da Zafe. Não convertível em dinheiro real."

### Fase 2 — Rotas e API
- Aliases: `/topicos` → 301 para `/liga` (ou `/economico` se categoria `economia`)
- `/apostas-privadas` → 301 para `/privadas`
- Novos endpoints: `/api/economico/*`, `/api/liga/*`, `/api/privadas/*`, `/api/concurso/*`, `/api/premium/*`
- Manter rotas antigas como deprecated por 60 dias

### Fase 3 — Schema
- Adicionar `concursos`, `inscricoes_concurso`, `concurso_resultados`
- Adicionar `private_bet_pair_volume`
- Adicionar `subscriptions`, `subscription_events`, `curadorias`, `user_payout_info`
- Adicionar colunas `pode_criar_economico`, `is_premium` em `profiles`
- **Não criar `liga_wallets` separada** — todos os pilares usam a `wallets` única (Z$)

### Fase 4 — Refactor de código (opcional)
- `Topic` → `Evento` com discriminator `pilar`
- `Bet` → `Palpite`

---

## Modelo de receita

| Pilar | Como ganha | O que entra | Risco regulatório |
|---|---|---|---|
| Econômico | Comissão de plataforma sobre Z$ | Não gera receita em Real direta | Baixo |
| Privadas | Comissão sobre Z$ | Não gera receita em Real direta | Médio (mitigado por travas) |
| Liga | Premium + patrocínio + inscrição em concurso futuro | Mensalidade Premium, patrocínio de concurso, inscrição em concurso paga (futuro) | Muito baixo |
| Premium | Mensalidade R$ 19,90/mês | **Receita principal em Real** | — |

**Importante:** o Z$ não é fonte direta de receita em Real. As comissões em Z$ servem para balancear o jogo (sumidouro virtual que evita inflação de Z$ no sistema). A receita real vem **integralmente** de Premium e patrocínio.

### Projeção ano 1 (100k usuários ativos, conservador)
- **Premium**: 3% conversão × R$ 19,90 × 12 = **R$ 720k**
- **Patrocínio Liga**: 4 majores × R$ 150k = **R$ 600k**
- **Inscrição em concurso paga (a partir do mês 8-10)**: difícil estimar, depende da decisão de cobrar
- **Dados B2B (mídia)**: **R$ 240k**
- **Total**: **~R$ 1,56 mi**

(A projeção desceu vs versão anterior porque a receita de comissão em Real do Econômico saiu da conta — agora aquele pilar é virtual.)

---

## Política de versionamento

- **Major features** → novo git tag: `v1.4`, `v1.5`, etc.
- **Small fixes** → in-place edits.
- Versão atual: **v1.3** (Trending feed, OG image, ResolvingBanner, notificação in-app 2h)
- Próxima major: **v2.0** — pivot completo + Premium + estrutura monetária nova (Real só em Premium e Concurso)

---

## Idioma

Todo texto de UI, nomes de rota, variáveis e conteúdo voltado ao usuário em **Português Brasileiro (pt-BR)**.

Aplicar a tabela de vocabulário proibido em qualquer copy nova ou existente.

---

## Decisões pendentes

1. **Preço da Premium**: R$ 19,90/mês é o palpite. Validar no beta fechado do Premium.
2. **Periodicidade dos concursos**: mensal (default), quinzenal, semanal? Mensal é o default.
3. **Marca dos pilares**: "Zafe Econômico", "Zafe Liga", "Zafe Privadas", "Zafe Premium"?
4. **Comunicação aos usuários atuais**: como anunciar a virada sem assustar? Email + banner in-app + post no blog parecem o mínimo.
5. **Desafios — destino**: subcategoria de Privadas ou de Liga?
6. **Estrutura final dos prêmios mensais**: R$ 2.500 totais é o palpite.
7. **Provedor de pagamento Premium**: Stripe, Pagar.me, Iugu? Com PIX recorrente.
8. **Inscrição em concurso paga — quando ligar e quanto cobrar**: começa grátis. Possível formato futuro: R$ 9,90 por concurso ou tier específico via Premium.
9. **Tom da curadoria Premium**: completamente neutra (apenas fatos), levemente analítica, ou opinativa? Recomendação: completamente neutra para evitar problema regulatório.

---

## Referências legais (defesa jurídica)

- **Resolução CMN nº 5.298/2026** — proíbe mercado preditivo de eventos não-econômicos. Art. 3º.
- **Lei 5.768/71** — concursos com prêmio. Art. 1º (concurso de previsões/cálculos exige autorização SECAP) e Art. 3º, II (concurso cultural sem álea e sem pagamento dispensa autorização).
- **Decreto 70.951/72** — regulamenta a 5.768. Art. 30.
- **Decreto 9.215/17** — poker como jogo de habilidade (base analógica para Liga).
- **Lei 14.790/23** — bets de quota fixa (modelo do qual a Zafe se distancia explicitamente).
- **Lei 14.478/22** — Marco Legal das Criptos (não usado aqui pois Z$ é virtual sem pretensão de cripto).
- **Lei 11.196/2005, Art. 70** — incidência de IR de 30% sobre prêmios em dinheiro acima do limite de isenção.
- **LGPD (Lei 13.709/2018)** — proteção de dados pessoais (CPF, dados bancários do usuário).

Para concursos majores acima do limite SECAP, registrar via processo formal na Secretaria de Prêmios e Apostas (Ministério da Fazenda), categoria "concurso de previsões, cálculos, testes de inteligência" (literal do Art. 1º da Lei 5.768/71). Custo: 10% sobre valor total dos prêmios. Coberto pelo patrocínio.
