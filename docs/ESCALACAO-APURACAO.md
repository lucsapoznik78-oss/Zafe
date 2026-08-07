# Apuração do Modo Escalação — runbook

> A apuração é **manual e humana**. Nenhum cron participa (os 19 crons da Zafe nunca
> dispararam — `docs/audits/CRONS-NAO-DISPARAM.md`), e é deliberado: este é o único
> módulo que **emite** Z$, e emissão automática de moeda sem alguém olhando é como
> um bug de pontuação vira perda ilimitada.
>
> Regra de ouro do modo: **recalcular é reversível, pagar não.** As duas ações vivem
> em endpoints diferentes de propósito. Nunca junte num botão só.

Painel: `/admin/escalacao` (gate `profiles.is_admin` no middleware).
Flag pública: `NEXT_PUBLIC_ESCALACAO_ENABLED` — opt-**in**. Enquanto ela não existir,
o modo não tem nenhuma superfície para o usuário.

---

## Ciclo de vida de um card

```
rascunho ──publicar──▶ aberto ──(fecha_em passa)──▶ fechado
                                                      │
                                        lançar stats  │
                                                      ▼
                                   recalcular ──▶ apurado ──pagar──▶ pago
```

Estados são valor de coluna em `escalacao_card.status`. `cancelado` existe para
`escalacao_reembolsar_card()`.

---

## 1. Criar o card (rascunho)

`/admin/escalacao` → formulário "Nova Convocação".

O que **congela na publicação** (trigger T6, Art. 33 + CDC art. 30 — depois disso
não muda mais, nem por SQL): `entrada_z`, `pontos_por_z`, `n_titulares`,
`n_reservas`, `teto_por_esporte`, `teto_conta_reservas`, `multiplicador_capitao`,
`fecha_em`.

Confira antes de publicar:

- [ ] **`fecha_em` é anterior ao primeiro evento real do card.** Mesma regra do
      `closes_at` em `docs/CRIAR-EVENTO.md`: se a escalação fecha depois do início
      do evento, alguém escala sabendo o resultado.
- [ ] **`teto_emissao_z`** — o disjuntor. Use ~3× a emissão esperada
      (`n_times_previsto × pontos_médios ÷ pontos_por_z`). Se o total a pagar
      estourar, `escalacao_pagar_card()` recusa o pagamento **por inteiro** e
      devolve `{ok:false, reason:'teto_emissao'}`. Isso é bom: significa que um bug
      de pontuação virou alerta em vez de moeda. É a única coluna de dinheiro que
      o T6 **não** congela: publicado o card, ela ainda pode subir se a adesão
      real passar da prevista.
- [ ] **`pontos_por_z` = 1.** Os manuais de 7/ago/2026 pontuam direto em Z$: "+30"
      na tabela é +30 Z$ na carteira. A coluna continua existindo para permitir
      emitir um card com câmbio diferente sem migration.
- [ ] **Ruleset por esporte.** O botão `esporte.vN` fixa a versão do manual neste
      card. A FK composta `(card_id, esporte_key, regra_id)` torna
      **estruturalmente impossível** guardar um score calculado com ruleset que
      este card não fixou.

## 2. Importar o pool

Card → "Pool do card". Cole o CSV, uma linha por atleta:

```
esporte,competicao_slug,nome,genero,referencia
ufc,ufc,Islam Makhachev,m,
surf,wsl-ct,Gabriel Medina,m,
```

- O `esporte` precisa estar entre os esportes do card. O `regra_id` sai **do card**,
  nunca do CSV.
- Reimportar é idempotente (chave: slug derivado de nome + esporte). Atleta já no
  pool é ignorado, não duplicado.
- Erros vêm linha a linha; as linhas boas entram mesmo assim.
- Depois de `fecha_em` o pool congela (trigger T4, Art. 22).

## 3. Publicar

Botão "Publicar card". Recusa se o prazo já passou ou se o pool tem menos atletas
que `n_titulares` — publicar card vazio abriria uma Convocação em que ninguém
consegue escalar ninguém.

**É de mão única.** A partir daqui T6 vale.

## 4. Lançar os stats

Card → "Apurar" → `/admin/escalacao/{id}/apuracao`.

O formulário é **gerado a partir de `escalacao_regra.stats`**. Não existe código de
apuração por esporte: boxe, F1, Champions e tênis chegam como `INSERT` em
`escalacao_regra` e o formulário já sabe desenhá-los.

Por atleta e por evento:

1. Escolha o atleta e confirme o `evento_key` (`ufc-331`, `wsl-stop9`).
2. Preencha os campos gerais (uma vez por evento) e as **ocorrências** — a unidade
   de sub-evento do esporte: bateria no surf, luta no UFC, corrida na F1.
3. Se o atleta não competiu, marque **Competiu? não** e escreva o motivo. Isso é o
   que aciona a reserva (Art. 19).
4. **Clique em "Pré-visualizar" antes de gravar.** É a trava mais barata contra erro
   de digitação num modo que emite moeda — e o Art. 34 exige que o breakdown
   itemizado exista de qualquer forma. O preview pontua o **mês inteiro**, não só o
   evento digitado: no UFC duas lutas somam e no surf só o stop designado conta.
5. "Gravar" **substitui** todas as linhas daquele atleta naquele evento. Relançar
   corrige, nunca acumula.

Formatos:

| tipo | como digitar |
|---|---|
| `num` | `96` ou `13,10` (vírgula aceita) |
| `bool` | botão sim/não — o "não" é gravado como 0, e isso importa: "não avançou de nenhuma bateria" é um limiar sobre a soma dos avanços |
| `cat` | select com as opções do ruleset |
| `lista` | separador `;`, decimal com ponto: `8.20;10.00` |

## 5. Recalcular

Botão "Recalcular apuração". Recomputa **tudo do zero**:

1. Pontua cada atleta do pool **uma vez** (UFC §10 — a nota do atleta é a mesma
   para todos os times que o escalaram) e grava `pontos` + `detalhe`.
2. Por time: aciona reservas (titular com `competiu=false` consome a próxima
   reserva não usada; reserva não acionada pontua zero) e grava `pontua`,
   `substituiu_id`, `pontos_aplicados`.
3. Soma o total do time e marca `status='apurado'`.

Rode quantas vezes quiser. Corrigiu um stat? Recalcule. Não há resíduo do cálculo
anterior — é isso que permite cumprir o Art. 34 (corrigir erro comprovado e
republicar o ranking).

## 6. Pagar

`escalacao_pagar_card(p_card)` — **ainda sem botão, de propósito** (fases 3–6).

- CAS em `pago_em IS NULL` + claim por time em `premio_pago_em IS NULL`:
  chamar duas vezes não paga duas vezes.
- Recusa por inteiro se a emissão total passar de `teto_emissao_z`.
- Prêmio clampa em 0 — atleta pode pontuar negativo (derrota, abandono, cartão
  vermelho) e o total do time pode ficar negativo, mas ninguém sai devendo.
- Toda entrada e todo prêmio passam por `escalacao_emissao`. É a contabilidade da
  exceção à conservação de Z$ (`modules/escalacao/COMPLIANCE.md`).

---

## Quando algo dá errado

| Sintoma | Causa provável |
|---|---|
| "os termos do card já foram publicados e não podem mudar" | T6. Correto. Cancele o card e crie outro. |
| "ruleset X.vN já foi publicado" | T5. Emenda de manual = **nova versão**, válida do card seguinte. Nunca edite a versão que vigorou. |
| "a escalação de X fechou em … e não pode mais mudar" | T2. O prazo passou. Comparação é de timestamp, não de status — vale mesmo com os crons mortos. |
| Preview não mostra uma regra | O stat não foi preenchido, ou a guarda (`quando`) não bateu. Regra que não pontua não vira linha. |
| Total bate no teto/piso | Clamp do evento (`teto_evento`/`piso_evento` do ruleset). Os nove manuais de 7/ago/2026 **não** impõem clamp — quem protege a economia é o `teto_emissao_z` do card. O preview mostra o bruto ao lado. |
| Pagamento recusado com `teto_emissao` | **Não aumente o teto.** Confira a pontuação primeiro — o disjuntor abriu por algum motivo. |

## Cancelar um card

`escalacao_reembolsar_card(p_card)` devolve a entrada integralmente e marca o card
`cancelado`. Use quando a competição do mundo real não aconteceu. O Art. 16 §3 cobre
"atleta não competiu" (sem devolução) mas **não** cobre "o card inteiro foi
cancelado" — o artigo precisa ser escrito antes da estreia.
