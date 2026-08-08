-- 081_escalacao_card_fixo_brasileirao_setembro.sql
--
-- Cria o card fixo do Brasileirão para setembro/2026 em status='rascunho'.
-- Rascunho = editável, T5/T6 não travam nada ainda. Publicar é decisão manual
-- (via /admin/escalacao) e SÓ depois do pool populado com atletas oficiais.
--
-- Parâmetros escolhidos:
--   n_titulares=11, n_reservas=3 — XI clássico + banco enxuto (Art. 15 sugestão).
--   teto_por_esporte=14, teto_conta_reservas=false — inócuo (só há futebol),
--     mas satisfaz o CHECK do schema.
--   entrada_z=200, pontos_por_z=1 — padrão do Modo Escalação.
--   teto_emissao_z=200000 — disjuntor de emissão do card (COMPLIANCE.md).
--     Se o total a pagar ultrapassar isso, o pagamento inteiro é recusado.
--   abre_em 2026-09-01 12:00Z, fecha_em 2026-09-05 12:00Z — antes da primeira
--     rodada de setembro. Reajustar antes do publish se o calendário mudar.
--   premio_real=false — Escalação nunca paga R$; prêmios em Z$ via
--     escalacao_pagar_card (única emissão contabilizada de Z$).
--
-- Ruleset: futebol.v1 (agregacaoMes='soma', stats individuais — serve pontos
-- corridos direto, sem precisar de futebol.v2 que T5 bloquearia UPDATE).

do $$
declare
  v_card_id uuid;
  v_competicao_id uuid;
  v_regra_id uuid;
begin
  select id into v_competicao_id
    from public.escalacao_competicao
   where slug = 'brasileirao';
  if v_competicao_id is null then
    raise exception 'competição brasileirao não encontrada — rodar migration 080 antes';
  end if;

  select id into v_regra_id
    from public.escalacao_regra
   where esporte_key = 'futebol' and versao = 1;
  if v_regra_id is null then
    raise exception 'regra futebol.v1 não encontrada — publicar ruleset antes';
  end if;

  -- Idempotência: se já existe rascunho fixo pra Brasileirão em set/2026, sai.
  if exists (
    select 1 from public.escalacao_card
     where modo = 'fixo' and competicao_id = v_competicao_id
       and mes = date '2026-09-01'
  ) then
    return;
  end if;

  insert into public.escalacao_card (
    modo, mes, competicao_id, titulo,
    n_titulares, n_reservas, teto_por_esporte, teto_conta_reservas,
    multiplicador_capitao, entrada_z, pontos_por_z, teto_emissao_z,
    abre_em, fecha_em, status, premio_real
  )
  values (
    'fixo', date '2026-09-01', v_competicao_id, 'Brasileirão — Setembro/2026',
    11, 3, 14, false,
    1.5, 200, 1, 200000,
    timestamptz '2026-09-01 12:00:00+00',
    timestamptz '2026-09-05 12:00:00+00',
    'rascunho', false
  )
  returning id into v_card_id;

  insert into public.escalacao_card_esporte (card_id, esporte_key, regra_id)
  values (v_card_id, 'futebol', v_regra_id)
  on conflict do nothing;
end $$;
