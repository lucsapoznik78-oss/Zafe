-- ============================================================
-- ZAFE — Migration 075: Modo Escalação (fantasy de escalação, formato Cartola)
-- ============================================================
-- O usuário monta um time de atletas reais e pontua pelo desempenho deles em
-- competições oficiais. Roda na ZONA GRÁTIS, em Z$, com ranking próprio e SEM
-- qualquer ligação com o Concurso Mensal (Art. 3 do regulamento).
--
-- Reforço de enquadramento: o art. 49, IV da Lei 14.790/2023 exige que o
-- resultado não dependa do desempenho isolado de uma única pessoa. Um time de
-- 12 atletas satisfaz o inciso com folga.
--
-- Padrão herdado da migration 045 (Zafe Games):
--   * RPCs de dinheiro em SECURITY DEFINER + SET search_path, service_role only;
--   * débito por UPDATE ... WHERE balance >= X (mais forte que o CAS de lib/wallet.ts);
--   * idempotência por CAS em <coluna>_em IS NULL com FOR UPDATE;
--   * RLS de leitura autenticada, escrita só por service role;
--   * RLS anti-cópia de escalação (time alheio só após a trava);
--   * view com security_invoker = on.
--
-- DIFERENÇA ÚNICA em relação a todo módulo existente: Escalação EMITE Z$
-- (pontos viram saldo). A conservação não é abandonada, é reescrita e
-- contabilizada em escalacao_emissao — ver seção 12 e modules/escalacao/COMPLIANCE.md.
--
-- As regras de pontuação NÃO estão aqui. Elas são um DSL tipado em JSONB
-- (escalacao_regra.regras), avaliado por lib/escalacao/scoring.ts. Um esporte
-- novo (boxe, F1, Champions, tênis) entra como INSERT — sem migration, sem deploy.

-- ------------------------------------------------------------
-- 1. Enums (declarados aqui; primeiro uso só em runtime, dentro de funções)
-- ------------------------------------------------------------
-- Cuidado: valor adicionado por ALTER TYPE não pode ser USADO na mesma
-- transação. Por isso nenhum deles aparece em CHECK ou DEFAULT desta migration.
ALTER TYPE transaction_type  ADD VALUE IF NOT EXISTS 'escalacao_buy_in';
ALTER TYPE transaction_type  ADD VALUE IF NOT EXISTS 'escalacao_premio';
ALTER TYPE transaction_type  ADD VALUE IF NOT EXISTS 'escalacao_refund';

-- ------------------------------------------------------------
-- 2. Catálogo de esportes e competições (DADO, não enum)
-- ------------------------------------------------------------
-- Esporte novo = INSERT. É isso que faz os 4 manuais que faltam custarem zero
-- migration.
CREATE TABLE IF NOT EXISTS escalacao_esporte (
  key             TEXT PRIMARY KEY,                   -- 'ufc', 'surf', 'f1', ...
  nome            TEXT NOT NULL,
  -- Teto de atletas do mesmo esporte no time (Art. 10). O card pode apertar
  -- mais, nunca afrouxar — ver escalacao_valida_time().
  teto_titulares  SMALLINT NOT NULL DEFAULT 4 CHECK (teto_titulares > 0),
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ordem           SMALLINT NOT NULL DEFAULT 0,        -- ordem de exibição
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalacao_competicao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,               -- 'wsl-ct', 'ucl', 'f1-2026'
  nome            TEXT NOT NULL,
  esporte_key     TEXT NOT NULL REFERENCES escalacao_esporte(key),
  -- Em qual modo esta competição aparece. 'fixo' = liga própria; 'mix' = entra
  -- no card único do mês.
  modo            TEXT NOT NULL DEFAULT 'mix' CHECK (modo IN ('fixo','mix')),
  -- Override MAIS RESTRITIVO do teto (Champions = 3, Art. 11). NULL = sem
  -- restrição extra além do teto do esporte. Vale por competição, então a
  -- Premier League entrando no mix não afrouxa o teto de futebol.
  teto_titulares  SMALLINT CHECK (teto_titulares IS NULL OR teto_titulares > 0),
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Alvo de FK composta (escalacao_atleta).
  UNIQUE (id, esporte_key)
);

CREATE INDEX IF NOT EXISTS idx_escalacao_competicao_esporte
  ON escalacao_competicao(esporte_key, ativo);

-- ------------------------------------------------------------
-- 3. Rulesets versionados e imutáveis
-- ------------------------------------------------------------
-- A imutabilidade é requisito legal (Art. 24 § único + Art. 33): publicado, não
-- muda no mês vigente. Emenda = nova versão, válida do card seguinte. O manual
-- de surf emendou o de UFC (teto de +180 declarado regra geral do modo); isso
-- vira ufc.v2, com ufc.v1 intacto como registro do que vigorou.
CREATE TABLE IF NOT EXISTS escalacao_regra (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  esporte_key   TEXT NOT NULL REFERENCES escalacao_esporte(key),
  versao        INTEGER NOT NULL CHECK (versao >= 1),
  -- DSL tipado, validado por zod em lib/escalacao/rules.ts. Array ORDENADO de
  -- objetos { tipo: lookup|linear|bloco|faixa|limiar|flag|formula, ... }.
  regras        JSONB NOT NULL,
  -- Declaração dos stat_keys. GERA o formulário do painel admin — a UI de
  -- apuração não tem uma linha de código por esporte.
  stats         JSONB NOT NULL,
  -- Clamp sobre o agregado do evento (surf §7, adotado como regra do modo).
  teto_evento   NUMERIC(8,2) NOT NULL DEFAULT 180,
  piso_evento   NUMERIC(8,2) NOT NULL DEFAULT -25,
  -- UFC §9 SOMA as duas lutas do mês; surf §9 conta só o stop designado; F1 §3
  -- tira a MÉDIA das corridas em que o piloto largou. Sem esta coluna a
  -- agregação mensal viraria um `if` por esporte no TypeScript.
  --
  -- A média não é detalhe de F1: agosto e dezembro têm 1 GP e novembro tem 4.
  -- Somando, um piloto escalado em novembro valeria quatro vezes um de dezembro
  -- e ninguém escalaria F1 fora do mês cheio. O manual de tênis vai precisar da
  -- mesma solução (cinco partidas num único Masters 1000).
  agregacao_mes TEXT NOT NULL DEFAULT 'soma'
                  CHECK (agregacao_mes IN ('soma','media','melhor','designado')),
  -- Alvo de calibragem (33 a 36 pontos por atleta por mês, UFC §11).
  ev_alvo       NUMERIC(6,2),
  doc_url       TEXT,
  conteudo_hash TEXT NOT NULL,      -- sha256 do manual publicado
  publicado_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT escalacao_regra_clamp CHECK (piso_evento <= teto_evento),
  UNIQUE (esporte_key, versao)
);

-- ------------------------------------------------------------
-- 4. Card do mês — uma tabela, `modo` como discriminador
-- ------------------------------------------------------------
-- Fixo e mix compartilham o ciclo inteiro (card → pool → time → trava → stats →
-- pontos por atleta → acionamento de reserva → total do time → ranking → Z$). A
-- diferença é toda VALOR DE COLUNA: tamanho do time, nº de reservas, teto,
-- escopo do pool, prazo. Duas tabelas duplicariam quatro RPCs e uma view à toa.
--
-- É também o que destrava o cronograma: o Art. 15 deixa o tamanho do time do
-- fixo "a definir antes da estreia". Com discriminador, o modo fixo estreia sem
-- migration nenhuma — é uma linha.
CREATE TABLE IF NOT EXISTS escalacao_card (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modo                TEXT NOT NULL CHECK (modo IN ('fixo','mix')),
  mes                 DATE NOT NULL CHECK (mes = date_trunc('month', mes)::date),
  competicao_id       UUID REFERENCES escalacao_competicao(id),  -- NULL no mix
  titulo              TEXT NOT NULL,

  -- As "pendências" dos documentos viram DADO, não código.
  n_titulares         SMALLINT NOT NULL DEFAULT 10 CHECK (n_titulares BETWEEN 1 AND 30),
  n_reservas          SMALLINT NOT NULL DEFAULT 2  CHECK (n_reservas BETWEEN 0 AND 10),
  teto_por_esporte    SMALLINT NOT NULL DEFAULT 4  CHECK (teto_por_esporte > 0),
  -- Art. 10 § único: o teto vale só sobre os titulares. Os manuais de UFC e
  -- surf listam isso como pendência; o regulamento (1 dia mais velho) resolveu.
  teto_conta_reservas BOOLEAN NOT NULL DEFAULT false,
  -- 1 = capitão DESLIGADO. A coluna existe para o modo estrear sem migration
  -- quando o capitão for ligado.
  multiplicador_capitao NUMERIC(4,2) NOT NULL DEFAULT 1
                        CHECK (multiplicador_capitao >= 1),

  entrada_z           NUMERIC(12,2) NOT NULL DEFAULT 200 CHECK (entrada_z >= 0),
  -- Quantos PONTOS valem 1 Z$ no pagamento. Manual de UFC §11: neutra 1,7 ·
  -- sink 2,1 · inflação 1,4. É política de moeda, não de pontuação.
  pontos_por_z        NUMERIC(8,4) NOT NULL CHECK (pontos_por_z > 0),
  -- DISJUNTOR. Um bug de pontuação num modo que EMITE moeda é perda ilimitada.
  -- Definido na abertura do card (~3x a emissão esperada), transforma
  -- catástrofe em alerta: escalacao_pagar_card() recusa e não paga nada.
  teto_emissao_z      NUMERIC(14,2) NOT NULL CHECK (teto_emissao_z >= 0),

  abre_em             TIMESTAMPTZ NOT NULL,
  -- Prazo geral (Art. 7). Pode ser sobrescrito por esporte em
  -- escalacao_card_esporte.fecha_em — ver seção 5.
  fecha_em            TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN
                        ('rascunho','aberto','fechado','apurando','apurado','pago','cancelado')),

  -- FIO DE TROPEÇO DELIBERADO: uma coluna que só pode valer false. Custa um
  -- byte e torna impossível ligar Escalação a prêmio real sem uma migration que
  -- um revisor vai ver. (O `has_real_prize` citado nos docs não existe no repo.)
  premio_real         BOOLEAN NOT NULL DEFAULT false CHECK (premio_real = false),

  publicado_em        TIMESTAMPTZ,
  apurado_em          TIMESTAMPTZ,
  pago_em             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT escalacao_card_janela CHECK (abre_em < fecha_em),
  CONSTRAINT escalacao_card_modo_competicao CHECK (
    (modo = 'fixo' AND competicao_id IS NOT NULL) OR
    (modo = 'mix'  AND competicao_id IS NULL)
  ),
  -- Alvo da FK composta de escalacao_time — é o que torna
  -- UNIQUE (user_id, mes, modo) confiável sem trigger.
  UNIQUE (id, mes, modo)
);

-- Um card de mix por mês; um card de fixo por liga por mês.
CREATE UNIQUE INDEX IF NOT EXISTS uq_escalacao_card_mix
  ON escalacao_card(mes, modo) WHERE modo = 'mix';
CREATE UNIQUE INDEX IF NOT EXISTS uq_escalacao_card_fixo
  ON escalacao_card(mes, modo, competicao_id) WHERE modo = 'fixo';
CREATE INDEX IF NOT EXISTS idx_escalacao_card_status
  ON escalacao_card(status, fecha_em);

-- ------------------------------------------------------------
-- 5. Esportes deste card: ruleset FIXADO + prazo por esporte
-- ------------------------------------------------------------
-- O fecha_em opcional resolve — sem decidir — o conflito real entre o Art. 7 §1
-- ("o prazo é único e idêntico para todos") e o manual de surf §8, que
-- demonstra que o prazo único é inviável: a janela de espera da WSL obriga o
-- surf a fechar na véspera da abertura da janela, muito antes de qualquer outro
-- esporte. O schema suporta as duas respostas; a decisão de produto fica
-- pendente e o regulamento precisa ser corrigido antes de publicar.
CREATE TABLE IF NOT EXISTS escalacao_card_esporte (
  card_id     UUID NOT NULL REFERENCES escalacao_card(id) ON DELETE CASCADE,
  esporte_key TEXT NOT NULL REFERENCES escalacao_esporte(key),
  regra_id    UUID NOT NULL REFERENCES escalacao_regra(id),
  fecha_em    TIMESTAMPTZ,          -- override; NULL = usa card.fecha_em
  -- Surf §9: um stop por mês. Qual evento deste esporte conta neste card.
  evento_key  TEXT,
  PRIMARY KEY (card_id, esporte_key),
  -- Alvo da FK composta de escalacao_card_atleta.
  UNIQUE (card_id, esporte_key, regra_id)
);

-- ------------------------------------------------------------
-- 6. Atletas (cadastro permanente)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escalacao_atleta (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  esporte_key   TEXT NOT NULL REFERENCES escalacao_esporte(key),
  competicao_id UUID,
  -- Surf roda dois draws no mesmo stop; F1/UFC usam 'misto'.
  genero        TEXT NOT NULL DEFAULT 'misto' CHECK (genero IN ('m','f','misto')),
  categoria     TEXT,                -- peso no UFC/boxe, equipe na F1, clube no futebol
  external_ref  TEXT,                -- id no ufcstats/WSL/etc
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A competição do atleta tem que ser do MESMO esporte que o atleta (C12).
  FOREIGN KEY (competicao_id, esporte_key)
    REFERENCES escalacao_competicao(id, esporte_key),
  -- Alvo de FK composta (escalacao_card_atleta).
  UNIQUE (id, esporte_key)
);

CREATE INDEX IF NOT EXISTS idx_escalacao_atleta_esporte
  ON escalacao_atleta(esporte_key, ativo);

-- ------------------------------------------------------------
-- 7. Pool publicado do card + registro de apuração por atleta
-- ------------------------------------------------------------
-- Duas responsabilidades numa tabela porque são a mesma linha: o atleta que o
-- card publicou (Art. 22–23) é exatamente o atleta cuja pontuação se apura.
-- A pontuação é calculada UMA VEZ por atleta e vale para todos os times que o
-- escalaram (UFC §10) — nunca por usuário.
CREATE TABLE IF NOT EXISTS escalacao_card_atleta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES escalacao_card(id) ON DELETE CASCADE,
  atleta_id       UUID NOT NULL,
  esporte_key     TEXT NOT NULL,
  -- Ruleset com que este atleta FOI (ou será) pontuado. Não é escolha da
  -- aplicação: a FK composta abaixo obriga a ser o ruleset que este card fixou.
  regra_id        UUID NOT NULL,

  -- Apuração. NULL = ainda não apurado; false ACIONA A RESERVA (Art. 19).
  competiu        BOOLEAN,
  motivo_ausencia TEXT,
  pontos          NUMERIC(8,2),
  -- Breakdown itemizado, linha a linha, para o Art. 34 (erro comprovado é
  -- corrigido e o ranking republicado — sem o detalhe não há como comprovar).
  detalhe         JSONB,
  calculado_em    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- C12: o esporte do atleta bate com o esporte declarado aqui.
  FOREIGN KEY (atleta_id, esporte_key) REFERENCES escalacao_atleta(id, esporte_key),
  -- C11, a FK decisiva: torna ESTRUTURALMENTE IMPOSSÍVEL guardar um score
  -- calculado com um ruleset que este card não fixou. Sem trigger, sem
  -- checagem de aplicação.
  FOREIGN KEY (card_id, esporte_key, regra_id)
    REFERENCES escalacao_card_esporte(card_id, esporte_key, regra_id),
  UNIQUE (card_id, atleta_id),
  -- Alvo da FK composta de escalacao_time_atleta (C3/C4).
  UNIQUE (id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_escalacao_card_atleta_card
  ON escalacao_card_atleta(card_id, esporte_key);

-- ------------------------------------------------------------
-- 8. Stats crus (entrada manual do admin) — service role only
-- ------------------------------------------------------------
-- Tabela genérica: é ela que permite ao painel admin não ter código por
-- esporte. (evento_key, ordem) é o que deixa uma única tabela guardar
-- "22 golpes significativos na luta X" e "as duas melhores ondas da bateria 3
-- foram 8,20 e 10,00".
CREATE TABLE IF NOT EXISTS escalacao_stat (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_atleta_id UUID NOT NULL REFERENCES escalacao_card_atleta(id) ON DELETE CASCADE,
  evento_key     TEXT NOT NULL,                       -- 'ufc-331', 'wsl-stop9'
  -- Sub-ocorrência: bateria, onda, corrida. 0 = stat do evento inteiro.
  ordem          SMALLINT NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  stat_key       TEXT NOT NULL,
  valor_num      NUMERIC(12,4),
  valor_txt      TEXT,
  -- Contexto da ocorrência para as regras do tipo `formula` — ex.:
  -- {"surfistas": 3, "vagas": 1} para o avanço de bateria do surf §2.
  contexto       JSONB,
  registrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  registrado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- C16: um valor por (atleta, evento, ocorrência, stat).
  UNIQUE (card_atleta_id, evento_key, ordem, stat_key)
);

CREATE INDEX IF NOT EXISTS idx_escalacao_stat_atleta
  ON escalacao_stat(card_atleta_id, evento_key, ordem);

-- ------------------------------------------------------------
-- 9. Time do usuário
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escalacao_time (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        UUID NOT NULL,
  -- Desnormalizados de propósito. A FK composta abaixo impede que discordem do
  -- card, e é isso que torna UNIQUE (user_id, mes, modo) confiável.
  mes            DATE NOT NULL,
  modo           TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome           TEXT CHECK (nome IS NULL OR char_length(nome) <= 40),
  status         TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN
                   ('rascunho','inscrito','travado','apurado','pago','reembolsado','cancelado')),
  entrada_paga   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (entrada_paga >= 0),
  inscrito_em    TIMESTAMPTZ,
  pontos_total   NUMERIC(10,2),
  -- C17: prêmio nunca negativo. O piso de −25 é POR ATLETA; o total do time
  -- pode ficar negativo e o pagamento clampa em 0.
  premio_z       NUMERIC(12,2) CHECK (premio_z IS NULL OR premio_z >= 0),
  premio_pago_em TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (card_id, mes, modo) REFERENCES escalacao_card(id, mes, modo),
  UNIQUE (user_id, card_id),            -- C1
  -- C2, Art. 5: um time por variante por mês, ATRAVESSANDO as ligas do fixo.
  UNIQUE (user_id, mes, modo),
  -- Alvo da FK composta de escalacao_time_atleta.
  UNIQUE (id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_escalacao_time_card
  ON escalacao_time(card_id, status);
CREATE INDEX IF NOT EXISTS idx_escalacao_time_user
  ON escalacao_time(user_id);

CREATE TABLE IF NOT EXISTS escalacao_time_atleta (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id          UUID NOT NULL,
  card_id          UUID NOT NULL,
  card_atleta_id   UUID NOT NULL,
  papel            TEXT NOT NULL CHECK (papel IN ('titular','reserva')),
  -- Art. 13: a ordem das reservas (1ª e 2ª) é ESCOLHIDA pelo usuário.
  ordem            SMALLINT NOT NULL CHECK (ordem >= 1),
  capitao          BOOLEAN NOT NULL DEFAULT false,

  -- Derivados da apuração. Recomputados DO ZERO a cada recálculo, nunca
  -- incrementais — ver lib/escalacao/apuracao.ts.
  pontua           BOOLEAN NOT NULL DEFAULT true,
  substituiu_id    UUID REFERENCES escalacao_time_atleta(id) ON DELETE SET NULL,
  pontos_aplicados NUMERIC(8,2),

  -- Estas duas FKs compostas fazem do Art. 22 ("só atletas do pool publicado")
  -- uma FOREIGN KEY, e impedem um slot de apontar para o pool de outro card.
  FOREIGN KEY (time_id, card_id) REFERENCES escalacao_time(id, card_id) ON DELETE CASCADE,
  FOREIGN KEY (card_atleta_id, card_id) REFERENCES escalacao_card_atleta(id, card_id),
  UNIQUE (time_id, card_atleta_id),     -- C5: sem atleta repetido
  UNIQUE (time_id, papel, ordem)        -- C6: sem slot duplicado
);

CREATE INDEX IF NOT EXISTS idx_escalacao_time_atleta_time
  ON escalacao_time_atleta(time_id);
CREATE INDEX IF NOT EXISTS idx_escalacao_time_atleta_pool
  ON escalacao_time_atleta(card_atleta_id);

-- ------------------------------------------------------------
-- 10. Contabilidade da emissão de Z$
-- ------------------------------------------------------------
-- Escalação é o ÚNICO módulo que emite Z$: games_score_event explicitamente
-- nunca entra na economia; os pontos daqui entram. A quebra de conservação é
-- contabilizada, limitada e documentada — não silenciosa.
--
-- A invariante da plataforma é REESCRITA, não abandonada:
--   SUM(wallets.balance) + SUM(potes abertos) − SUM(escalacao_emissao.z_liquido)
--     = constante
CREATE TABLE IF NOT EXISTS escalacao_emissao (
  card_id     UUID PRIMARY KEY REFERENCES escalacao_card(id) ON DELETE CASCADE,
  z_debitado  NUMERIC(14,2) NOT NULL DEFAULT 0,     -- entradas (Z$ destruído)
  z_creditado NUMERIC(14,2) NOT NULL DEFAULT 0,     -- prêmios (Z$ emitido)
  z_liquido   NUMERIC(14,2) GENERATED ALWAYS AS (z_creditado - z_debitado) STORED,
  times_pagos INTEGER NOT NULL DEFAULT 0,
  fechado_em  TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 11. View de ranking
-- ------------------------------------------------------------
-- Particiona POR CARD (Art. 29: ranking mensal que recomeça), ao contrário de
-- v_games_leaderboard, que é global e cumulativa.
-- O Art. 30 deixa o desempate indefinido — sem um ORDER BY determinístico a
-- posição oscila entre page loads. O critério abaixo é PROVISÓRIO.
CREATE OR REPLACE VIEW v_escalacao_ranking
WITH (security_invoker = on) AS
SELECT
  t.card_id,
  t.id AS time_id,
  t.user_id,
  p.username,
  p.avatar_url,
  t.nome,
  t.pontos_total,
  t.premio_z,
  ROW_NUMBER() OVER (
    PARTITION BY t.card_id
    ORDER BY t.pontos_total DESC NULLS LAST, t.inscrito_em ASC, p.username ASC
  )::INTEGER AS posicao
FROM escalacao_time t
JOIN profiles p ON p.id = t.user_id
WHERE t.status IN ('inscrito','travado','apurado','pago');

-- ------------------------------------------------------------
-- 12. Funções auxiliares (prazo efetivo e validação de composição)
-- ------------------------------------------------------------

-- Prazo efetivo de um esporte neste card: o override, se houver; senão o prazo
-- geral do card. Uma função só, usada pelos triggers e pelas RPCs — se a
-- decisão de produto virar "prazo único", basta parar de preencher o override.
CREATE OR REPLACE FUNCTION escalacao_prazo(p_card UUID, p_esporte TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(ce.fecha_em, c.fecha_em)
    FROM escalacao_card c
    LEFT JOIN escalacao_card_esporte ce
      ON ce.card_id = c.id AND ce.esporte_key = p_esporte
   WHERE c.id = p_card;
$$;

-- Composição do time (Art. 9 a 13). Levanta exceção; não retorna nada.
-- Só vale quando o time saiu do rascunho — em rascunho o usuário está montando.
CREATE OR REPLACE FUNCTION escalacao_valida_time(p_time UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_time  escalacao_time%ROWTYPE;
  v_card  escalacao_card%ROWTYPE;
  v_n     INTEGER;
  v_rec   RECORD;
BEGIN
  SELECT * INTO v_time FROM escalacao_time WHERE id = p_time;
  IF NOT FOUND OR v_time.status = 'rascunho' THEN
    RETURN;
  END IF;

  SELECT * INTO v_card FROM escalacao_card WHERE id = v_time.card_id;

  -- Contagem exata de titulares e reservas.
  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND papel = 'titular';
  IF v_n <> v_card.n_titulares THEN
    RAISE EXCEPTION 'escalacao: o time precisa de % titulares (tem %)',
      v_card.n_titulares, v_n;
  END IF;

  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND papel = 'reserva';
  IF v_n <> v_card.n_reservas THEN
    RAISE EXCEPTION 'escalacao: o time precisa de % reservas (tem %)',
      v_card.n_reservas, v_n;
  END IF;

  -- `ordem` dentro dos limites do card (o UNIQUE já garante que não repete).
  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time
     AND ((papel = 'titular' AND ordem > v_card.n_titulares)
       OR (papel = 'reserva' AND ordem > v_card.n_reservas));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'escalacao: ordem de slot fora dos limites do card';
  END IF;

  -- No máximo um capitão, e só entre titulares.
  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND capitao;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'escalacao: no máximo um capitão por time';
  END IF;
  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND capitao AND papel <> 'titular';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'escalacao: o capitão precisa ser titular';
  END IF;

  -- Teto por ESPORTE. Art. 10 § único: conta só os titulares, salvo se o card
  -- disser o contrário. O teto efetivo é o mais restritivo entre o do esporte e
  -- o do card.
  FOR v_rec IN
    SELECT ca.esporte_key,
           COUNT(*) AS usados,
           LEAST(e.teto_titulares, v_card.teto_por_esporte) AS teto
      FROM escalacao_time_atleta ta
      JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
      JOIN escalacao_esporte     e  ON e.key = ca.esporte_key
     WHERE ta.time_id = p_time
       AND (v_card.teto_conta_reservas OR ta.papel = 'titular')
     GROUP BY ca.esporte_key, e.teto_titulares
  LOOP
    IF v_rec.usados > v_rec.teto THEN
      RAISE EXCEPTION 'escalacao: máximo de % atletas de % (tem %)',
        v_rec.teto, v_rec.esporte_key, v_rec.usados;
    END IF;
  END LOOP;

  -- Teto por COMPETIÇÃO (Art. 11: Champions ≤ 3). Vale por competição, então
  -- dois campeonatos de futebol no mix não afrouxam o teto do esporte acima.
  FOR v_rec IN
    SELECT co.slug, co.teto_titulares AS teto, COUNT(*) AS usados
      FROM escalacao_time_atleta ta
      JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
      JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
      JOIN escalacao_competicao  co ON co.id = a.competicao_id
     WHERE ta.time_id = p_time
       AND co.teto_titulares IS NOT NULL
       AND (v_card.teto_conta_reservas OR ta.papel = 'titular')
     GROUP BY co.slug, co.teto_titulares
  LOOP
    IF v_rec.usados > v_rec.teto THEN
      RAISE EXCEPTION 'escalacao: máximo de % atletas de % (tem %)',
        v_rec.teto, v_rec.slug, v_rec.usados;
    END IF;
  END LOOP;

  -- No modo fixo, todos os atletas são da liga do card.
  IF v_card.modo = 'fixo' THEN
    SELECT COUNT(*) INTO v_n
      FROM escalacao_time_atleta ta
      JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
      JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
     WHERE ta.time_id = p_time
       AND (a.competicao_id IS DISTINCT FROM v_card.competicao_id);
    IF v_n > 0 THEN
      RAISE EXCEPTION 'escalacao: no modo fixo todos os atletas são da liga do card';
    END IF;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 13. Triggers de invariante
-- ------------------------------------------------------------

-- T1 · Composição. CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED: a RPC
-- insere 12 linhas e um trigger imediato falharia na linha 1.
CREATE OR REPLACE FUNCTION escalacao_tg_valida_composicao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- OLD não existe em INSERT e NEW não existe em DELETE: branch por TG_OP, não
  -- COALESCE (plpgsql levanta "record is not assigned yet").
  IF TG_OP = 'DELETE' THEN
    PERFORM escalacao_valida_time(OLD.time_id);
  ELSE
    PERFORM escalacao_valida_time(NEW.time_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_composicao ON escalacao_time_atleta;
CREATE CONSTRAINT TRIGGER tg_escalacao_composicao
  AFTER INSERT OR UPDATE OR DELETE ON escalacao_time_atleta
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_valida_composicao();

CREATE OR REPLACE FUNCTION escalacao_tg_valida_time_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM escalacao_valida_time(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_time_status ON escalacao_time;
CREATE CONSTRAINT TRIGGER tg_escalacao_time_status
  AFTER UPDATE OF status ON escalacao_time
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW.status <> 'rascunho')
  EXECUTE FUNCTION escalacao_tg_valida_time_status();

-- T2 · Escalação CONGELADA depois do prazo (Art. 7 §3). Comparação de
-- TIMESTAMP, não de status: vale mesmo com os crons mortos, que é o cenário
-- real hoje (docs/audits/CRONS-NAO-DISPARAM.md). O caminho da apuração
-- (pontua / substituiu_id / pontos_aplicados) fica liberado.
--
-- DELETE fica FORA de propósito. Bloquear DELETE aqui quebraria a exclusão de
-- conta (profiles → escalacao_time → escalacao_time_atleta em cascata), que é
-- direito do titular pela LGPD. E não abre buraco: apagar um slot depois da
-- trava deixa o time com contagem errada e o T1 (diferido, roda no commit)
-- rejeita a transação inteira. Só passa quando o TIME também sumiu — que é
-- exatamente o caso da cascata.
CREATE OR REPLACE FUNCTION escalacao_tg_congela_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_esporte TEXT;
  v_prazo   TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Só a apuração mudou? Passa.
    IF NEW.time_id        IS NOT DISTINCT FROM OLD.time_id
   AND NEW.card_id        IS NOT DISTINCT FROM OLD.card_id
   AND NEW.card_atleta_id IS NOT DISTINCT FROM OLD.card_atleta_id
   AND NEW.papel          IS NOT DISTINCT FROM OLD.papel
   AND NEW.ordem          IS NOT DISTINCT FROM OLD.ordem
   AND NEW.capitao        IS NOT DISTINCT FROM OLD.capitao THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT esporte_key INTO v_esporte
    FROM escalacao_card_atleta WHERE id = NEW.card_atleta_id;
  v_prazo := escalacao_prazo(NEW.card_id, v_esporte);

  IF v_prazo IS NOT NULL AND v_prazo <= NOW() THEN
    RAISE EXCEPTION 'escalacao: a escalação de % fechou em % e não pode mais mudar',
      v_esporte, v_prazo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_congela_slot ON escalacao_time_atleta;
CREATE TRIGGER tg_escalacao_congela_slot
  BEFORE INSERT OR UPDATE ON escalacao_time_atleta
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_congela_slot();

-- T3 · Time não NASCE depois do fechamento do card. DELETE fica de fora pelo
-- mesmo motivo do T2 (cascata de exclusão de conta).
CREATE OR REPLACE FUNCTION escalacao_tg_congela_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_fecha TIMESTAMPTZ;
BEGIN
  SELECT fecha_em INTO v_fecha FROM escalacao_card WHERE id = NEW.card_id;
  IF v_fecha IS NOT NULL AND v_fecha <= NOW() THEN
    RAISE EXCEPTION 'escalacao: a Convocação fechou em % — não dá mais para criar time',
      v_fecha;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_congela_time ON escalacao_time;
CREATE TRIGGER tg_escalacao_congela_time
  BEFORE INSERT ON escalacao_time
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_congela_time();

-- T4 · Pool imutável após o fechamento (Art. 22). UPDATE das colunas de
-- apuração fica liberado; trocar o atleta ou o ruleset, não.
CREATE OR REPLACE FUNCTION escalacao_tg_congela_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_card  UUID;
  v_fecha TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.atleta_id   IS NOT DISTINCT FROM OLD.atleta_id
   AND NEW.esporte_key IS NOT DISTINCT FROM OLD.esporte_key
   AND NEW.regra_id    IS NOT DISTINCT FROM OLD.regra_id
   AND NEW.card_id     IS NOT DISTINCT FROM OLD.card_id THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN v_card := OLD.card_id; ELSE v_card := NEW.card_id; END IF;

  SELECT fecha_em INTO v_fecha FROM escalacao_card WHERE id = v_card;
  IF v_fecha IS NOT NULL AND v_fecha <= NOW() THEN
    RAISE EXCEPTION 'escalacao: o pool do card está publicado e fechado desde %', v_fecha;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_congela_pool ON escalacao_card_atleta;
CREATE TRIGGER tg_escalacao_congela_pool
  BEFORE INSERT OR UPDATE OR DELETE ON escalacao_card_atleta
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_congela_pool();

-- T5 · Ruleset publicado é IMUTÁVEL (Art. 24 § único). A única mudança
-- permitida é o próprio ato de publicar.
CREATE OR REPLACE FUNCTION escalacao_tg_regra_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.publicado_em IS NOT NULL THEN
      RAISE EXCEPTION 'escalacao: ruleset %.v% já foi publicado e não pode ser apagado',
        OLD.esporte_key, OLD.versao;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.publicado_em IS NOT NULL THEN
    RAISE EXCEPTION 'escalacao: ruleset %.v% já foi publicado — emende criando uma nova versão',
      OLD.esporte_key, OLD.versao;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_regra_imutavel ON escalacao_regra;
CREATE TRIGGER tg_escalacao_regra_imutavel
  BEFORE UPDATE OR DELETE ON escalacao_regra
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_regra_imutavel();

-- T6 · Termos do card publicado são IMUTÁVEIS (Art. 33 + CDC art. 30). O preço
-- e as regras do que o usuário aceitou ao se inscrever não mudam depois.
CREATE OR REPLACE FUNCTION escalacao_tg_card_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'rascunho' THEN
    RETURN NEW;
  END IF;

  IF NEW.entrada_z             IS DISTINCT FROM OLD.entrada_z
  OR NEW.pontos_por_z          IS DISTINCT FROM OLD.pontos_por_z
  OR NEW.n_titulares           IS DISTINCT FROM OLD.n_titulares
  OR NEW.n_reservas            IS DISTINCT FROM OLD.n_reservas
  OR NEW.teto_por_esporte      IS DISTINCT FROM OLD.teto_por_esporte
  OR NEW.teto_conta_reservas   IS DISTINCT FROM OLD.teto_conta_reservas
  OR NEW.multiplicador_capitao IS DISTINCT FROM OLD.multiplicador_capitao
  OR NEW.fecha_em              IS DISTINCT FROM OLD.fecha_em
  OR NEW.modo                  IS DISTINCT FROM OLD.modo
  OR NEW.mes                   IS DISTINCT FROM OLD.mes
  OR NEW.competicao_id         IS DISTINCT FROM OLD.competicao_id THEN
    RAISE EXCEPTION 'escalacao: os termos do card já foram publicados e não podem mudar';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_card_imutavel ON escalacao_card;
CREATE TRIGGER tg_escalacao_card_imutavel
  BEFORE UPDATE ON escalacao_card
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_card_imutavel();

-- T8 · updated_at
CREATE OR REPLACE FUNCTION escalacao_tg_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_escalacao_time_touch ON escalacao_time;
CREATE TRIGGER tg_escalacao_time_touch
  BEFORE UPDATE ON escalacao_time
  FOR EACH ROW EXECUTE FUNCTION escalacao_tg_touch();

-- ------------------------------------------------------------
-- 14. RLS
-- ------------------------------------------------------------
ALTER TABLE escalacao_esporte       ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_competicao    ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_regra         ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_atleta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_card          ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_card_esporte  ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_card_atleta   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_stat          ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_time          ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_time_atleta   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_emissao       ENABLE ROW LEVEL SECURITY;

-- Catálogo e regras: leitura pública autenticada. O ruleset TEM que ser legível
-- — o art. 49, II exige regra preestabelecida e conhecida.
DROP POLICY IF EXISTS escalacao_esporte_select ON escalacao_esporte;
CREATE POLICY escalacao_esporte_select ON escalacao_esporte
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS escalacao_competicao_select ON escalacao_competicao;
CREATE POLICY escalacao_competicao_select ON escalacao_competicao
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS escalacao_atleta_select ON escalacao_atleta;
CREATE POLICY escalacao_atleta_select ON escalacao_atleta
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS escalacao_regra_select ON escalacao_regra;
CREATE POLICY escalacao_regra_select ON escalacao_regra
  FOR SELECT TO authenticated USING (publicado_em IS NOT NULL);

-- Card e pool: só depois de sair do rascunho.
DROP POLICY IF EXISTS escalacao_card_select ON escalacao_card;
CREATE POLICY escalacao_card_select ON escalacao_card
  FOR SELECT TO authenticated USING (status <> 'rascunho');
DROP POLICY IF EXISTS escalacao_card_esporte_select ON escalacao_card_esporte;
CREATE POLICY escalacao_card_esporte_select ON escalacao_card_esporte
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM escalacao_card c
             WHERE c.id = escalacao_card_esporte.card_id AND c.status <> 'rascunho')
  );
DROP POLICY IF EXISTS escalacao_card_atleta_select ON escalacao_card_atleta;
CREATE POLICY escalacao_card_atleta_select ON escalacao_card_atleta
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM escalacao_card c
             WHERE c.id = escalacao_card_atleta.card_id AND c.status <> 'rascunho')
  );

-- ANTI-CÓPIA (espelha games_prediction_select). Nenhum documento menciona isso,
-- mas uma escalação de 12 atletas é muito mais valiosa que um palpite binário —
-- se as escalações vazarem antes da trava, o ranking inteiro se corrompe.
DROP POLICY IF EXISTS escalacao_time_select ON escalacao_time;
CREATE POLICY escalacao_time_select ON escalacao_time
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM escalacao_card c
                WHERE c.id = escalacao_time.card_id AND c.fecha_em <= NOW())
  );
DROP POLICY IF EXISTS escalacao_time_atleta_select ON escalacao_time_atleta;
CREATE POLICY escalacao_time_atleta_select ON escalacao_time_atleta
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM escalacao_time t
       WHERE t.id = escalacao_time_atleta.time_id
         AND (t.user_id = auth.uid()
              OR EXISTS (SELECT 1 FROM escalacao_card c
                          WHERE c.id = t.card_id AND c.fecha_em <= NOW()))
    )
  );

-- escalacao_stat e escalacao_emissao: SEM policy → invisíveis a authenticated
-- (como games_resolution_log). O usuário vê o `detalhe` legível do card_atleta,
-- nunca o stat cru; a emissão é dado de tesouraria.

-- ------------------------------------------------------------
-- 15. RPCs de dinheiro (SECURITY DEFINER, service_role only)
-- ------------------------------------------------------------

-- 15.1 Inscrição com débito ATÔMICO na hora.
--
-- Por que aqui e não no fechamento: o Art. 16 manda debitar "no encerramento da
-- Convocação", o que exige um lote disparado por cron — e os 19 crons do Zafe
-- NUNCA dispararam (docs/audits/CRONS-NAO-DISPARAM.md). Nesse desenho o time
-- ficaria inscrito de graça. Debita-se no "Inscrever"; o usuário segue editando
-- a escalação até o prazo. REQUER emenda ao Art. 16 antes de publicar o
-- regulamento (ele ainda não foi publicado).
CREATE OR REPLACE FUNCTION escalacao_inscrever(p_user UUID, p_card UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card escalacao_card%ROWTYPE;
  v_time escalacao_time%ROWTYPE;
  v_rows INTEGER;
BEGIN
  SELECT * INTO v_card FROM escalacao_card WHERE id = p_card FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_card.status <> 'aberto' OR v_card.fecha_em <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  SELECT * INTO v_time FROM escalacao_time
   WHERE card_id = p_card AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_team');
  END IF;
  IF v_time.status <> 'rascunho' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_joined');
  END IF;

  -- Composição validada ANTES do débito: ninguém paga por um time inválido.
  UPDATE escalacao_time
     SET status = 'inscrito', entrada_paga = v_card.entrada_z, inscrito_em = NOW()
   WHERE id = v_time.id AND status = 'rascunho';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_joined');
  END IF;

  -- O trigger de composição é DIFERIDO (roda no commit), então aqui ele não
  -- ajuda: sem esta chamada explícita o débito aconteceria antes de qualquer
  -- checagem. O bloco EXCEPTION desfaz o UPDATE acima e devolve motivo legível
  -- em vez de estourar erro de banco na API.
  BEGIN
    PERFORM escalacao_valida_time(v_time.id);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_lineup', 'detail', SQLERRM);
  END;

  IF v_card.entrada_z > 0 THEN
    -- Débito condicional: mais forte que o CAS de lib/wallet.ts e imune a
    -- corrida — o WHERE é avaliado sob lock de linha.
    UPDATE wallets SET balance = balance - v_card.entrada_z
     WHERE user_id = p_user AND balance >= v_card.entrada_z;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient');
    END IF;

    INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
    VALUES (p_user, 'escalacao_buy_in', -v_card.entrada_z, -v_card.entrada_z,
            'Inscrição na Convocação: ' || v_card.titulo, p_card);

    INSERT INTO escalacao_emissao (card_id, z_debitado)
    VALUES (p_card, v_card.entrada_z)
    ON CONFLICT (card_id) DO UPDATE
      SET z_debitado = escalacao_emissao.z_debitado + EXCLUDED.z_debitado;
  END IF;

  RETURN jsonb_build_object('ok', true, 'entrada', v_card.entrada_z, 'time_id', v_time.id);
END;
$$;

-- 15.2 Pagamento do card em Z$.
--
-- O DISJUNTOR de emissão é o acréscimo mais importante que nenhum documento
-- contempla: um bug de pontuação num modo que emite moeda é perda ILIMITADA.
-- Se o total a emitir passar do teto declarado na abertura do card, a função
-- recusa por inteiro e não paga ninguém — vira alerta, não catástrofe.
CREATE OR REPLACE FUNCTION escalacao_pagar_card(p_card UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card   escalacao_card%ROWTYPE;
  v_total  NUMERIC(14,2) := 0;
  v_rows   INTEGER;
  v_time   RECORD;
  v_premio NUMERIC(12,2);
  v_pagos  INTEGER := 0;
  v_emitido NUMERIC(14,2) := 0;
BEGIN
  SELECT * INTO v_card FROM escalacao_card WHERE id = p_card FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_card.status <> 'apurado' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_apurado');
  END IF;
  IF v_card.pago_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  SELECT COALESCE(SUM(ROUND(GREATEST(COALESCE(pontos_total, 0), 0) / v_card.pontos_por_z, 2)), 0)
    INTO v_total
    FROM escalacao_time
   WHERE card_id = p_card AND status = 'apurado' AND premio_pago_em IS NULL;

  IF v_total > v_card.teto_emissao_z THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'teto_emissao',
                              'total', v_total, 'teto', v_card.teto_emissao_z);
  END IF;

  -- CAS idempotente: só um caller consegue marcar como pago.
  UPDATE escalacao_card SET status = 'pago', pago_em = NOW()
   WHERE id = p_card AND pago_em IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  FOR v_time IN
    SELECT id, user_id, pontos_total FROM escalacao_time
     WHERE card_id = p_card AND status = 'apurado' AND premio_pago_em IS NULL
     ORDER BY id
  LOOP
    v_premio := ROUND(GREATEST(COALESCE(v_time.pontos_total, 0), 0) / v_card.pontos_por_z, 2);

    -- Claim por time: mesma proteção linha a linha do games_pot_settle.
    UPDATE escalacao_time
       SET status = 'pago', premio_z = v_premio, premio_pago_em = NOW()
     WHERE id = v_time.id AND premio_pago_em IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    CONTINUE WHEN v_rows = 0;

    IF v_premio > 0 THEN
      UPDATE wallets SET balance = balance + v_premio WHERE user_id = v_time.user_id;
      INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
      VALUES (v_time.user_id, 'escalacao_premio', v_premio, v_premio,
              'Convocação: ' || v_card.titulo, p_card);
      v_emitido := v_emitido + v_premio;
    END IF;
    v_pagos := v_pagos + 1;
  END LOOP;

  INSERT INTO escalacao_emissao (card_id, z_creditado, times_pagos, fechado_em)
  VALUES (p_card, v_emitido, v_pagos, NOW())
  ON CONFLICT (card_id) DO UPDATE
    SET z_creditado = escalacao_emissao.z_creditado + EXCLUDED.z_creditado,
        times_pagos = escalacao_emissao.times_pagos + EXCLUDED.times_pagos,
        fechado_em  = NOW();

  RETURN jsonb_build_object('ok', true, 'times', v_pagos, 'z_emitido', v_emitido);
END;
$$;

-- 15.3 Cancelamento do card com reembolso integral.
-- O Art. 16 §3 cobre "atleta não competiu" (sem devolução), mas NÃO cobre "o
-- card inteiro foi cancelado". Precisa de artigo próprio no regulamento.
CREATE OR REPLACE FUNCTION escalacao_reembolsar_card(p_card UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card  escalacao_card%ROWTYPE;
  v_time  RECORD;
  v_rows  INTEGER;
  v_count INTEGER := 0;
  v_soma  NUMERIC(14,2) := 0;
BEGIN
  SELECT * INTO v_card FROM escalacao_card WHERE id = p_card FOR UPDATE;
  IF NOT FOUND OR v_card.pago_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_settled');
  END IF;

  FOR v_time IN
    SELECT id, user_id, entrada_paga FROM escalacao_time
     WHERE card_id = p_card
       AND status IN ('inscrito','travado','apurado')
       AND entrada_paga > 0
       AND premio_pago_em IS NULL
     ORDER BY id
  LOOP
    UPDATE escalacao_time
       SET status = 'reembolsado', premio_z = 0, premio_pago_em = NOW()
     WHERE id = v_time.id AND premio_pago_em IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    CONTINUE WHEN v_rows = 0;

    UPDATE wallets SET balance = balance + v_time.entrada_paga
     WHERE user_id = v_time.user_id;
    INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
    VALUES (v_time.user_id, 'escalacao_refund', v_time.entrada_paga, v_time.entrada_paga,
            'Reembolso da Convocação (cancelada): ' || v_card.titulo, p_card);

    v_count := v_count + 1;
    v_soma  := v_soma + v_time.entrada_paga;
  END LOOP;

  UPDATE escalacao_card SET status = 'cancelado', pago_em = NOW() WHERE id = p_card;

  -- O reembolso DEVOLVE Z$ que tinha sido destruído: reduz o debitado, não
  -- entra como emissão.
  INSERT INTO escalacao_emissao (card_id, z_debitado, fechado_em)
  VALUES (p_card, -v_soma, NOW())
  ON CONFLICT (card_id) DO UPDATE
    SET z_debitado = escalacao_emissao.z_debitado - v_soma,
        fechado_em = NOW();

  RETURN jsonb_build_object('ok', true, 'reembolsados', v_count, 'z_devolvido', v_soma);
END;
$$;

REVOKE ALL ON FUNCTION escalacao_inscrever(UUID, UUID)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION escalacao_pagar_card(UUID)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION escalacao_reembolsar_card(UUID)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION escalacao_valida_time(UUID)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION escalacao_prazo(UUID, TEXT)         FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION escalacao_inscrever(UUID, UUID)  TO service_role;
GRANT EXECUTE ON FUNCTION escalacao_pagar_card(UUID)       TO service_role;
GRANT EXECUTE ON FUNCTION escalacao_reembolsar_card(UUID)  TO service_role;
GRANT EXECUTE ON FUNCTION escalacao_valida_time(UUID)      TO service_role;
GRANT EXECUTE ON FUNCTION escalacao_prazo(UUID, TEXT)      TO service_role;
