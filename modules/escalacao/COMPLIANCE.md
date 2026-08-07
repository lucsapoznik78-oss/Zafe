# Modo Escalação — Checkpoint de Compliance

> **Status: AGUARDANDO APROVAÇÃO DO DONO.** O schema (migration 075) e o motor de
> pontuação já estão em produção, mas **inertes**: `ESCALACAO_ENABLED` é opt-in,
> não existe rota pública e nenhum card foi criado. Nenhuma Convocação pode abrir
> antes de o dono assinar a seção 6.

## 1. O que é

O participante monta um **time de 10 titulares + 2 reservas** com atletas reais e
pontua pelo desempenho deles em competições oficiais (UFC, surf, F1, boxe — e,
quando os manuais chegarem, Champions e tênis). Formato Cartola FC.

Roda na **zona grátis, 100% em Z$**, com ranking mensal próprio e **sem qualquer
ligação com o Concurso Mensal** (Art. 3 do regulamento).

## 2. Por que isto REFORÇA o enquadramento legal

O **Art. 49, IV da Lei 14.790/2023** exige que o resultado não dependa do
desempenho isolado de uma única pessoa. Os eventos SIM/NÃO da Liga
("Fulano defende o cinturão?") tensionam esse inciso — cada um depende de um
atleta só. Um time de 12 atletas de esportes diferentes o satisfaz com folga.

Os outros incisos:

- **Art. 49, I** — regras preestabelecidas e conhecidas: o ruleset é um documento
  versionado (`escalacao_regra`), **imutável depois de publicado** (trigger T5), e
  legível por qualquer usuário autenticado (policy `escalacao_regra_select`).
- **Art. 49, II** — resultado por critério objetivo, sem julgamento do operador:
  toda a pontuação é aritmética sobre estatísticas oficiais. Onde o manual pedia
  julgamento, a regra foi recusada — a F1 não distingue causa de abandono
  justamente porque distinguir exigiria atribuir culpa.
- **Art. 49, III** — habilidade preponderante: escalar 12 atletas dentro de tetos
  por esporte e por competição, escolhendo ordem de reservas e prevendo quem
  compete, é seleção sob restrição, não sorteio.

## 3. A exceção deliberada à conservação de Z$

**Esta é a única diferença de Escalação para todo módulo existente no Zafe, e
precisa estar escrita.**

`games_score_event` produz pontos que **nunca** entram na economia Z$. Os pontos
da Escalação **entram**: no pagamento do card, `pontos_total ÷ pontos_por_z` vira
saldo na carteira. Ou seja, **Escalação EMITE Z$**.

A invariante da plataforma não é abandonada — é **reescrita**:

```
SUM(wallets.balance) + SUM(potes abertos) − SUM(escalacao_emissao.z_liquido)
  = constante
```

Todo Z$ que entra ou sai por este módulo é contabilizado em
`escalacao_emissao` (`z_debitado` = entradas destruídas, `z_creditado` = prêmios
emitidos, `z_liquido` gerado). Nenhuma emissão é silenciosa.

**Três travas:**

1. **Disjuntor por card** (`teto_emissao_z`, C14). Um bug de pontuação num modo
   que emite moeda é perda ilimitada. `escalacao_pagar_card()` soma o total a
   emitir ANTES de pagar qualquer um; se passar do teto declarado na abertura do
   card, **recusa por inteiro e não paga ninguém**. Catástrofe vira alerta.
2. **Débito atômico na inscrição** (`escalacao_inscrever`), por
   `UPDATE wallets ... WHERE balance >= entrada_z` sob lock de linha — o mesmo
   padrão de `games_join_pot`, mais forte que o CAS de `lib/wallet.ts`.
3. **Idempotência** por CAS em `pago_em IS NULL` no card e `premio_pago_em IS
   NULL` por time: pagar duas vezes é impossível.

## 4. O ringfence contra o mundo em R$

Escalação **jamais** carrega prêmio real.

- `escalacao_card.premio_real BOOLEAN NOT NULL DEFAULT false CHECK (premio_real =
  false)` — um **fio de tropeço deliberado**: uma coluna que só pode valer
  `false`. Ligar prêmio real exige uma migration que um revisor vai ver.
  (O `has_real_prize` citado nos documentos de produto **não existe no repo** —
  só aparece como aspiração em `docs/insights/zafe-prize-integrity.md`.)
- Nenhuma tabela `escalacao_*` carrega `concurso_id` nem faz join com
  `concursos`. Nenhum caminho de código escreve em `concurso_wallets`,
  `inscricoes_concurso` ou `payouts_concurso`.

**PROIBIÇÃO PERMANENTE — o risco de fundo:** o Z$ emitido cai na carteira
**principal**. Hoje não há ponte, porque `concursos.saldo_inicial` é um snapshot
fixo de 1000 ZC$. **No dia em que qualquer elegibilidade, cota ou vantagem do
Concurso pago passar a depender do saldo Z$ principal, a Escalação vira um
caminho econômico para dentro do mundo em R$.** Nenhuma regra do Concurso pode
ler `wallets.balance`. Isto não é uma recomendação; é a condição sob a qual este
módulo é compliant.

## 5. O que Escalação NÃO é (proibições explícitas)

- ❌ Mercado, order book, odds ou pool parimutuel — não há aposta contra ninguém.
- ❌ Prêmio em R$, PIX ou qualquer valor real. Prêmio é Z$, sempre.
- ❌ Conversão Z$ ⇆ R$, depósito ou saque.
- ❌ Copy com "aposta/bet/apostador", "odds", "depósito", "saque", "cassino".
      Diz-se **Convocação**, **escalação**, **time**, **pontuação**.
- ❌ Pontuação por julgamento do operador. Se um manual pedir "boa atuação",
      a linha não entra.

## 6. Critério de aprovação

Antes de abrir a primeira Convocação, o dono precisa confirmar:

- [ ] Escalação emite Z$, dentro do teto por card, e a invariante reescrita da
      seção 3 substitui a regra 4 do `CLAUDE.md` para este módulo.
- [ ] Prêmio é exclusivamente Z$; `premio_real` permanece travado em `false`.
- [ ] Nenhuma regra do Concurso pago passará a depender do saldo Z$ principal.
- [ ] **Emenda ao Art. 16** do regulamento: o débito acontece **na inscrição**,
      não no encerramento da Convocação (os 19 crons do Zafe nunca dispararam —
      `docs/audits/CRONS-NAO-DISPARAM.md` — e no desenho original o time ficaria
      inscrito de graça).
- [ ] **Artigo novo de cancelamento de card** com reembolso integral: o Art. 16
      §3 cobre "atleta não competiu" (sem devolução), mas não cobre "o card
      inteiro foi cancelado". Implementado em `escalacao_reembolsar_card()`.
- [ ] **Correção do Art. 7 §1** (prazo único) ou aceitação do prazo por esporte:
      o manual de surf §8 demonstra que o prazo único é inviável (a janela de
      espera da WSL obriga o surf a fechar antes de todos os outros). O schema
      suporta as duas respostas (`escalacao_card_esporte.fecha_em`); o
      regulamento precisa escolher antes de ser publicado.

**Assinatura do dono:** _______________  **Data:** ____/____/______
