# Como cancelar uma aposta privada (bolão)

## Regra

> **O criador pode cancelar um bolão privado enquanto NENHUM adversário (lado B)
> tiver aceitado.** Sem oposição aceita, só o stake do próprio criador está em
> jogo, então o cancelamento + reembolso é seguro e conserva Z$ (regra 4).
> Assim que um adversário do lado B aceita, há dinheiro de terceiro travado e o
> cancelamento unilateral fica **bloqueado** — use o fluxo de resolução/juiz.

Vale para os dois modelos:

- **Modelo simples** (`topics.private_phase` nulo): cancelável enquanto não houver
  participante `side='B'` com `status='accepted'`. Não importa se `status` é
  `pending` ou `active` — o que importa é a ausência de adversário aceito.
- **Modelo por fases** (`private_phase` preenchido): cancelável nas fases
  `recruiting`, `leader_election` e `judge_negotiation`.

## Como cancelar (usuário)

1. Abra o bolão em `/privadas/<id>`.
2. Se você é o criador e nenhum adversário aceitou, aparece o link
   **"Cancelar este bolão"** no rodapé do card.
3. Confirme. Todos os participantes **aceitos** (inclusive você) são reembolsados
   no valor de `min_bet`, recebem notificação, as `bets` viram `refunded` e o
   `topic` vira `status='cancelled'` / `private_phase='cancelled'`.

## O que o endpoint faz (`POST /api/apostas-privadas/[id]/cancelar`)

- Exige autenticação e que `topic.creator_id === user.id`.
- Recusa se o bolão já estiver `resolved`/`cancelled`.
- Recusa se algum participante `side='B'` já aceitou (`"um adversário já aceitou
  este bolão"`).
- Reembolsa cada participante aceito (`creditBalance` + `transactions.type='bet_refund'`
  + notificação), marca `bets.status='refunded'` e cancela o `topic`.

> ⚠️ `bet_status` **não** tem o valor `'cancelled'`. Bets canceladas devem ir para
> `'refunded'`.

## Cancelar manualmente em produção (admin) — só com 0 adversários aceitos

Antes de qualquer ação, confirme que nenhum adversário aceitou e conte o que será
reembolsado:

```sql
SELECT
  t.id::text, t.title, t.status, t.private_phase, t.min_bet, t.creator_id,
  (SELECT count(*) FROM topic_participants p
     WHERE p.topic_id=t.id AND p.side='B' AND p.status='accepted') AS adversarios_aceitos,
  (SELECT count(*) FROM topic_participants p
     WHERE p.topic_id=t.id AND p.status='accepted') AS aceitos_total
FROM topics t WHERE t.id='<UUID>';
```

Se `adversarios_aceitos = 0`, prefira chamar o endpoint (faz reembolso +
transação + notificação atômicos). Mutação manual de carteira deve respeitar o
lock otimista (coluna `version`) e registrar a transação de reembolso — **nunca**
credite saldo sem lançar a `transaction` correspondente (regra 4).

Nunca use `DELETE` em prod: cancele via `status='cancelled'`.
