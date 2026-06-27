# Como criar um evento (mercado) na Zafe — checklist obrigatório

> Guia de criação de eventos para Liga, Econômico, Privadas, Comunidade e Concurso.
> A **causa-raiz** dos eventos impossíveis/duplicados/expiráveis encontrados nas
> auditorias é a **ausência de validação na criação e na replicação** de eventos.
> Rode este checklist **antes** de publicar qualquer evento. Hoje a validação
> abaixo é **manual** — `app/api/criar/route.ts` só checa campos obrigatórios,
> `closes_at > now()` e o gate de `economia`. Ele **não** verifica plausibilidade,
> data-vs-evento-real nem duplicata.

## Onde os eventos vivem

- Liga / Econômico / Concurso / Privadas → tabela **`topics`** (campo `category`,
  `is_private`, `concurso_id`, `market_type` = `binary` | `multi`).
- Comunidade → tabela **`community_events`** (fluxo próprio).
- Replicação de templates do Concurso → `app/api/concurso/replicar-topics`
  (esta rota é a fonte recorrente de eventos quebrados — valide o template antes).

## Como criar

1. **UI** `/criar` (binário ou multi) → `POST /api/criar`. Eventos `economia`
   exigem `role='admin'` ou `pode_criar_economico=true`.
2. **Admin** aprova em `/api/admin/aprovar` (sai de `pending` → `active`).
3. **Concurso**: criar como `topics` com `concurso_id` setado, ou replicar
   templates via `replicar-topics` (revise o template primeiro).

---

## ✅ Checklist ANTES de publicar

### 1. A data está correta? (`closes_at` ANTES do desfecho real)

O mercado **deve fechar antes** do evento do mundo real acontecer. Se fechar
durante/depois, o resultado já é conhecido enquanto ainda aceita palpites →
**exploit** (a pessoa aposta sabendo o resultado). Regra:

> `closes_at` < horário de início do evento real (com margem de segurança).

Exemplos reais (Copa 2026):
- Jogo dia 11/06 → `closes_at` = **10/06 23:59 BRT**.
- Estreia do Brasil 13/06 → `closes_at` = **12/06 23:59 BRT**.
- "Terminar a fase de grupos em 1º" (grupos acabam 27/06) → fecha **26/06**.

⚠️ Atenção a fuso: o banco grava em UTC. BRT = UTC−3. Para fechar 26/06 23:59 BRT,
grave `2026-06-27 02:59:59+00`.

⚠️ Atenção a **calendário/contexto**: o Brasileirão **pausa para a Copa**
(sem rodadas de clubes em junho/2026); Eliminatórias CONMEBOL **já acabaram**;
Libertadores tem oitavas só em **agosto**. Nunca crie um evento cujo desfecho
não pode ocorrer dentro da janela de `closes_at`.

### 2. O evento existe / é possível no mundo real?

Antes de publicar, **confirme por busca** que:
- A partida/jogo/decisão **realmente acontece** na data citada (calendário oficial:
  FIFA/CBF/CONMEBOL para esporte; BCB/Copom para Selic; etc.).
- O sujeito ainda é elegível (ex.: jogador aposentado, time eliminado, evento já
  decidido). Mercados sem incerteza (resultado já conhecido) são **degenerados** —
  não publique.
- O título é **claro e resolvível** (sem "se classificar no dia X" sem fixture).

### 3. Não é duplicata?

Rode esta busca por título/tema parecido **em todos os módulos** antes de criar:

```sql
-- Substitua os termos pelo tema do novo evento
SELECT id::text, category, is_private, concurso_id, status, closes_at, title
FROM topics
WHERE status IN ('pending','active')
  AND (
    title ILIKE '%bitcoin%' OR title ILIKE '%btc%'      -- ex.: cripto
    -- title ILIKE '%selic%' OR title ILIKE '%copom%'
    -- title ILIKE '%flamengo%'
  )
ORDER BY closes_at;
```

Tipos de duplicata a evitar:
- **Exata**: mesmo tema, mesmo limiar, mesma janela (ex.: dois "BTC > US$120k até 30/06").
- **Semântica**: mesmo evento reescrito ("BTC > US$120k" vs "BTC > R$600.000").
- **Cross-module**: o mesmo desfecho em Liga e Concurso/Econômico. Se for
  intencional (pools separados), tudo bem — caso contrário, consolide.
- **Contraditória**: decisão única modelada como vários binários soltos
  (ex.: Copom "manter" vs "cortar" vs "reduzir"). Modele como **um** binário.

### 4. Conformidade / linguagem

- Use **"previsão/palpite"**, nunca "aposta/bet" (Lei 14.790/2023, Art. 49 — fantasy sport).
- Sem conteúdo ofensivo/ilegal; mercados de pessoas físicas privadas com cautela.

---

## Consultas úteis de auditoria (rodar periodicamente)

```sql
-- (a) Eventos que fecham DEPOIS de já estarem "vencidos" hoje
SELECT id::text, category, closes_at, title
FROM topics WHERE status='active' AND closes_at < now() ORDER BY closes_at;

-- (b) Eventos esportivos ativos em junho (revisar contra calendário da Copa)
SELECT id::text, closes_at, title
FROM topics WHERE status='active' AND category='esportes'
  AND closes_at BETWEEN '2026-06-01' AND '2026-07-10' ORDER BY closes_at;

-- (c) Contagem de palpites antes de cancelar (NUNCA cancele sem checar)
SELECT t.id::text, t.title,
  (SELECT count(*) FROM bets b WHERE b.topic_id=t.id) AS bets,
  (SELECT count(*) FROM concurso_bets cb WHERE cb.topic_id=t.id) AS concurso_bets,
  (SELECT count(*) FROM orders o WHERE o.topic_id=t.id AND o.status IN ('open','partial')) AS open_orders
FROM topics t WHERE t.id = '<UUID>';
```

## Como corrigir um evento problemático

- **Data errada, 0 palpites/ordens** → `UPDATE topics SET closes_at=... WHERE id=...`
  (ajuste para ANTES do desfecho real).
- **Impossível/duplicado/degenerado, 0 palpites E 0 ordens** →
  `UPDATE topics SET status='cancelled' WHERE id=...`. **Nunca** `DELETE` em prod.
- **Com palpites/ordens** → **NÃO** cancele direto: é dinheiro de usuário.
  Use o fluxo de reembolso/resolução adequado (conservação de Z$, regra 4) e
  confirme com o dono antes.

## Root cause ainda aberto (corrigir no código)

`app/api/criar/route.ts` e `app/api/concurso/replicar-topics` **não validam**
data-vs-desfecho, existência da partida nem duplicata. Enquanto isso não for
automatizado, este checklist manual é obrigatório a cada criação/replicação.
