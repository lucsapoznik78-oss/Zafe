-- 076 — Modo Escalação: desempate alfabético e paridade 1 ponto = 1 Z$
--
-- Duas decisões do dono do produto (7/ago/2026), tomadas junto com a
-- simplificação dos nove manuais de pontuação:
--
--   1. DESEMPATE É ALFABÉTICO. O Art. 30 deixava o critério indefinido e a view
--      usava `inscrito_em ASC` como provisório — o que premiava quem inscreveu
--      primeiro, um critério que não é habilidade e que o usuário não consegue
--      verificar sozinho. Ordem alfabética do username é conferível por
--      qualquer participante olhando o próprio ranking.
--
--   2. OS MANUAIS PONTUAM DIRETO EM Z$. "+30" na tabela do UFC é +30 Z$ na
--      carteira. A coluna `pontos_por_z` deixa de ser uma decisão de política
--      monetária em aberto e passa a valer 1 por padrão. A coluna FICA — ela é o
--      que permite emitir um card com câmbio diferente sem migration, e removê-la
--      exigiria reescrever `escalacao_pagar_card`.

-- ------------------------------------------------------------
-- 1. Desempate alfabético
-- ------------------------------------------------------------
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
    -- Art. 30: empate resolve por ordem alfabética do nome de usuário.
    -- `username` é UNIQUE em profiles, então a ordenação é total e a posição
    -- não oscila entre page loads.
    ORDER BY t.pontos_total DESC NULLS LAST, p.username ASC
  )::INTEGER AS posicao
FROM escalacao_time t
JOIN profiles p ON p.id = t.user_id
WHERE t.status IN ('inscrito','travado','apurado','pago');

COMMENT ON VIEW v_escalacao_ranking IS
  'Ranking mensal por card (Art. 29 — recomeça a cada Convocação). Desempate: ordem alfabética do username (Art. 30).';

-- ------------------------------------------------------------
-- 2. Paridade 1 ponto = 1 Z$
-- ------------------------------------------------------------
ALTER TABLE escalacao_card ALTER COLUMN pontos_por_z SET DEFAULT 1;

COMMENT ON COLUMN escalacao_card.pontos_por_z IS
  'Pontos necessários para 1 Z$. Vale 1: os manuais de 7/ago/2026 pontuam direto em Z$. Congelado na publicação pelo trigger T6.';
