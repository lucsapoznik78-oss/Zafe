-- 070 — Impede que o mesmo usuário palpite nos dois lados do mesmo evento.
--
-- A checagem já existia na camada de API (/api/apostar e lib/apostar.ts), mas
-- rotas de serviço (ex.: cron de saneamento, que re-aloca palpites em outro
-- evento) inseriam direto na tabela e furavam a regra. Trava agora no banco,
-- que é o único ponto por onde toda escrita passa.
--
-- Casos já existentes ficam intactos — o trigger só roda em INSERT.
-- Palpites privados (is_private) são pool fechado entre usuários diferentes,
-- então ficam de fora.

create or replace function public.bloqueia_palpite_lados_opostos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflito uuid;
begin
  if coalesce(new.is_private, false) then
    return new;
  end if;

  -- Palpites encerrados/devolvidos não bloqueiam um novo palpite.
  if new.status in ('refunded', 'exited', 'won', 'lost') then
    return new;
  end if;

  select b.id into v_conflito
  from public.bets b
  where b.topic_id = new.topic_id
    and b.user_id = new.user_id
    and b.id <> new.id
    and coalesce(b.is_private, false) = false
    and b.status not in ('refunded', 'exited', 'won', 'lost')
    and (
      -- binário: lado oposto
      (new.side is not null and b.side is not null and b.side <> new.side)
      -- múltipla escolha: outro resultado
      or (new.outcome_id is not null and b.outcome_id is not null and b.outcome_id <> new.outcome_id)
    )
  limit 1;

  if v_conflito is not null then
    raise exception 'Você já palpitou no outro lado deste evento'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bloqueia_palpite_lados_opostos on public.bets;

create trigger trg_bloqueia_palpite_lados_opostos
  before insert on public.bets
  for each row
  execute function public.bloqueia_palpite_lados_opostos();

-- Suporte à consulta do trigger.
create index if not exists idx_bets_topic_user_side
  on public.bets (topic_id, user_id, side);
