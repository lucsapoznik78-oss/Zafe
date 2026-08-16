-- 088 — Personagem 3D + loja de acessórios
--
-- A `figura` da 086 era um avatar 2D só de rosto (DiceBear), grátis e ilimitado.
-- Vira um personagem 3D de corpo inteiro que se DESBLOQUEIA por Z$ 100 (uma vez)
-- e se veste com acessórios comprados um a um em Z$.
--
-- O que fica no banco: quem desbloqueou, quem tem qual item, e o retrato salvo.
-- O que NÃO fica no banco: o catálogo. Preço, raridade e geometria de cada item
-- vivem em `lib/figura/catalogo.ts` — um item é uma função que devolve malha 3D,
-- coisa que não cabe numa linha de tabela, e o preço precisa versionar junto com
-- o modelo. O servidor continua sendo a autoridade do preço porque a rota lê o
-- catálogo dele mesmo; o corpo do request não tem campo de preço.

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists figura_desbloqueada boolean not null default false,
  add column if not exists figura_url          text,
  add column if not exists figura_retrato_url  text,
  add column if not exists figura_legado       jsonb;

comment on column public.profiles.figura_desbloqueada is
  'Pagou os Z$ 100 do editor de personagem. Uma vez só — editar depois é grátis.';
comment on column public.profiles.figura_url is
  'PNG de corpo inteiro (512x768) no bucket avatares. Perfil.';
comment on column public.profiles.figura_retrato_url is
  'PNG de retrato (128x128) no bucket avatares. Navbar, ranking, comentários.';
comment on column public.profiles.figura_legado is
  'Snapshot da figura DiceBear (v1) antes da migração pro 3D. É o rollback.';

-- Quem já montou avatar no DiceBear ganha o desbloqueio. Cobrar Z$ 100 de quem
-- já usa a funcionalidade é tomar de volta uma coisa dada — e é justamente o
-- grupo mais engajado, o primeiro cliente natural da loja. A v1 fica guardada.
update public.profiles
   set figura_desbloqueada = true,
       figura_legado       = figura
 where figura is not null;

-- ARMADILHA (ver 066_security_lockdown_lote7_profiles_pii.sql): `authenticated`
-- NÃO tem SELECT de tabela em profiles — o acesso é concedido coluna por coluna.
-- Coluna nova sem grant explícito derruba a API inteira com "permission denied
-- for table profiles". `figura_legado` fica de fora de propósito: é histórico
-- interno, ninguém precisa ler pelo client.
grant select (figura_desbloqueada, figura_url, figura_retrato_url)
  on public.profiles to authenticated, anon;

-- Sem `grant update`: a escrita dessas colunas passa só pela rota de save, que
-- usa service role. O usuário não pode se desbloquear sozinho com um PATCH.

-- ------------------------------------------------------------- inventário
create table if not exists public.figura_inventario (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null,
  preco_pago  numeric(12,2) not null default 0,
  origem      text not null default 'compra',
  comprado_em timestamptz not null default now(),
  primary key (user_id, item_id),
  constraint figura_inventario_origem_ck
    check (origem in ('compra', 'brinde', 'inicial'))
);

comment on table public.figura_inventario is
  'Itens de personagem que o usuário possui. Permanente: não há revenda nem estorno.';
comment on column public.figura_inventario.preco_pago is
  'Quanto custou NA ÉPOCA. Guardado para que mudança de preço no catálogo não reescreva a história.';

create index if not exists figura_inventario_user_idx
  on public.figura_inventario (user_id);

alter table public.figura_inventario enable row level security;

-- Só leitura, e só do próprio inventário. A escrita não tem policy nenhuma de
-- propósito: entra exclusivamente pela RPC `figura_comprar` (SECURITY DEFINER),
-- que é o único lugar onde comprar e debitar acontecem na mesma transação.
drop policy if exists "dono le o proprio inventario" on public.figura_inventario;
create policy "dono le o proprio inventario"
  on public.figura_inventario for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.figura_inventario to authenticated;

-- ---------------------------------------------------------------- storage
-- Bucket público: o retrato aparece em ranking e perfil público, que são
-- páginas abertas — URL assinada exigiria assinar dezenas de URLs por render e
-- mataria o cache de CDN. Não há nada sensível num boneco de blocos.
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- Leitura para qualquer um; escrita não tem policy, então só o service role
-- (que ignora RLS) sobe arquivo — sempre pela rota, nunca do navegador direto.
drop policy if exists "avatares sao publicos" on storage.objects;
create policy "avatares sao publicos"
  on storage.objects for select
  to public
  using (bucket_id = 'avatares');
