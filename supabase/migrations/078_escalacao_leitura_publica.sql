-- Escalação: leitura anônima do que já é público.
--
-- `/escalacao` entrou em `publicRoutes` (middleware.ts) para ser indexável, como
-- `/liga` e `/comunidade`. Mas as policies da 075 foram escritas `TO authenticated`,
-- então o visitante deslogado recebia zero linha e a página renderizava
-- "Nenhuma Convocação aberta agora" mesmo com a Convocação de agosto aberta —
-- o Googlebot veria a mesma casca vazia.
--
-- O precedente do repo é `topics_public_read`, que é `TO public`. Nada aqui é
-- segredo: os termos do card, o pool e o ruleset precisam ser conhecidos ANTES
-- da escalação (Art. 49, I da Lei 14.790/2023 — regras preestabelecidas e
-- conhecidas). Exigir login para lê-los contraria o próprio enquadramento.
--
-- O `qual` de cada policy fica IDÊNTICO — só o papel muda. Em particular
-- `escalacao_time` mantém a trava anti-cópia: para o anônimo `auth.uid()` é NULL,
-- então o ramo "o próprio time" nunca casa e ele só enxerga escalações depois de
-- `card.fecha_em`. `escalacao_stat` e `escalacao_emissao` seguem sem policy
-- nenhuma (invisíveis fora do service role).

ALTER POLICY escalacao_esporte_select        ON escalacao_esporte        TO public;
ALTER POLICY escalacao_competicao_select     ON escalacao_competicao     TO public;
ALTER POLICY escalacao_atleta_select         ON escalacao_atleta         TO public;
ALTER POLICY escalacao_regra_select          ON escalacao_regra          TO public;
ALTER POLICY escalacao_card_select           ON escalacao_card           TO public;
ALTER POLICY escalacao_card_esporte_select   ON escalacao_card_esporte   TO public;
ALTER POLICY escalacao_card_atleta_select    ON escalacao_card_atleta    TO public;
ALTER POLICY escalacao_time_select           ON escalacao_time           TO public;
ALTER POLICY escalacao_time_atleta_select    ON escalacao_time_atleta    TO public;

GRANT SELECT ON escalacao_esporte, escalacao_competicao, escalacao_atleta,
                escalacao_regra, escalacao_card, escalacao_card_esporte,
                escalacao_card_atleta, escalacao_time, escalacao_time_atleta,
                v_escalacao_ranking
  TO anon;
