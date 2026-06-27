# Zafe Games — Checkpoint de Compliance

> **Status: AGUARDANDO APROVAÇÃO DO DONO.** Nenhum evento/mercado de Games
> pode ser criado antes do dono assinar esta decisão. Este é o passo
> bloqueante da seção 1 da especificação.

## 1. A pergunta legal

Zafe é uma **competição de habilidade com moeda virtual (Z$)**, enquadrada como
**fantasy sport pelo Art. 49 da Lei 14.790/2023** — **não é casa de apostas, não é
jogo de azar**. A regra que governa este módulo:

> **Eventos públicos só podem ser sobre esporte e e-sports** (resultados de
> partidas, classificações, eliminações, títulos). Qualquer evento público fora
> desse escopo descaracteriza a plataforma e deve ser saneado (cron
> `saneamento-fantasy`).

Logo: **e-sports é o escopo central da plataforma**. O prêmio do Concurso pago é
**fixo, definido na abertura e independente do número de inscritos ou do valor
arrecadado** (Art. 49) — nunca um pool variável de apostas.

## 2. Decisão de estrutura

Games é estruturado como **bolão de torneio isolado**, copiando o padrão já
validado da **Zafe Copa** (migration 027). Dois modos, ambos 100% em Z$
virtual, sem mistura com R$:

### Modo A — Grátis (estilo Concurso) — PADRÃO
- Usuário dá um **palpite** ("Quem ganha?") sem custo de entrada.
- Acertos valem **pontos internos** (`games_score_event`), que **nunca entram
  na economia Z$** — não há crédito de saldo, não há inflação, a conservação
  `SUM(wallets.balance)` permanece intacta.
- Pontos alimentam ranking, ranks e badges (gamificação).
- É o modo livre para qualquer participante.

### Modo B — Pote (estilo Copa) — OPCIONAL
- Buy-in de Z$ **da carteira principal** forma um **pote fechado** do evento.
- O pote é dividido (parimutuel, 0% de comissão) entre **quem acertou o lado
  vencedor**, proporcional ao buy-in, via função `SECURITY DEFINER` atômica
  (`games_pot_settle`, espelha o padrão da Copa). Se ninguém acertou o lado
  vencedor, reembolsa todos. O último vencedor absorve o resto do arredondamento,
  garantindo `SUM(payout) = pote` exato.
- É um **pool fechado entre participantes do bolão**, não um mercado público.
- Conservação garantida: `SUM(wallets.balance) + SUM(potes abertos) = const`.

### O que Games NÃO é (proibições explícitas)
- ❌ Mercado público de e-sports / order book público.
- ❌ Odds dinâmicas exibidas como "mercado preditivo" aberto.
- ❌ Qualquer conversão Z$ ⇆ R$ (sem depósito, sem saque).
- ❌ Copy com "aposta/bet/apostador", "odds", "depósito", "saque", "cassino".

## 3. Regra de vocabulário (copy pt-BR)

Toda string visível usa: **"previsão/palpite/previsor"** (nunca "aposta/bet"),
**"probabilidade"** (nunca "odds"), **"competição de habilidade"** (nunca
"jogo de azar"). Teste mental: *"o Cartola FC diria isso sobre si mesmo?"*
Identificadores de código e rotas podem manter nomes técnicos (`games_event`,
`games_prediction`) — a regra é só para texto ao usuário.

## 4. Regra monetária de ouro

As economias Z$ (virtual) e R$ (real) **nunca se misturam** neste módulo:
- Sem conversão depósito→Z$ e sem Z$→saque bancário.
- O buy-in do Modo B é Z$ virtual saindo e voltando à carteira Z$ — jamais R$.
- Toda escrita em `wallets` passa por `lib/wallet.ts` (CAS otimista) **ou** por
  função `SECURITY DEFINER` atômica restrita ao `service_role` (padrão Copa,
  quando há atomicidade multi-tabela). Nunca `update` cru em `wallets`.

## 5. Por que isto é compliant

O módulo Zafe Copa já opera sob exatamente este desenho (bolão de torneio,
pontos internos, pote fechado opcional) e está em produção como precedente
interno. Games é o mesmo padrão aplicado a torneios de e-sports
(Free Fire, Valorant, CS2, LoL). Modelo análogo de mercado: Cartola FC
(Globo) — competição de habilidade premiada, não aposta.

## 6. Critério de aprovação

Só prossigo para a migration 045 (schema) após o dono confirmar:

- [ ] E-sports fica restrito a bolão (Modo A grátis + Modo B pote), **sem**
      mercado público.
- [ ] Buy-in do Modo B sai e volta à carteira Z$ principal, sem tocar R$.
- [ ] Copy seguirá a regra de vocabulário pt-BR.

**Assinatura do dono:** _______________  **Data:** ____/____/______
