# SPEC — LOOP INSTAGRAM · agents A2 → A7

> ⚠️ **DOCUMENTO HISTÓRICO — parcialmente desatualizado (25/07/2026).**
> Os agents que valem hoje são os markdown em `zafe_contact/Agents/Insta/`.
> Três coisas mudaram desde que este spec foi escrito:
>
> 1. **A Página1 tem 17 colunas, não 33.** Não existem colunas `Gancho`,
>    `Mensagem (copia)`, `Aprovado?`, `Classificacao`, `Ultimo agent`. Esses
>    campos moram dentro de `Notas` como `chave=valor`.
> 2. **A seção 9 manda "nunca esconder a taxa de R$ 20". Isso se inverteu:** o
>    Concurso está desligado (`NEXT_PUBLIC_CONCURSO_ENABLED=false`, sem CNPJ nem
>    PIX), então a copy **não pode mencionar** Concurso, R$ 20 ou prêmio em
>    dinheiro. A oferta é a zona grátis.
> 3. **Não há automação de navegador.** O spec descreve digitar no DM sem apertar
>    Enter, varrer inbox etc. Isso foi abandonado: o A4 gera um CSV e **uma
>    pessoa envia**. Os estados `Engatilhado`/`Descartado` viraram
>    `Aprovado`/`Rejeitado`, e existe `Na fila` entre aprovar e enviar.
>
> O resto (o desenho do funil, os critérios de gancho, as classes de resposta, os
> 5 benefícios, as regras de linguagem) continua valendo e é a razão de este
> arquivo ficar aqui.

Especificação para construir os agents do loop de Instagram.

- **O coletor A1 já existe. Não recriar, não refatorar, não alterar.** Ele grava as colunas A–J com `Status = Novo`.
- **Orçamento R$ 0,00.** Nenhuma API paga, assinatura ou trial com cartão. Se algo exigir pagamento, pare e pergunte.
- Planilha: `1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA` · aba **Página1** (`gid=0`).
- Acesso via Google Sheets API + service account (gratuita). A planilha é **co-editada ao vivo**: só `append` e `update` de célula específica. Nunca reescrever faixas, nunca reordenar colunas, nunca apagar linhas.

---

## 1. Esquema da Página1 (33 colunas, A → AG)

| Col | Cabeçalho | Escrita por |
|---|---|---|
| A | `Canal` | A1 ✓ |
| B | `Setor` | A1 ✓ |
| C | `Nome` | A1 ✓ |
| D | `@handle` | A1 ✓ |
| E | `Link do perfil` | A1 ✓ |
| F | `Seguidores` | A1 ✓ |
| G | `Nicho especifico` | A1 ✓ |
| H | `Contato` | A1 ✓ |
| I | `Data coleta` | A1 ✓ |
| J | `Link concurso ref` | A1 ✓ |
| K | `Status` | todos |
| L | `Data envio` | A4 |
| M | `Respondeu?` | A5 |
| N | `Topou fazer?` | A6 |
| O | `Divulgou?` | A6 |
| P | `Follow-up feito?` | A6 |
| Q | `Notas` | todos (append-only) |
| R | `Gancho` | **A2** |
| S | `Qualificado?` | A2 |
| T | `Motivo descarte` | A2 |
| U | `Data qualificacao` | A2 |
| V | `Mensagem (copia)` | **A3** |
| W | `Data engatilhado` | A3 |
| X | `Aprovado?` | **humano** |
| Y | `Data aprovacao` | humano / A4 |
| Z | `Resposta (texto)` | A5 |
| AA | `Classificacao resposta` | A5 |
| AB | `Data resposta` | A5 |
| AC | `Data follow-up` | A6 |
| AD | `Proxima acao` | A6 |
| AE | `Ultimo agent` | todos |
| AF | `Ultima atualizacao` | todos |
| AG | `Erro / Bloqueio` | todos |

---

## 2. O loop e a máquina de estados

> 🖼️ **Diagrama visual dos dois loops:** `ZAFE_diagrama_loops_agents.svg` (mesma pasta). Abra no navegador para ver o desenho completo, com o loop de Instagram e o de WhatsApp lado a lado.

### 2.1 O loop de ponta a ponta

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ A1 COLETOR   │──>│ A2 QUALIFIC. │──>│ A3 REDATOR   │──>│ PORTAO HUMANO│
 │ JA CRIADO ✓  │   │ abre perfil  │   │ deixa escrito│   │ VOCE aprova  │
 │ acha perfis  │   │ extrai       │   │ no DM, SEM   │   │ 1 clique =   │
 │ grava tabela │   │ o GANCHO     │   │ enviar       │   │ lote de 50   │
 │ → Novo       │   │ → Qualificado│   │ → Engatilhado│   │ → Aprovado   │
 └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
        ^                                                         │
        │                                                         v
        │           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │           │ A6 CLOSER    │<──│ A5 LEITOR    │<──│ A4 ENVIADOR  │
        │           │ follow-up 1x │   │ le e         │   │ aperta enviar│
        │           │ fecha        │   │ classifica   │   │ nos aprovados│
        │           │ parceria     │   │ a resposta   │   │              │
        │           │ → Topou      │   │ → Respondeu  │   │ → Enviado    │
        │           └──────────────┘   └──────────────┘   └──────────────┘
        │                  │
        │                  v
        │    ┌─────────────────────────────────────┐
        └────│ A7 ANALISTA — fecha o loop          │
  realimenta │ mede as taxas e diz onde buscar     │
   a busca   │ mais, e qual mensagem priorizar     │
             └─────────────────────────────────────┘
```

**Três coisas que este desenho comunica:**

1. **A tabela é o cérebro.** Nenhum agent guarda memória — o estado inteiro mora na coluna `Status`. Cada agent pega só as linhas do estado dele. Se um agent quebra, a linha fica parada onde está e o próximo a pega quando você rodar de novo; nada se perde.
2. **Redator ≠ Enviador.** O A3 abre a conversa e deixa a mensagem digitada na caixa, **sem enviar**. Quem aperta enviar é o A4. Isso existe para que a mensagem possa ser revisada no contexto real da conversa antes de sair.
3. **Você não clica 50 vezes.** Você libera o lote de uma vez; quem dispara nas 50 conversas é o A4.

### 2.2 Máquina de estados

```
Novo ──A2──> Qualificado ──A3──> Engatilhado ──humano──> Aprovado ──A4──> Enviado
                  │                    │                                     │
                  └──> Descartado      └──> Erro                             ├──A5──> Respondeu ──A6──> Topou
                                                                             │                       └──> Recusou
                                                                             └──A5──> Sem resposta ──A6──> Follow-up enviado ──A5──> …
```

**Enum de `Status` (K) — gravar exatamente assim:**
`Novo` · `Qualificado` · `Descartado` · `Engatilhado` · `Aprovado` · `Enviado` · `Respondeu` · `Sem resposta` · `Follow-up enviado` · `Topou` · `Recusou` · `Erro`

**Enum de `Classificacao resposta` (AA):**
`Interessado` · `Pediu info` · `Recusou` · `Fora de escopo` · `Resposta ambigua`

**Campos Sim/Não (M, N, O, P, S, X):** exatamente `Sim` ou `Nao`. Nunca `sim`, `SIM`, `yes`, `true`, `✓`.

### Regras invioláveis para todos os agents

1. **Idempotência.** Reler o `Status` da linha imediatamente antes de agir. Se mudou desde a leitura do lote (co-edição), pular a linha.
2. **Escopo de escrita.** Só as colunas atribuídas ao agent + `K`, `AE`, `AF`. Não tocar em coluna de outro agent.
3. **`Notas` (Q) é append-only:** `novo_valor = antigo + " | " + texto`.
4. **Rastro:** toda escrita atualiza `AE` (ex.: `A2-Qualificador`) e `AF` (`DD/MM/AAAA HH:MM`).
5. **Falha isolada:** grava motivo em `AG`, `Status = Erro`, **continua** para a próxima linha. Nunca abortar o lote.
6. **Nunca inventar dado.** Não obteve → vazio ou `verificar`.
7. **CLI obrigatório em todos:** `--limit N` (default 50), `--dry-run`, `--verbose`.
8. **`--dry-run` não escreve nada e não abre nenhuma conversa.**
9. **Lista de supressão:** quem está em `Recusou` nunca é contactado de novo, por nenhum agent.

---

## 3. Regras de linguagem (valem para A3 e A6)

**Proibido em qualquer texto gerado, nota ou log:**
`aposta` · `apostar` · `odds` · `cassino` · `bet` · `depósito` · `saque` · `banca` · `tip`

**Usar:** `fantasy game` · `competição de habilidade` · `liga de previsões` · `moeda virtual Z$` · `concurso` · `prêmio em PIX`

---

## 4. A2 · QUALIFICADOR

**Arquivo:** `agents/a2_qualificador.py` · **Subagent:** `.claude/agents/a2-qualificador.md`

O agent mais importante do loop. Ele produz o **`Gancho`** — a frase de personalização. Sem gancho bom, tudo depois vira spam genérico e a campanha morre.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Novo` |
| **Lê** | D `@handle`, E `Link do perfil`, F `Seguidores`, G `Nicho especifico` |
| **Escreve** | R `Gancho`, S `Qualificado?`, T `Motivo descarte`, U `Data qualificacao`, K `Status` |
| **Saída de status** | `Qualificado` ou `Descartado` (ou `Erro`) |

### Config

```yaml
a2:
  seguidores_min: 500
  seguidores_max: 10000
  dias_inatividade_max: 30
  posts_para_analisar: 5
  delay_entre_perfis_seg: [3, 8]   # aleatório no intervalo
```

### Algoritmo

1. **Abrir** `Link do perfil` (leitura de página pública).
2. **Reconferir seguidores.** O valor do coletor pode estar velho.
   - Fora de `[500, 10000]` → descartar. `Motivo descarte` = `N seguidores - fora da faixa`.
   - Atualizar F com o valor novo (esta é a única exceção em que A2 escreve numa coluna do coletor — porque é o mesmo dado, corrigido).
3. **Conta viva?** Data do post mais recente. Se > `dias_inatividade_max` → descartar, `Motivo descarte` = `inativo desde MM/AAAA`.
4. **Brasil / PT-BR?** Avaliar idioma das legendas. Se não for PT-BR → descartar, motivo `fora do Brasil / idioma`.
5. **EXTRAIR O GANCHO** — entregável central. Ler os `posts_para_analisar` posts mais recentes e escrever **uma frase curta, concreta, verificável** sobre o que ele publica.

   | | Exemplo |
   |---|---|
   | ✅ Bom | `análise da escalação do Palmeiras pra rodada` |
   | ✅ Bom | `vídeo comparando o meta do EA FC 26` |
   | ✅ Bom | `série de posts sobre o card do UFC de sábado` |
   | ✅ Bom | `thread explicando por que o Arsenal caiu de rendimento` |
   | ❌ Ruim | `fala de futebol` |
   | ❌ Ruim | `conteúdo legal sobre esporte` |
   | ❌ Ruim | `perfil de e-sports` |

   **Critérios de gancho válido:** 4 a 100 caracteres; contém pelo menos um substantivo específico (time, jogo, campeonato, atleta, formato de conteúdo); um leitor tem que conseguir dizer *"essa pessoa viu meu conteúdo"*.

   Se não conseguir extrair gancho válido → `Qualificado?` = `Nao`, motivo `sem gancho extraivel`, `Status = Descartado`.
6. **Gravar:** `Qualificado?`, `Motivo descarte` (se reprovado), `Gancho`, `Data qualificacao` = hoje, `Status`, `Ultimo agent`, `Ultima atualizacao`.
7. **Esperar** `delay_entre_perfis_seg` aleatório antes do próximo perfil.

### Casos de borda

| Situação | Ação |
|---|---|
| Perfil virou privado | `Status = Descartado`, motivo `perfil privado` |
| Perfil não existe / 404 | `Status = Descartado`, motivo `perfil inexistente` |
| Página não carregou (rede) | `Status = Erro`, `AG = falha ao carregar`, tentar de novo na próxima rodada |
| Seguidores ilegíveis | `Status = Erro`, `AG = contagem ilegivel` |
| Bio em branco mas posts bons | seguir normalmente — o gancho vem dos posts |

### Guardrails

Apenas **leitura**. Não seguir, não curtir, não comentar, não salvar, não mandar mensagem, não ver stories logado de forma que gere notificação.

### Pseudocódigo

```python
for row in sheet.rows(status="Novo", limit=args.limit):
    if sheet.reread_status(row) != "Novo":
        continue
    try:
        p = browser.open_profile(row["Link do perfil"])
        seg = p.followers()
        if not (CFG.min <= seg <= CFG.max):
            return discard(row, f"{seg} seguidores - fora da faixa")
        if p.days_since_last_post() > CFG.dias:
            return discard(row, f"inativo desde {p.last_post_month()}")
        if not p.is_ptbr():
            return discard(row, "fora do Brasil / idioma")
        hook = p.extract_hook(n=CFG.posts)
        if not valid_hook(hook):
            return discard(row, "sem gancho extraivel")
        sheet.update(row, {
            "Seguidores": seg, "Gancho": hook, "Qualificado?": "Sim",
            "Data qualificacao": today(), "Status": "Qualificado",
            "Ultimo agent": "A2-Qualificador", "Ultima atualizacao": now(),
        })
    except Exception as e:
        sheet.update(row, {"Status": "Erro", "Erro / Bloqueio": str(e)[:200], ...})
    sleep(random.uniform(*CFG.delay))
```

### Teste de aceite

- Perfil com 15k seguidores → `Descartado`, motivo cita o número.
- Perfil inativo há 3 meses → `Descartado`, motivo cita o mês.
- Perfil bom → `Qualificado` com `Gancho` específico e não genérico.
- Rodar 2x seguidas → segunda rodada não reprocessa nada.

---

## 5. A3 · REDATOR

**Arquivo:** `agents/a3_redator.py`

Deixa a mensagem **digitada dentro da caixa do DM, sem enviar**. Ele engatilha; o A4 dispara.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Qualificado` |
| **Lê** | C `Nome`, D `@handle`, G `Nicho especifico`, R `Gancho` |
| **Escreve** | V `Mensagem (copia)`, W `Data engatilhado`, K `Status` |
| **Saída** | `Engatilhado` (ou `Erro`) |

### Tom (obrigatório)

- **Suave e informal**, PT-BR de conversa. Minúsculas no início de frase são bem-vindas. Nada de "Prezado" ou "Venho por meio desta".
- **Sem pressão nem urgência.** Proibido "últimas vagas", "só hoje", "não perca". Se ele não quiser, tudo bem — a mensagem deve soar assim.
- **O eixo é a MARCA DELE.** A proposta existe para ajudar ele a **construir o nome dele como influenciador**. A Zafe é o meio; ele é o protagonista. Não é pedir favor.
- **Curta:** 4 a 6 linhas.
- **Termina em pergunta de baixo compromisso.**
- **Máximo 1 emoji**, e só se cair natural.
- **Sem link** e **sem mencionar a taxa de R$ 20** — os dois entram depois, na resposta (A6).

### Variações (implementar em `lib/copy.py`, alternar entre elas)

**V1 — direta**
```
fala [NOME], tudo certo?
vi teu [GANCHO], curti demais como tu destrincha isso
to ajudando a montar a Zafe, um fantasy game de esporte e e-sports — tipo Cartola,
pegando mais modalidade. 100% legal, sem aposta, moeda virtual
te chamaria como Parceiro Fundador: parceiro oficial da plataforma, uma liga com o teu
nome pra tua galera competir, e a gente te divulga de volta
é pra somar no teu nome, nao é favor. sem custo. posso te explicar em 2 min?
```

**V2 — comunidade**
```
opa [NOME], beleza?
teu [GANCHO] me chamou atencao
to ajudando a lancar a Zafe (fantasy game de esporte e e-sports, tipo Cartola, sem
aposta nenhuma) e pensei em ti
a ideia é montar uma liga com o teu nome, onde a tua galera compete entre si — vira
conteudo recorrente pra ti e te posiciona como quem puxa a comunidade
zero custo, e a gente te divulga de volta. faz sentido pra ti?
```

**V3 — autoridade**
```
[NOME], tudo bem?
acompanhei teu [GANCHO] e achei muito bem feito
to ajudando a construir a Zafe — fantasy game de esporte e e-sports, 100% legal
(fantasy sport, nao é casa de aposta)
queria te dar o selo de Parceiro Fundador. na pratica tu vira parceiro oficial, o que
ajuda a te firmar como criador serio do nicho, e nao só mais um perfil de palpite
te mando os detalhes?
```

**V4 — curta**
```
fala [NOME]!
vi teu [GANCHO] e curti o conteudo
to ajudando a montar a Zafe, fantasy game de esporte e e-sports (sem aposta, tipo
Cartola). queria te chamar como Parceiro Fundador — liga com o teu nome, a gente te
divulga de volta, e sem custo pra ti
é mais pra construir teu nome junto com a gente. quer que eu te explique?
```

**Rotação:** distribuir as 4 variações de forma equilibrada no lote (round-robin), e gravar em `Notas` qual variação foi usada (ex.: `variacao=V2`) — o A7 usa isso para medir qual converte melhor.

### Validador de mensagem (falha ⇒ `Status = Erro`)

Implementar em `lib/copy.py`; roda antes de digitar qualquer coisa:

1. `[GANCHO]` e `[NOME]` substituídos (nenhum placeholder sobrando).
2. Nenhuma palavra do vocabulário proibido.
3. Nenhuma URL.
4. Não contém `R$ 20`, `taxa`, `inscrição`.
5. Contém pelo menos uma expressão de benefício de marca: `teu nome`, `tua marca`, `te posiciona`, `te divulga`, `te firmar`.
6. Entre 200 e 600 caracteres.
7. Termina com `?`.
8. `Nome` não é vazio nem igual ao `@handle` cru (se for, usar saudação neutra sem nome).

### Algoritmo

1. **Se `Gancho` (R) vazio ou inválido → não escrever.** `AG = sem gancho utilizavel`, `Status = Erro`, próxima linha. Jamais compensar com elogio vago.
2. Escolher variação (round-robin) e renderizar com `Nome` e `Gancho`.
3. Rodar o validador. Falhou → `Status = Erro`, `AG` = qual regra falhou.
4. Abrir a conversa de DM do `@handle`.
5. **Digitar o texto na caixa de mensagem.**
6. ⚠️ **NUNCA pressionar Enter.** O cursor está numa caixa de DM real; um Enter envia sem aprovação. Digitar com `type()` sem newline. Sair da conversa **clicando fora** — nunca com Enter, nunca com Tab.
7. Gravar `Mensagem (copia)` (V) = texto integral. **Isso é cópia de segurança:** o rascunho na caixa do Instagram **não persiste de forma confiável** (recarregar ou trocar de aba pode apagar). O A4 reescreve a partir daqui se sumir.
8. `Data engatilhado` = agora, `Status = Engatilhado`.
9. **Marcar prioridade de revisão:** se o `Gancho` for curto (< 20 caracteres) ou o perfil tiver poucos posts recentes, anexar em `Notas` `revisar-primeiro`. O portão humano usa isso para ordenar.

### Casos de borda

| Situação | Ação |
|---|---|
| DM fechada / não aceita mensagem de quem não segue | `Status = Erro`, `AG = DM fechada` |
| Conta bloqueou / desapareceu | `Status = Descartado`, motivo `conta indisponivel` |
| Caixa de mensagem não encontrada no DOM | `Status = Erro`, `AG = caixa nao encontrada` |
| Já existe conversa anterior com essa conta | não engatilhar; `Status = Erro`, `AG = conversa ja existente - revisar` |
| Enter disparado por acidente | tratar como enviado: `Status = Enviado`, `Data envio` = agora, e anexar em `Notas`: `ENVIADO SEM APROVACAO - revisar` |

---

## 6. ✋ PORTÃO HUMANO — aprovação em lote

Não é agent. É você. É o único ponto em que um humano olha antes de algo sair no nome da Zafe.

1. O A3 acumula linhas em `Status = Engatilhado` até formar o lote (default 50).
2. Você filtra a Página1 por `Status = Engatilhado` e lê a coluna `Mensagem (copia)` (V).
3. Você preenche `Aprovado?` (X) = `Sim` para o lote **de uma vez** — selecionar a faixa e arrastar. **Não é aprovar uma por uma.**
4. Quem abre as 50 conversas e aperta enviar é o **A4**, não você.
5. Linha em branco ou `Nao` em X **não é enviada**; fica para o próximo lote.
6. Rascunhos marcados `revisar-primeiro` em `Notas` aparecem no topo — bata o olho neles antes de liberar o resto.

O `run_loop.py` **para** ao chegar em `Engatilhado` e imprime quantas linhas aguardam aprovação. Ele não segue para o A4 sozinho.

---

## 7. A4 · ENVIADOR

**Arquivo:** `agents/a4_enviador.py`

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Engatilhado` **E** `Aprovado?` = `Sim` |
| **Lê** | D `@handle`, V `Mensagem (copia)`, X `Aprovado?` |
| **Escreve** | L `Data envio`, Y `Data aprovacao` (se vazia), K `Status` |
| **Saída** | `Enviado` (ou `Erro`) |

### Config

```yaml
a4:
  delay_entre_envios_seg: [45, 120]   # aleatório
  daily_cap: 40                        # teto por dia por conta
  pausa_a_cada: 10                     # a cada 10 envios, pausa maior
  pausa_longa_seg: [300, 600]
```

### Algoritmo

1. **Trava dupla.** Só prosseguir se `Status = Engatilhado` **E** `Aprovado? = Sim`. Faltando qualquer uma → pular. Esta é a trava que impede envio não aprovado; ela nunca pode ser contornada por flag de CLI.
2. Checar `daily_cap` já consumido hoje (contar linhas com `Data envio` = hoje). Atingiu → encerrar a rodada com log claro.
3. Abrir a conversa do `@handle`.
4. **O rascunho ainda está na caixa?**
   - Sim → seguir.
   - Não (comum no Instagram) → reescrever a partir de `Mensagem (copia)`.
5. **Comparar** o texto na caixa com `Mensagem (copia)`. Divergiu → **usar a versão da coluna**, que é a aprovada. Nunca enviar texto diferente do aprovado.
6. **Enviar.**
7. `Data envio` = agora, `Status = Enviado`, `Data aprovacao` = hoje se estava vazia.
8. Esperar `delay_entre_envios_seg`. A cada `pausa_a_cada` envios, esperar `pausa_longa_seg`.
   *Por quê:* rajada de mensagens é o padrão que o Instagram usa para detectar automação — o bloqueio derruba a conta e a campanha inteira. O ritmo é o que mantém a operação viva.
9. **Detecção de bloqueio:** se aparecer aviso de "ação bloqueada", limite atingido, ou a mensagem não sair, **parar a rodada imediatamente**, gravar `AG = bloqueio da plataforma` nas linhas pendentes e avisar no log. Não insistir.

### Casos de borda

| Situação | Ação |
|---|---|
| Rascunho sumiu e `Mensagem (copia)` vazia | `Status = Erro`, `AG = rascunho perdido e sem copia` — nunca improvisar texto novo |
| Conta bloqueou você | `Status = Descartado`, motivo `bloqueado pelo usuario` |
| Botão de enviar não responde | 1 retry; persistindo → `Status = Erro` |
| Linha aprovada mas o criador já respondeu antes | não reenviar; `Status = Respondeu` e deixar para o A5 |

---

## 8. A5 · LEITOR DE RESPOSTAS

**Arquivo:** `agents/a5_leitor.py`

Não marca só "respondeu" — **classifica**.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Enviado` ou `Follow-up enviado` |
| **Lê** | D `@handle`, L `Data envio`, AC `Data follow-up` |
| **Escreve** | M `Respondeu?`, Z `Resposta (texto)`, AA `Classificacao resposta`, AB `Data resposta`, K `Status` |

### Config

```yaml
a5:
  dias_para_sem_resposta: 4
  dias_para_encerrar_apos_followup: 7
  max_caracteres_resposta: 500
```

### Algoritmo

1. Varrer a caixa de entrada e cruzar cada conversa com os `@handle` em `Enviado` / `Follow-up enviado`.
2. **Houve resposta do criador?**
   - `Respondeu?` = `Sim`
   - `Resposta (texto)` = transcrição, truncada em `max_caracteres_resposta`
   - `Data resposta` = data da resposta
   - `Classificacao resposta`, conforme:

   | Classe | Sinais |
   |---|---|
   | `Interessado` | "bora", "topo", "gostei", "manda", "vamos" — vontade clara |
   | `Pediu info` | "como funciona?", "me explica", "que plataforma?" — quer entender antes |
   | `Recusou` | "não tenho interesse", "não trabalho assim", "para de mandar" |
   | `Fora de escopo` | respondeu outro assunto, não entendeu, ou **pediu pagamento/cachê** |
   | `Resposta ambigua` | "hmm", "vou ver", emoji solto — não dá para classificar |

   - `Status = Respondeu`
3. **Sem resposta** e passaram > `dias_para_sem_resposta` desde `Data envio` → `Status = Sem resposta`.
4. **Já em `Follow-up enviado`** e passaram > `dias_para_encerrar_apos_followup` sem resposta → `Status = Recusou`, `Proxima acao = encerrado sem resposta`.
5. **Pediu explicitamente para parar** ("não me manda mais", denúncia, xingamento) → `Status = Recusou`, anexar em `Notas`: `SUPRESSAO - nao contactar`. Nenhum agent volta a tocar nessa linha. Respeitar isso é obrigatório, não opcional.

### Casos de borda

| Situação | Ação |
|---|---|
| Resposta é só reação (curtida no DM) | `Classificacao = Resposta ambigua`, `Status = Respondeu` |
| Resposta em áudio | `Resposta (texto)` = `[audio - revisar manualmente]`, `Classificacao = Resposta ambigua` |
| Mensagem não foi entregue / usuário sumiu | `Status = Descartado`, motivo `conta indisponivel` |
| Respondeu depois de já ter recebido follow-up | tratar normalmente como `Respondeu` |

---

## 9. A6 · CLOSER

**Arquivo:** `agents/a6_closer.py`

Onde a conversão acontece.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Respondeu` ou `Status = Sem resposta`, e periodicamente `Status = Topou` |
| **Lê** | C `Nome`, D `@handle`, J `Link concurso ref`, Z `Resposta (texto)`, AA `Classificacao resposta` |
| **Escreve** | N `Topou fazer?`, O `Divulgou?`, P `Follow-up feito?`, AC `Data follow-up`, AD `Proxima acao`, K `Status` |

### Ramo 1 — `Status = Respondeu`

| `Classificacao resposta` | Ação | Status final |
|---|---|---|
| `Pediu info` | Responder com os 5 benefícios do Parceiro Fundador + funil explicado com honestidade (**incluindo a taxa de R$ 20 do Concurso**) + enquadramento legal (fantasy sport, Art. 49 da Lei 14.790/2023). | segue `Respondeu`, `Proxima acao = aguardando decisao` |
| `Interessado` | `Topou fazer?` = `Sim`. Mandar o `Link concurso ref` dele, combinar material/artes, e **orientar a marcar o post como publi/parceria (CONAR)**. | `Topou`, `Proxima acao = aguardando post` |
| `Recusou` | `Topou fazer?` = `Nao`. Agradecer curto e educado. Adicionar à supressão. | `Recusou` |
| `Fora de escopo` | Esclarecer **uma vez**. Se pediu cachê, explicar que o programa é parceria sem pagamento — sem tentar convencer à força. | `Proxima acao = avaliar manualmente` |
| `Resposta ambigua` | **Não improvisar.** Deixar para humano. | `Proxima acao = revisar manualmente` |

**Os 5 benefícios (usar na resposta de `Pediu info`):**
1. Selo oficial de Parceiro Fundador — autoridade, chegou antes de todos.
2. Liga com o nome dele — a audiência compete entre si; vira conteúdo recorrente e o posiciona como líder de comunidade.
3. Cross-promo — a Zafe divulga ele de volta nas redes e no app.
4. Conteúdo e artes prontas — posts mais profissionais com esforço zero.
5. Ele entrega valor real à audiência — leva um concurso com R$ 20 mil em PIX.

⚠️ **Nunca esconder a taxa de R$ 20.** Se o criador vai indicar isso para a audiência dele, ele precisa saber exatamente o que está indicando. Omitir queima a confiança dele e a da Zafe.

### Ramo 2 — `Status = Sem resposta`

1. Enviar **UM ÚNICO** follow-up, curto e leve:
   `opa [NOME], só voltando aqui rapidinho — topa dar uma olhada? se nao fizer sentido pra ti, sem problema 🙂`
2. `Follow-up feito?` = `Sim`, `Data follow-up` = hoje, `Status = Follow-up enviado`.
3. **Nunca um segundo follow-up.** Se já está `Follow-up enviado`, o A6 ignora a linha — quem encerra é o A5 (seção 8, passo 4). Insistir além de um lembrete é assédio e gera denúncia.

### Ramo 3 — acompanhar quem topou

Para linhas em `Topou`, checar periodicamente o perfil: o criador publicou algo mencionando a Zafe?
- Sim → `Divulgou?` = `Sim`, `Proxima acao = divulgou`.
- Passaram > 14 dias sem post → `Proxima acao = cobrar gentilmente 1x`.

Essa é a métrica que separa "disse que ia" de "fez".

---

## 10. A7 · ANALISTA — fecha o loop

**Arquivo:** `agents/a7_analista.py` · roda manual ou agendado (semanal)

Transforma o pipeline linear em **loop**: realimenta o coletor com o que está funcionando.
**Lê tudo. Escreve um relatório Markdown. Não altera nenhuma linha de lead.**

### Métricas

| Métrica | Fórmula |
|---|---|
| Taxa de qualificação | `Qualificado` ÷ total coletado |
| Taxa de resposta | `Respondeu?=Sim` ÷ `Enviado` |
| Taxa de aceite | `Topou` ÷ `Respondeu` |
| Taxa de execução | `Divulgou?=Sim` ÷ `Topou` |
| Motivos de descarte | contagem agrupada de `Motivo descarte` |
| Por nicho | todas as taxas acima quebradas por `Setor` |
| Por variação de mensagem | taxa de resposta por `variacao=` em `Notas` |
| Faixa de seguidores | taxa de resposta por faixa (500–2k, 2k–5k, 5k–10k) |
| Erros | contagem agrupada de `Erro / Bloqueio` |

### Saída acionável (obrigatória)

O relatório tem que recomendar **explicitamente**:
1. Qual `Setor` converte mais → onde o coletor deve buscar mais.
2. Qual variação de mensagem tem melhor taxa de resposta → qual o A3 deve priorizar.
3. Qual faixa de seguidores responde mais → ajustar o filtro do coletor.
4. Se o `Motivo descarte` dominante indica filtro errado no coletor (ex.: 60% caindo por "fora da faixa" ⇒ o coletor está buscando na faixa errada).
5. Se algum `Erro / Bloqueio` está repetindo ⇒ bug a corrigir.

---

## 11. Estrutura e entregáveis

```
/agents
  a2_qualificador.py   a3_redator.py   a4_enviador.py
  a5_leitor.py         a6_closer.py    a7_analista.py
/lib
  sheets.py     # ler, append, update de célula; reread_status()
  status.py     # enums + validação de valores
  copy.py       # 4 variações + validador de mensagem + rotação
  browser.py    # Playwright: abrir perfil, abrir DM, digitar SEM Enter, enviar
  supressao.py  # lista de quem nunca deve ser contactado
  log.py        # Ultimo agent / Ultima atualizacao / Erro
/config
  settings.example.yaml
run_loop.py     # orquestra A2→A3, PARA no portão humano, depois A4→A5→A6
README.md
.claude/agents/*.md
```

**README deve cobrir:** criar service account (gratuita), **compartilhar a planilha com o e-mail da service account**, instalar Playwright, login manual nas contas (o agent nunca digita senha), como rodar cada agent, ordem recomendada.

---

## 12. Critérios de aceite

- [ ] Cada agent pega só as linhas do `Status` dele e não escreve em coluna de outro agent.
- [ ] Rodar qualquer agent 2x não duplica trabalho nem reenvia mensagem.
- [ ] `--dry-run` em todos: não escreve nada, não abre conversa.
- [ ] **Linha `Engatilhado` sem `Aprovado?=Sim` é ignorada pelo A4.** Testar explicitamente.
- [ ] O A3 nunca pressiona Enter na caixa de mensagem.
- [ ] Toda mensagem cita o gancho real, fala da **marca do criador**, não tem link, não tem palavra proibida, não menciona R$ 20.
- [ ] Linha sem `Gancho` vira `Erro`, nunca mensagem genérica.
- [ ] Quem `Recusou` ou pediu para parar nunca é contactado de novo.
- [ ] Ninguém recebe mais de **um** follow-up.
- [ ] Erro numa linha não aborta o lote; fica em `Erro / Bloqueio`.
- [ ] A4 para sozinho ao detectar bloqueio da plataforma.
- [ ] A7 gera relatório com taxas + recomendações explícitas.
- [ ] Custo total R$ 0,00.

## 13. Ordem de construção

1. `lib/sheets.py` + `lib/status.py` — testar leitura/escrita em 1 linha.
2. **A2** — destrava tudo (produz o `Gancho`).
3. **A3** + `lib/copy.py` — **mostrar 3 mensagens prontas para revisão antes de engatilhar em massa.**
4. **A4** com a trava de aprovação — testar com `--limit 2`.
5. **A5** → **A6**.
6. **A7** por último.

Peça revisão antes de rodar, pela primeira vez, qualquer agent que **envie** mensagem.
