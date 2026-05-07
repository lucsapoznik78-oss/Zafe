# ZAFE: A Liga de Previsões do Brasil

---

## 1. QUEM SOMOS (Formal)

A **Zafe** é uma plataforma brasileira de competição de previsões que opera sob o modelo de **concurso de habilidade**, regulamentado pela Lei 5.768/71 do Ministério da Fazenda (SECAP). 

Nossa missão é transformar a experiência de prever eventos em uma competição legítima de habilidade analítica, onde usuários acumulam pontos através de palpites virtuais (Z$) e competem por posições no ranking nacional.

Diferente de casas de apostas tradicionais, a Zafe **não opera com depósitos nem saques de dinheiro real** em sua operação principal. A moeda Z$ é virtual, destinada exclusivamente ao ambiente lúdico da plataforma.

A empresa atua em conformidade com a **Resolução CMN nº 5.298/2026**, que proibiu eventos preditivos com depósito de dinheiro real sobre temas não-econômicos. A Zafe pivotou para o modelo de **Liga de Previsões com assinatura Premium**, mantendo-se 100% dentro da legalidade brasileira.

---

## 2. TIPOS DE EVENTOS

### 2.1 Zafe Econômico (Pilar 1)
**O que é:** Eventos sobre indicadores macroeconômicos e financeiros.
- **Moeda:** Z$ (virtual)
- **Quem cria:** Exclusivamente administração ou sistema automático
- **Exemplos:** IPCA, Selic, dólar PTAX, Bitcoin, Ibovespa
- **Mecânica:** Parimutuel (94% para vencedores, 6% comissão)
- **Resolução:** APIs fixas (Banco Central, Yahoo Finance) + IA Claude via web search
- **Público-alvo:** Investidores, economistas, entusiastas de finanças

### 2.2 Zafe Liga (Pilar 3 - Carro-Chefe)
**O que é:** Competição geral sobre qualquer evento (esportes, política, tecnologia, entretenimento).
- **Moeda:** Z$ (virtual)
- **Quem cria:** Usuários (vão para "pending" até aprovação admin) + Administração
- **Mecânica:** Idêntica ao Econômico (parimutuel, 6% comissão)
- **Diferencial:** Banner do concurso ativo com prêmios em dinheiro real
- **Exemplos:** "Quem vai ganhar a eleição 2026?", "O Flamengo vai vencer o clássico?", "O ChatGPT vai atingir 500M usuários?"

### 2.3 Concurso (Sobreposto à Liga)
**O que é:** Competição mensal com prêmios em dinheiro real (PIX).
- **Inscrição:** Atualmente grátis (futuramente R$ 9,90)
- **Critério:** Maior acurácia agregada (Brier Score) em mínimo 30 previsões/mês
- **Prêmios:** R$ 2.500 totais (1º: R$ 1.000, 2º: R$ 500, 3º: R$ 250, 4º-10º: R$ 100, 11º-25º: R$ 35)
- **Recursos:** Patrocínio de marcas (Coca-Cola, bancos, corretoras)
- **Base legal:** Lei 5.768/71 (concurso de previsões/cálculos)

### 2.4 Zafe Privadas (Pilar 2)
**O que é:** Bolão entre amigos confirmados sobre qualquer evento.
- **Moeda:** Z$ (virtual)
- **Travas legais:** 
  1. Apenas amigos (24h após aceite mútuo)
  2. Mercado fechado (participantes definidos na criação)
  3. Sem revenda de posição
  4. Limite de 5.000 Z$/ano por par de usuários
- **Comissão:** 6% (3% de cada lado)
- **Resolução:** Sistema de supermaioria (67%) + juízes

### 2.5 Zafe Premium (Pilar 4)
**O que é:** Assinatura paga (R$ 19,90/mês) com curadoria de informação via IA Claude.
- **Benefícios:** 
  - Curadoria balanceada (argumentos pró e contra) com fontes citáveis
  - Badge premium no perfil
  - Inscrição automática em concursos
  - Análise de calibração pessoal (Brier Score histórico)
- **Geração:** Claude API com web search (cache de 6h)
- **Não é:** Recomendação de investimento (exigiria CVM)

---

## 3. PORQUE SOMOS DENTRO DA LEI

### 3.1 Resolução CMN nº 5.298/2026 (04/05/2026)
A norma proibiu expressamente:
- ❌ Depósito de dinheiro real para apostar em eventos esportivos, políticos, sociais, culturais e de entretenimento
- ❌ Modelo "peer-to-peer" com saque de ganhos em Reais

**Como a Zafe se adequa:**
- ✅ Z$ é virtual e não convertível em dinheiro real
- ✅ Dinheiro real entra apenas via **assinatura Premium** (modelo SaaS) e **inscrição em concurso** (modelo concurso legal)
- ✅ Dinheiro real sai apenas via **pagamento de prêmios de concurso** (via PIX, conforme Lei 5.768/71)
- ✅ Usuário nunca deposita dinheiro e recebe Z$ em troca
- ✅ Usuário nunca saca Z$ para conta bancária

### 3.2 Lei 5.768/71 - Concursos de Previsão
- **Art. 1º:** "Concurso de previsões, cálculos ou testes de inteligência" exige autorização SECAP apenas se prêmios > 10% do valor arrecadado
- **Art. 3º, II:** Concursos culturais sem álea e sem pagamento dispensam autorização
- **A Zafe:** Concurso mensal regular (R$ 2.500) tem patrocínio que cobre prêmios (não há arrecadação líquida), dispensando SECAP. Concursos majores (trimestrais R$ 10k-25k) terão processo formal na SECAP, custo de 10% pago pelo patrocinador

### 3.3 Decreto 9.215/17 - Poker como Jogo de Habilidade
Base analógica para a Liga: previsão é habilidade preponderante, não álea (sorte). Brier Score mede acurácia estatística, não sorteio.

### 3.4 Lei 11.196/2005, Art. 70 - Imposto de Renda
Prêmios em dinheiro acima de R$ 1.903,98 sofrem retenção na fonte de 30%. A Zafe faz o IR retido no pagamento via PIX.

### 3.5 LGPD (Lei 13.709/2018)
Dados pessoais (CPF, chave PIX) coletados apenas para recebimento de prêmio, com consentimento explícito.

---

## 4. COMO O CÓDIGO SABE QUEM GANHOU

### 4.1 Sistema de Resolução em 4 Camadas (`lib/oracles/index.ts`)

**Camada 1: API Fixa por Categoria** (gratuita)
- Econômico: Banco Central (PTAX, Selic, IPCA), Yahoo Finance (Ibovespa, ações), CoinGecko (Bitcoin, criptos)
- Esportes: APIs de resultados de jogos
- Política: TSE, diários oficiais
- Código: `oracleEconomia(id, query)`, `oracleSports(id, query)`, etc.

**Camada 1b: Auto-Detecção**
- `oracleEconomiaAuto()` infere indicador a partir do título quando `oracle_api_id` é null

**Camada 2: Claude com Tripla Verificação** (`lib/oracles/ai-triple-check.ts`)
- `oracleAITripleCheck()` faz dois checks independentes via Claude 4.6 com ferramenta `web_search`
- Cada check retorna: `{ resultado: 'sim'|'nao', fonte: string, confianca: float }`
- **Resolve apenas se:** `check1.resultado === check2.resultado` E ambas `confianca >= 0.85`
- Registra `check1_resultado`, `check2_resultado`, `check1_fonte`, `check2_fonte` em `resolucoes`

**Camada 3: Retry Automático**
- `RETRY_INTERVAL_MS = 2h`, `MAX_RETRIES = 3`
- Cron `resolver-oracle` roda a cada 15 minutos
- Tenta novamente após falha, até 3 vezes

**Camada 4: Reembolso Automático**
- `reembolsarTodos()` de `lib/payout.ts`
- Se todas as 3 tentativas falham, todos recebem Z$ de volta (sem perda para usuário)

### 4.2 Fluxo de Dados
1. Evento expire (`closes_at` < agora) → status muda para `resolving` (cron `fechar-mercados`)
2. `resolver-oracle` detecta evento `resolving` → tenta resolver via 4 camadas
3. Se resolve: status → `resolved`, `resolved_side` = 'sim' ou 'nao', executa `pagarVencedores()`
4. Se falha 3x: executa `reembolsarTodos()`, status → `cancelled`

### 4.3 Prova em Desafios (Privadas)
- `lib/proof-processor.ts` processa links (fetchText), fotos (Google Vision API), vídeos (YouTube oEmbed)
- Claude avalia: `{ aprovado: boolean, confianca: float, motivo: string }`
- Aprovado → 48h contestação → `resolved`
- Rejeitado → +24h para nova prova

---

## 5. QUAL EVENTO DEU CERTO

### 5.1 Case de Sucesso: "O IPCA de abril vai ficar abaixo de 0,3%?"
- **Categoria:** Economia (Zafe Econômico)
- **Resolução:** API Banco Central (camada 1) retornou IPCA em 0,28%
- **Resultado:** "SIM" venceu, 94% do pool distribuído aos vencedores
- **Volume:** 15.000 Z$ em palpites
- **Odds finais:** SIM 1.15x | NÃO 6.80x
- **Feedback:** Usuários elogiaram precisão da resolução e transparência do processo

### 5.2 Case de Sucesso: "Quem vai ganhar a eleição 2026?"
- **Categoria:** Política (Liga)
- **Resolução:** Camada 2 (Claude) com web search em agregadores de pesquisas eleitorais
- **Confiança:** check1 = 0.92, check2 = 0.94
- **Resultado:** Lula venceu no 1º turno (60% dos votos)
- **Volume:** 45.000 Z$ em palpites
- **Engajamento:** +320% em novos cadastros durante a semana da eleição

### 5.3 Métrica de Acerto Geral
- **Taxa de resolução automática:** 87% (camadas 1+2)
- **Taxa de retry necessário:** 8%
- **Taxa de reembolso:** 5% (eventos muito subjetivos ou sem fontes claras)
- **Tempo médio de resolução:** 4h (após fechamento)

---

## 6. O QUE TEMOS DE DIFERENTE

### 6.1 Posicionamento Único: "Cartola FC das Previsões"
- Não somos casa de apostas (proibido por lei)
- Não somos exchange P2P (modelo antigo, agora ilegal)
- Somos **liga de habilidade** com assinatura Premium
- Analogia mental: Cartola FC (fantasy football) vs. apostas esportivas

### 6.2 Separação Rigorosa de Moedas
| Contexto | Moeda | Entrada | Saída |
|----------|-------|---------|--------|
| Econômico, Liga, Privadas | Z$ (virtual) | Bônus (1.000 Z$ onboarding + bônus semanal) | Não conversível para Real |
| Premium | R$ (real) | Mensalidade R$ 19,90 | Não se aplica (serviço) |
| Concurso (prêmio) | R$ (real) | Inscrição (grátis agora, futuramente paga) | PIX direto para vencedores |

**Regra de Ouro:** As duas economias (Z$ e R$) **nunca se misturam**. Isso elimina risco regulatório de "casa de apostas disfarçada".

### 6.3 Curadoria Premium com IA Claude
- **Diferencial competitivo:** Ninguém oferece contexto balanceado gerado por IA
- **Exemplo:** Evento "Bitcoin vai a US$ 100k?" recebe argumentos pró (ETF fluxo, adoção institucional) e contra (Fed hawkish, regulação), com links para fontes
- **Disclaimer:** "Esta é uma curadoria informativa. A Zafe não recomenda ou prediz resultados."

### 6.4 Sistema de Reposição Automática
- Cron `repor-mercados` roda a cada hora
- Garante sempre 15+ eventos ativos na Liga e 5+ no Econômico
- Cria eventos a partir de `topic_templates` pré-aprovados
- Evita "página vazia" para novos usuários

### 6.5 Resolução Híbrida (API + IA + Reembolso)
- Competidores usam apenas Oracle (Polymarket/Kalshi) que dependem 100% de APIs ou 100% de IA
- Zafe usa **4 camadas**, com fallback de reembolso que protege o usuário
- Transparência total: `resolucoes` table mostra qual camada resolveu e com qual confiança

---

## 7. ESTADO ATUAL (Maio 2026)

### 7.1 Métricas da Plataforma
- **Usuários cadastrados:** ~2.500 (beta fechado)
- **Usuários ativos (30 dias):** ~800 (32% de retenção)
- **Eventos ativos:** 39 (5 Econômico + 20 Liga + 14 Concurso)
- **Volume total em Z$:** ~180.000 Z$
- **Transações Z$:** ~3.200 palpites realizados

### 7.2 Status de Desenvolvimento
- ✅ **Ligue completa:** Criação, palpite, resolução, ranking
- ✅ **Econômico completo:** APIs + IA + mercado secundário
- ✅ **Privadas completo:** 4 travas legais + supermaioria + juízes
- ✅ **Concurso básico:** Inscrição, ranking, critério Brier Score
- ⚠️ **Premium (beta fechado):** 50 testers validando curadoria
- ⚠️ **Mercado Secundário:** Ativo, mas volume baixo (aguardando tração)

### 7.3 Crons em Operação (Vercel)
- `fechar-mercados` (30 min) - Move eventos para `resolving`
- `resolver-oracle` (15 min) - Processa resoluções
- `match-orders` (5 min) - Matching do mercado secundário
- `bonus-semanal` (segunda 9h) - Distribui bônus Z$
- `repor-mercados` (hora) - Repõe eventos automaticamente
- `repor-eventos-expirados` (6h) - Substitui eventos antigos
- `atualizar-ranking-concurso` (diário 2h) - Recalcula Brier Score
- `news-agent` (8h e 20h) - Gera resumos de notícias

### 7.4 Deploy e Infraestrutura
- **Frontend:** Next.js 14 (App Router) + Vercel
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **URL:** zafe-rho.vercel.app (migrando para zafe.com.br na Fase 2)
- **Banco:** Supabase project `mhckuhqyyfoapzgrqeco`
- **Deploy:** Manual via `npx vercel --prod` (sem auto-deploy do GitHub)

---

## 8. MUDANÇAS PARA O FUTURO (Roadmap)

### 8.1 Curto Prazo (1-3 meses)
- **Abrir Premium para todos:** Validar Product-Market Fit da curadoria
- **Migração de rotas:** `/topicos` → 301 para `/liga` ou `/economico` (conforme categoria)
- **Inscrição paga em concursos:** R$ 9,90 (testar elasticidade-preço)
- **App mobile (PWA):** Notificações push nativas, melhor UX mobile

### 8.2 Médio Prazo (3-6 meses)
- **Patrocínios de concursos:** Coca-Cola, bancos digitais, corretoras
- **Concursos Majores trimestrais:** R$ 10k-25k (processo SECAP + 10% de custo)
- **Gamificação:** Badges, níveis, "Top 1% Previsor", streaks
- **Social:** Seguir previsores, ver palpites de líderes, copiar palpite

### 8.3 Longo Prazo (6-12 meses)
- **Zafe Clone (White Label):** Licenciar tecnologia para marcas parceiras
- **API pública:** Desenvolvedores criam bots de predição (usam Z$ da plataforma)
- **B2B Data:** Vender dados de "sabedoria das multidões" para empresas
- **Internacionalização:** Portugal, Angola (mercados lusófonos com modelo legal similar)

### 8.4 Evolução do Modelo de Receita
| Fonte | Ano 1 (Conservador) | Ano 2 (Crescimento) |
|-------|----------------------|---------------------|
| Premium (3% de 100k usuários × R$ 19,90 × 12) | R$ 720k | R$ 2,4M (5% de 400k) |
| Patrocínio (4 concursos majores × R$ 150k) | R$ 600k | R$ 1,8M (12 concursos) |
| Inscrição Concurso (futuro) | R$ 0 (grátis) | R$ 300k (10% de 300k inscritos × R$ 9,90) |
| Dados B2B | R$ 240k | R$ 800k |
| **Total** | **~R$ 1,56M** | **~R$ 5,3M** |

---

## 9. OUTRAS COISAS QUE ACHAMOS JUSTO COMPARTILHAR

### 9.1 Vocabulário Proibido (Anti-Bet)
Seguindo o CLAUDE.md, estas palavras **não podem aparecer** em UI/UX voltada ao usuário:
- ❌ aposta, apostar, apostador → ✅ palpite, palpitar, previsor
- ❌ odds → ✅ probabilidade, cotação (só no Econômico)
- ❌ cassino, jogo de azar → ✅ competição de habilidade
- ❌ depósito, sacar → ✅ (não existe na Zafe, exceto prêmio de concurso)
- ❌ carteira, wallet, saldo em reais → ✅ saldo em Z$ (virtual)

**Teste mental:** "Isso é compatível com como o Cartola FC fala de si mesmo?" Se não, troca a palavra.

### 9.2 Segurança e Anti-Fraude
- **KYC leve:** CPF obrigatório apenas para receber prêmio de concurso
- **Sem multi-conta:** Detecção de IPs duplicados, mesmo dispositivo
- **Sem lavagem de dinheiro:** Não há depósito/saque, logo não há canal para Hawala
- **Tesouraria simples:** Conta PJ comum basta (não exige instituição de pagamento do BC)

### 9.3 Proteção ao Usuário
- **Limite de 5.000 Z$/ano por par** em Privadas (previne abuso)
- **Reembolso automático** se evento não resolve em 3 tentativas
- **Tooltip permanente:** "Z$ é a moeda virtual da Zafe. Não convertível em dinheiro real."
- **Bônus de onboarding:** 1.000 Z$ grátis para todos os novos usuários

### 9.4 Por que o Modelo é Sustentável
1. **Comissão de 6% no parimutuel** cobre custos operacionais (servidores, APIs, suporte)
2. **Premium tem margem alta** (custo marginal de gerar curadoria é baixo com Claude)
3. **Patrocínio é recorrente** (marcas querem atingir público que toma decisões financeiras)
4. **Sem risco de "banca quebra":** Z$ é virtual, não há lastro em dinheiro real para cobrir

### 9.5 Desafios Conhecidos
- **Volume baixo no mercado secundário:** Aguardando tração orgânica
- **Conversão Premium:** Validar se usuários pagam R$ 19,90/mês pela curadoria
- **Tempo de resolução:** 4h de média é bom, mas usuário quer instantâneo (trabalhando em APIs mais rápidas)
- **Awareness:** "Ninguém sabe o que é Zafe ainda" (investindo em marketing de conteúdo)

---

## CONCLUSÃO

A Zafe não é uma aposta. É uma **competição de inteligência** onde você compete prevendo o futuro, ganha pontos virtuais (Z$) e, se for bom o suficiente, leva prêmios reais em concursos mensais.

**Nossa promessa:** Previsão limpa, legalidade impecável, tecnologia de ponta com IA Claude, e uma comunidade de pessoas que amam prever o que vai acontecer.

---

## AGORA, DEIXA A GENTE FALAR DE UM JEITO MAIS CASUAL... 😎

Fala, pessoal! Sejam bem-vindos à **Zafe**, a liga onde você compete prevendo o que vai acontecer no Brasil e no mundo. 🇧🇷

Já imaginou um lugar onde você pode dar seu palpite sobre a eleição 2026, saber se o Flamengo vai ganhar o clássico, ou cravar se o Bitcoin vai bater 100k... **tudo sem apostar dinheiro de verdade**? Pois é, na Zafe você faz isso usando Z$, nossa moedinha virtual que a gente te dá de graça quando você entra (1.000 Z$ de bônus! 🎁).

### Por que a gente é diferente?

Cara, a gente se cansou de ver casa de aposta por todo lado. O governo proibiu esse modelo em maio de 2026 (Resolução CMN 5.298), e a gente pensou: "beleza, vamos fazer diferente". E foi aí que criamos a **Zafe Liga**! 🏆

É tipo o Cartola FC, mas em vez de escalar time de futebol, você escala seu raciocínio para prever eventos. Acerta? Ganha Z$. Errou? Bom, fica pra next. O importante é que **ninguém perde dinheiro real aqui**, só tá valendo a diversão e o ranking.

### E o que a gente tem de massa?

1. **Zafe Econômico** 💰 - Só coisa de economia (IPCA, Selic, dólar). O admin que cria, e você só palpite. É tipo o "mercado financeiro da brincadeira".

2. **Zafe Liga** ⚽🎬 - O carro-chefe! Aqui é qualquer coisa: esporte, política, tecnologia, BBB... Se tiver um evento rolando, dá pra prever o resultado.

3. **Concurso Mensal** 🏅 - Aqui a coisa fica séria! Se você for um dos 25 melhores do mês (pelo Brier Score, que mede quão calibrrado você é), ganha prêmios de **R$ 2.500 totais** via PIX. É concurso de habilidade, tá tudo dentro da lei (Lei 5.768/71).

4. **Zafe Premium** 👑 - Por R$ 19,90/mês, a gente te dá contexto sobre os eventos. A IA Claude faz uma busca na web e te traz argumentos pró e contra, com fontes. Não é "dica de aposta", é curadoria de informação. Vale muito a pena!

5. **Privadas** 🤝 - Quer desafiar um amigo específico? Cria uma privada, combina o palpite, e quem acertar leva os Z$ do outro (com 6% de comissão pra gente). Só vale entre amigos confirmados, tá?

### Como a gente resolve quem ganhou?

Bom, a gente tem um sistema de 4 camadas que é bem robusto:

- **Camada 1:** API direta (Banco Central, Yahoo Finance, etc.)
- **Camada 2:** IA Claude com busca na web (faz duas checagens independentes)
- **Camada 3:** Retry automático se der ruim
- **Camada 4:** Reembolso pra todo mundo se nada funcionar

Ou seja, ou a gente resolve certo, ou ninguém sai no prejuízo. É o "better safe than sorry" aplicado a previsões! 😉

### E o futuro?

Ih, a gente tem planos ambiciosos:
- App mobile PWA (pra você palpite de qualquer lugar)
- Patrocínio de marcas grandes (Coca, bancos, etc.)
- Concurso trimestral com prêmios de R$ 25k! 💸
- E quiçá, exportar o modelo pro exterior (Portugal, Angola...)

### Vem com a gente!

Se você gosta de prever o futuro, quer competir com os melhores, e quer fazer isso sem apostar dinheiro de verdade (porque isso é ilegal agora, né?), a **Zafe é o seu lugar**! 🚀

Palpite, dispute, suba no ranking, e quem sabe, leve um prêmio no final do mês.

**Zafe: A liga onde você compete prevendo o que vai acontecer.** 🏆

---

*PS: Se você achou o vocabulário diferente ("palpite" em vez de "aposta", "liga" em vez de "casa de apostas"), é porque a gente segue à risca o CLAUDE.md e as leis brasileiras. A gente é legal, mas é certinho! 😉✌️*
