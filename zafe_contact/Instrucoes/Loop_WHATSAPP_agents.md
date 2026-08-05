# SPEC — LOOP WHATSAPP · agents W2 → W6

> ⚠️ **DOCUMENTO HISTÓRICO — parcialmente desatualizado (25/07/2026).**
> Os agents que valem hoje são os markdown em `zafe_contact/Agents/Whats/`.
> Cinco coisas mudaram desde que este spec foi escrito:
>
> 1. **A Página2 tem 7 colunas, não 28** — Setor, Nome do Grupo, Link do Grupo,
>    Categoria/Nicho, Data coleta, Status, Notas. Todo o resto mora dentro de
>    `Notas` como `chave=valor`.
> 2. **A autorização do admin saiu do loop.** O spec inteiro é construído em cima
>    de "mandar DM pro admin pedindo licença". Hoje **quem consegue a autorização é
>    a pessoa, por fora**, e depois avisa no chat quais linhas estão liberadas
>    (`autorizado=Sim` em `Notas`). Não existe mais DM pro admin, nem o validador
>    que exigia a `LICENSE_PHRASE`, nem o follow-up 1-a-1.
> 3. **A mensagem vai DENTRO do grupo.** Como não é mais abordagem fria, a copy
>    fala com a galera (não com o admin), menciona que o admin liberou, e **leva o
>    link** `https://zafe.app.br/login`. O W5/W6 viraram acompanhamento: registram
>    a reação do grupo e se valeu a pena, não classificam resposta de admin.
> 4. **A seção 9 manda "nunca esconder a taxa de R$ 20". Isso se inverteu:** o
>    Concurso está desligado (`NEXT_PUBLIC_CONCURSO_ENABLED=false`, sem CNPJ nem
>    PIX), então a copy **não pode mencionar** Concurso, R$ 20 ou prêmio em
>    dinheiro.
> 5. **Não há automação de navegador.** O W4 gera um CSV e **uma pessoa posta**.
>    Os estados `Engatilhado`/`Descartado` viraram `Aprovado`/`Rejeitado`, com
>    `Na fila` entre aprovar e postar. O teto passou de 15 para 20/dia, porque o
>    risco deixou de ser "mensagem para desconhecido" e virou "link em grupo".
>
> O que continua valendo: volume muito menor que o Instagram, ritmo lento, e a
> regra de que **nada é postado em grupo sem autorização** — o que mudou é só
> *como* essa autorização é obtida.

Especificação para construir os agents do loop de WhatsApp.

- **O coletor W1 já existe. Não recriar, não refatorar, não alterar.** Ele grava as colunas A–E com `Status = Nao enviado`.
- **Orçamento R$ 0,00.** Nenhuma API paga, assinatura ou trial com cartão. Se algo exigir pagamento, pare e pergunte.
- Planilha: `1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA` · aba **Página2** (`gid=2099491059`).
- Acesso via Google Sheets API + service account (gratuita). A planilha é **co-editada ao vivo**: só `append` e `update` de célula específica.
- Automação via **WhatsApp Web** (`web.whatsapp.com`) já logado. O agent **nunca** digita senha nem escaneia QR — o login é manual, feito por você.

---

## 0. As 3 diferenças que definem este loop

Este loop **não é uma cópia** do de Instagram. Três coisas mudam a arquitetura:

**1. O alvo é o ADMIN do grupo, não o grupo.**
Entrar num grupo e despejar propaganda é a via mais rápida de ser removido, denunciado e ter o número derrubado. O W3 escreve **pedindo licença ao administrador**. Só depois de autorização é que qualquer coisa vai para o grupo — e é o admin quem posta, não a Zafe.

**2. Volume muito menor que o Instagram.**
O WhatsApp bane bem mais rápido, sobretudo número novo mandando mensagem para desconhecido. Teto diário conservador, intervalos longos. É melhor 10 admins por dia por meses do que 100 num dia e o número morto na semana seguinte.

**3. O rascunho persiste bem.**
Ao contrário do Instagram, o WhatsApp Web **guarda o rascunho por conversa de forma confiável** (mostra indicador de rascunho na lista de conversas). Isso torna o modelo "engatilhar e depois disparar" muito mais seguro aqui. Ainda assim, grave a cópia em `Mensagem (copia)`.

---

## 1. Esquema da Página2 (28 colunas, A → AB)

| Col | Cabeçalho | Escrita por |
|---|---|---|
| A | `Setor` | W1 ✓ |
| B | `Nome do Grupo` | W1 ✓ |
| C | `Link do Grupo` | W1 ✓ |
| D | `Categoria/Nicho` | W1 ✓ |
| E | `Data coleta` | W1 ✓ |
| F | `Status` | todos |
| G | `Notas` | todos (append-only) |
| H | `Gancho` | **W2** |
| I | `Validado?` | W2 |
| J | `Motivo descarte` | W2 |
| K | `Data qualificacao` | W2 |
| L | `Mensagem (copia)` | **W3** |
| M | `Data engatilhado` | W3 |
| N | `Aprovado?` | **humano** |
| O | `Data aprovacao` | humano / W4 |
| P | `Data envio` | W4 |
| Q | `Respondeu?` | W5 |
| R | `Resposta (texto)` | W5 |
| S | `Classificacao resposta` | W5 |
| T | `Data resposta` | W5 |
| U | `Topou fazer?` | W6 |
| V | `Divulgou?` | W6 |
| W | `Follow-up feito?` | W6 |
| X | `Data follow-up` | W6 |
| Y | `Proxima acao` | W6 |
| Z | `Ultimo agent` | todos |
| AA | `Ultima atualizacao` | todos |
| AB | `Erro / Bloqueio` | todos |

⚠️ **Falta a coluna de contato do admin.** O W1 grava só o link do grupo. O W2 precisa gravar o número/contato do admin que descobrir — use `Notas` (G) no formato `admin=+55...` até que uma coluna dedicada exista. Se preferir, crie a coluna `AC = Contato admin` (append no fim, nunca inserir no meio) e documente isso no README.

---

## 2. O loop e a máquina de estados

> 🖼️ **Diagrama visual dos dois loops:** `ZAFE_diagrama_loops_agents.svg` (mesma pasta). Abra no navegador para ver o desenho completo, com o loop de WhatsApp e o de Instagram lado a lado.

### 2.1 O loop de ponta a ponta

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ W1 COLETOR   │──>│ W2 VALIDADOR │──>│ W3 REDATOR   │──>│ PORTAO HUMANO│
 │ JA CRIADO ✓  │   │ link vivo?   │   │ escreve p/ o │   │ VOCE aprova  │
 │ acha grupos  │   │ acha o ADMIN │   │ ADMIN, SEM   │   │ 1 clique =   │
 │ grava tabela │   │ + gancho     │   │ enviar       │   │ o lote todo  │
 │ → Nao enviado│   │ → Qualificado│   │ → Engatilhado│   │ → Aprovado   │
 └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
        ^                                                         │
        │                                                         v
        │           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │           │ W6 CLOSER    │<──│ W5 LEITOR    │<──│ W4 ENVIADOR  │
        │           │ follow-up 1x │   │ le e         │   │ aperta enviar│
        │           │ combina a    │   │ classifica   │   │ devagar,     │
        │           │ liga do grupo│   │ a resposta   │   │ max 15/dia   │
        │           │ → Topou      │   │ → Respondeu  │   │ → Enviado    │
        │           └──────────────┘   └──────────────┘   └──────────────┘
        │                  │
        │                  v
        │    ┌─────────────────────────────────────┐
        └────│ A7 ANALISTA — o mesmo dos 2 loops   │
  realimenta │ compara Instagram vs WhatsApp e     │
   a busca   │ diz onde vale dobrar o esforco      │
             └─────────────────────────────────────┘
```

**O que este desenho comunica, e que é específico deste loop:**

1. **O W2 tem duas missões que o A2 do Instagram não tem:** confirmar que o link de convite ainda está vivo (expiram muito) e **descobrir quem é o admin**. Sem admin identificado, a linha não avança — não há a quem pedir licença.
2. **A mensagem vai para o ADMIN, nunca para o grupo.** O W3 escreve no privado do administrador pedindo autorização. Nada é postado dentro de grupo sem o admin liberar — e quando liberar, é ele quem posta.
3. **Teto de 15 envios por dia**, contra 40 do Instagram. Número queimado no WhatsApp significa recomeçar com outro número; o ritmo baixo é o que mantém a operação viva.
4. **A tabela é o cérebro.** Nenhum agent guarda memória; o estado mora na coluna `Status`. Se um agent quebra, a linha fica parada e o próximo a pega na rodada seguinte.

### 2.2 Máquina de estados

```
Nao enviado / Novo ──W2──> Qualificado ──W3──> Engatilhado ──humano──> Aprovado ──W4──> Enviado
                                │                  │                                       │
                                └──> Descartado     └──> Erro                              ├──W5──> Respondeu ──W6──> Topou
                                                                                           │                       └──> Recusou
                                                                                           └──W5──> Sem resposta ──W6──> Follow-up enviado
```

⚠️ **O coletor W1 grava `Nao enviado`, não `Novo`.** O W2 tem que aceitar **os dois** valores como entrada e normalizar para o enum abaixo. Se não fizer isso, o pipeline nunca engata.

**Enum de `Status` (F):**
`Nao enviado` (legado do coletor) · `Novo` · `Qualificado` · `Descartado` · `Engatilhado` · `Aprovado` · `Enviado` · `Respondeu` · `Sem resposta` · `Follow-up enviado` · `Topou` · `Recusou` · `Erro`

**Enum de `Classificacao resposta` (S):**
`Interessado` · `Pediu info` · `Recusou` · `Fora de escopo` · `Resposta ambigua`

**Campos Sim/Não (I, N, Q, U, V, W):** exatamente `Sim` ou `Nao`.

### Regras invioláveis

1. **Idempotência.** Reler `Status` imediatamente antes de agir; se mudou (co-edição), pular.
2. **Escopo de escrita.** Só as colunas do agent + `F`, `Z`, `AA`.
3. **`Notas` (G) é append-only.**
4. **Rastro:** `Z` = nome do agent (ex.: `W2-Validador`), `AA` = `DD/MM/AAAA HH:MM`.
5. **Falha isolada:** motivo em `AB`, `Status = Erro`, continua para a próxima.
6. **Nunca inventar dado.**
7. **CLI:** `--limit N` (default 50), `--dry-run`, `--verbose`, `--delay`, `--daily-cap`.
8. **Supressão:** quem está em `Recusou` nunca é contactado de novo.

---

## 3. Regras de linguagem (W3 e W6)

**Proibido:** `aposta` · `apostar` · `odds` · `cassino` · `bet` · `depósito` · `saque` · `banca` · `tip`
**Usar:** `fantasy game` · `competição de habilidade` · `liga de previsões` · `moeda virtual Z$` · `concurso` · `prêmio em PIX`

---

## 4. W2 · VALIDADOR

**Arquivo:** `agents/w2_validador.py`

Tem duas missões que o A2 do Instagram não tem: confirmar que **o link ainda funciona** (links de convite de WhatsApp expiram muito) e **descobrir quem é o admin**.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Nao enviado` **ou** `Novo` |
| **Lê** | B `Nome do Grupo`, C `Link do Grupo`, D `Categoria/Nicho` |
| **Escreve** | H `Gancho`, I `Validado?`, J `Motivo descarte`, K `Data qualificacao`, G `Notas` (contato do admin), F `Status` |
| **Saída** | `Qualificado` ou `Descartado` (ou `Erro`) |

### Config

```yaml
w2:
  delay_entre_grupos_seg: [5, 12]
  membros_min: 50        # grupo minúsculo não vale o risco de envio
  membros_max: 100000
```

### Algoritmo

1. **Normalizar o status de entrada:** `Nao enviado` → tratar como `Novo`.
2. **Abrir o `Link do Grupo`** (página de convite pública, sem entrar no grupo ainda).
3. **O link está vivo?** Convite de WhatsApp expira, é revogado ou o grupo é apagado.
   - Morto / "link inválido" / "convite expirado" → `Status = Descartado`, `Motivo descarte = link expirado`.
4. **Ler o que a página de convite mostra:** nome do grupo, descrição, foto, e quando disponível a contagem de membros.
   - Fora de `[membros_min, membros_max]` → descartar com o motivo e o número.
5. **O nicho bate?** Comparar `Categoria/Nicho` e nome/descrição com esporte / e-sports.
   - Não bate → descartar, motivo `fora do nicho`.
6. **É grupo de aposta?** Procurar em nome, descrição e (se entrar) nas mensagens: `aposta`, `apostas`, `bet`, `odds`, `tips`, `banca`, `green`, `red`, `cupom`, nome de bookmaker.
   - Sim → **descartar**, motivo `grupo de aposta`. Sem exceção.
   - ⚠️ Vários grupos que o W1 já coletou são de aposta — inclusive um chamado literalmente `Efootball 25 (apostas)`. Esses ficam fora.
7. **Descobrir o ADMIN.** Este é o entregável central:
   - Se entrar no grupo, ler a lista de participantes e identificar quem está marcado como admin.
   - Anotar o número/contato em `Notas` no formato `admin=+55...` (ou na coluna `Contato admin`, se você criá-la).
   - Sem admin identificável → `Status = Descartado`, motivo `admin nao identificado`. Sem admin não há a quem pedir licença, e postar sem licença está fora de questão.
8. **Escrever o `Gancho`** — contexto do grupo, para o W3 personalizar. Frase curta e concreta.

   | | Exemplo |
   |---|---|
   | ✅ Bom | `grupo de eFootball com ~800 membros, admin posta escalação toda rodada` |
   | ✅ Bom | `grupo de NFL fantasy, galera discute waiver semanal` |
   | ❌ Ruim | `grupo de futebol` |
   | ❌ Ruim | `grupo ativo` |
9. `Validado?` = `Sim`/`Nao`, `Data qualificacao` = hoje, `Status` → `Qualificado` / `Descartado`, `Z`/`AA` atualizados.
10. Esperar `delay_entre_grupos_seg`.

### Casos de borda

| Situação | Ação |
|---|---|
| Link pede para entrar e você não quer entrar ainda | avaliar só pela página de convite; se der para identificar admin depois, `Proxima acao = entrar para achar admin` |
| Grupo cheio ("não é possível entrar") | `Descartado`, motivo `grupo cheio` |
| Grupo pede aprovação de admin para entrar | `Descartado`, motivo `entrada restrita` — não faz sentido pedir entrada só para vender |
| Só admin pode mandar mensagem no grupo | manter, mas anotar em `Notas`: `grupo restrito - so admin posta` (isso é bom: reforça falar com o admin) |
| Grupo é de outro país / outro idioma | `Descartado`, motivo `fora do Brasil` |
| Contagem de membros não visível | seguir, deixar vazio, anotar `membros desconhecido` |

### Guardrails

- **Não postar nada** no grupo nesta etapa. Só observar.
- Se entrar em grupo para identificar admin, **sair depois** se não for prosseguir — não ficar acumulando presença em dezenas de grupos.
- Nunca extrair a lista completa de números dos participantes. O alvo é **o admin**, não a base de membros. Coletar todos os números do grupo é raspagem de dado pessoal em massa e está fora do escopo.

---

## 5. W3 · REDATOR

**Arquivo:** `agents/w3_redator.py`

Deixa a mensagem **digitada no chat do admin, sem enviar**.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Qualificado` |
| **Lê** | B `Nome do Grupo`, D `Categoria/Nicho`, H `Gancho`, G `Notas` (contato do admin) |
| **Escreve** | L `Mensagem (copia)`, M `Data engatilhado`, F `Status` |
| **Saída** | `Engatilhado` (ou `Erro`) |

### Tom (obrigatório)

- **Suave e informal**, PT-BR de conversa. Nada corporativo.
- **Pedir licença é o núcleo da mensagem.** A primeira coisa que o admin tem que entender é que você **não vai postar nada sem autorização dele**. Isso muda completamente a recepção — deixa de ser invasão e passa a ser consulta.
- **O eixo é o ganho do grupo e da marca do admin.** Ele ganha conteúdo pro grupo e visibilidade; não está fazendo favor.
- **Curta:** 5 a 7 linhas.
- **Sem link na primeira mensagem** e **sem mencionar a taxa de R$ 20** (entra depois, no W6).
- **Máximo 1 emoji.**
- Termina em pergunta leve.

### Variações (implementar em `lib/copy.py`, alternar)

**V1 — licença primeiro**
```
opa, tudo bem? vi que tu administra o [NOME DO GRUPO]
antes de qualquer coisa: nao vou postar nada no grupo sem tua autorizacao, queria falar
contigo primeiro
to ajudando a lancar a Zafe, um fantasy game de esporte e e-sports — tipo Cartola, 100%
legal, sem aposta
se fizer sentido pra ti, da pra montar uma liga com o nome do grupo: a galera compete
entre si e vira conteudo pro grupo, sem tu ter que produzir nada
e a gente divulga voces de volta nas nossas redes. topa que eu te explique?
```

**V2 — foco em conteúdo pro grupo**
```
fala, beleza? tu que administra o [NOME DO GRUPO], ne?
te chamei no privado de proposito — nao quero mandar nada no grupo sem tu autorizar
to ajudando a montar a Zafe (fantasy game de esporte e e-sports, tipo Cartola, sem
aposta nenhuma)
[GANCHO] — pensei que a galera ia gostar de uma liga fechada com o nome do grupo, todo
mundo competindo entre si. da movimento no grupo sem tu precisar puxar assunto
faz sentido pra ti? se nao, sem problema nenhum
```

**V3 — foco no admin**
```
opa, tudo certo? tu é admin do [NOME DO GRUPO]?
to ajudando a lancar a Zafe — fantasy game de esporte e e-sports, 100% legal (fantasy
sport, nao é casa de aposta)
queria te propor uma parceria como Parceiro Fundador. na pratica: liga com o nome do
grupo, a gente te divulga de volta, e material pronto pra tu postar
e obvio, nada vai pro grupo sem tu liberar. quer que eu te mande os detalhes?
```

**Rotação:** round-robin, gravando em `Notas` qual variação foi usada (`variacao=V2`).

### Validador de mensagem (falha ⇒ `Status = Erro`)

1. `[NOME DO GRUPO]` e `[GANCHO]` (quando usado) substituídos.
2. Nenhuma palavra do vocabulário proibido.
3. Nenhuma URL.
4. Não contém `R$ 20`, `taxa`, `inscrição`.
5. **Contém explicitamente o pedido de licença** — pelo menos uma de: `sem tua autorizacao`, `sem tu autorizar`, `sem tu liberar`, `queria falar contigo primeiro`. **Esta regra é obrigatória**: mensagem sem pedido de licença não pode ser engatilhada.
6. Entre 250 e 700 caracteres.
7. Termina com `?` ou frase de baixo compromisso.

### Algoritmo

1. **Sem contato de admin em `Notas` → não escrever.** `AB = sem contato de admin`, `Status = Erro`.
2. **`Gancho` vazio → não escrever** (para as variações que usam gancho). `AB = sem gancho utilizavel`, `Status = Erro`.
3. Escolher variação, renderizar, rodar o validador.
4. Abrir a conversa do admin no WhatsApp Web (`web.whatsapp.com`, buscar/abrir pelo número).
5. **Digitar o texto na caixa de mensagem.**
6. ⚠️ **NUNCA pressionar Enter.** No WhatsApp Web, Enter envia. Digitar sem newline; para quebra de linha usar `Shift+Enter` **com cuidado** ou preferir texto de linha única com separadores. Sair da conversa **clicando fora**.
7. Confirmar que o WhatsApp marcou a conversa com **indicador de rascunho** na lista — é o sinal de que o rascunho persistiu.
8. Gravar `Mensagem (copia)` (L) = texto integral, `Data engatilhado` (M) = agora, `Status = Engatilhado`.

### Casos de borda

| Situação | Ação |
|---|---|
| Número não tem WhatsApp | `Status = Descartado`, motivo `numero sem whatsapp` |
| Número inválido / formato errado | `Status = Erro`, `AB = numero invalido` |
| Já existe conversa anterior com esse admin | não engatilhar; `Status = Erro`, `AB = conversa ja existente - revisar` |
| Enter disparado por acidente | tratar como enviado: `Status = Enviado`, `Data envio` = agora, `Notas += ENVIADO SEM APROVACAO - revisar` |
| Rascunho não aparece como indicador | reescrever 1x; persistindo → `Status = Erro` |

---

## 6. ✋ PORTÃO HUMANO — aprovação em lote

Não é agent. É você.

1. O W3 acumula linhas em `Status = Engatilhado`.
2. Você filtra a Página2 por `Status = Engatilhado` e lê `Mensagem (copia)` (L).
3. Você preenche `Aprovado?` (N) = `Sim` para o lote **de uma vez** — selecionar a faixa e arrastar. Não é uma por uma.
4. Quem abre as conversas e aperta enviar é o **W4**.
5. Linha em branco ou `Nao` em N **não é enviada**.

O `run_loop.py --canal whatsapp` **para** ao chegar em `Engatilhado` e informa quantas linhas aguardam aprovação.

---

## 7. W4 · ENVIADOR

**Arquivo:** `agents/w4_enviador.py`

O agent de maior risco operacional do sistema. Configuração conservadora não é opcional.

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Engatilhado` **E** `Aprovado?` = `Sim` |
| **Lê** | G `Notas` (contato do admin), L `Mensagem (copia)`, N `Aprovado?` |
| **Escreve** | P `Data envio`, O `Data aprovacao` (se vazia), F `Status` |

### Config (bem mais conservadora que o Instagram)

```yaml
w4:
  delay_entre_envios_seg: [120, 300]   # 2 a 5 min
  daily_cap: 15                         # teto diário baixo de propósito
  pausa_a_cada: 5
  pausa_longa_seg: [900, 1800]          # 15 a 30 min
  parar_ao_detectar_bloqueio: true
```

*Por que tão baixo:* número mandando mensagem para desconhecido em volume é exatamente o padrão que o WhatsApp usa para banir. Um número queimado significa perder a conta e ter que começar de novo com outro. 15 admins bem escolhidos por dia sustenta a operação por meses.

### Algoritmo

1. **Trava dupla.** Só prosseguir com `Status = Engatilhado` **E** `Aprovado? = Sim`. Faltando qualquer uma → pular. **Nenhuma flag de CLI pode contornar esta trava.**
2. Checar `daily_cap` consumido hoje (contar `Data envio` = hoje). Atingiu → encerrar a rodada com log claro.
3. Abrir a conversa do admin.
4. **Rascunho ainda está lá?** (No WhatsApp normalmente sim.) Se sumiu → reescrever a partir de `Mensagem (copia)`.
5. **Comparar** o texto da caixa com `Mensagem (copia)`. Divergiu → usar a versão da coluna, que é a aprovada. Nunca enviar texto diferente do aprovado.
6. **Enviar.**
7. `Data envio` = agora, `Status = Enviado`, `Data aprovacao` = hoje se vazia.
8. Esperar `delay_entre_envios_seg`; a cada `pausa_a_cada`, esperar `pausa_longa_seg`.
9. **Detecção de bloqueio — parar imediatamente:** aviso de conta restrita, mensagens deixando de sair, "aguarde", desconexão repetida do WhatsApp Web. Gravar `AB = bloqueio da plataforma` nas pendentes, encerrar a rodada e avisar no log. **Não insistir, não trocar de aba e tentar de novo.**

### Casos de borda

| Situação | Ação |
|---|---|
| Rascunho perdido e `Mensagem (copia)` vazia | `Status = Erro`, `AB = rascunho perdido e sem copia` — nunca improvisar |
| Admin bloqueou você | `Status = Descartado`, motivo `bloqueado pelo admin` |
| WhatsApp Web deslogou | parar a rodada, `AB = sessao caiu`, avisar para religar manualmente |
| Admin já respondeu antes do envio | não reenviar; `Status = Respondeu`, deixar para o W5 |

---

## 8. W5 · LEITOR DE RESPOSTAS

**Arquivo:** `agents/w5_leitor.py`

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Enviado` ou `Follow-up enviado` |
| **Lê** | G `Notas` (contato), P `Data envio`, X `Data follow-up` |
| **Escreve** | Q `Respondeu?`, R `Resposta (texto)`, S `Classificacao resposta`, T `Data resposta`, F `Status` |

### Config

```yaml
w5:
  dias_para_sem_resposta: 3            # WhatsApp responde mais rápido que DM
  dias_para_encerrar_apos_followup: 7
  max_caracteres_resposta: 500
```

### Algoritmo

1. Varrer as conversas do WhatsApp Web e cruzar com os contatos em `Enviado` / `Follow-up enviado`.
2. **Houve resposta?**
   - `Respondeu?` = `Sim`, `Resposta (texto)` truncada, `Data resposta` = data.
   - `Classificacao resposta`:

   | Classe | Sinais |
   |---|---|
   | `Interessado` | "pode mandar", "topo", "bora", "gostei", "manda os detalhes" |
   | `Pediu info` | "como funciona?", "que plataforma?", "é pago?" |
   | `Recusou` | "não tenho interesse", "não permito divulgação", "para de mandar" |
   | `Fora de escopo` | não entendeu, respondeu outro assunto, **pediu pagamento**, ou "não sou admin" |
   | `Resposta ambigua` | "vou ver", emoji solto, áudio |

   - `Status = Respondeu`
3. Sem resposta e > `dias_para_sem_resposta` desde `Data envio` → `Status = Sem resposta`.
4. Já em `Follow-up enviado` e > `dias_para_encerrar_apos_followup` sem resposta → `Status = Recusou`, `Proxima acao = encerrado sem resposta`.
5. **Pediu para parar, bloqueou ou denunciou** → `Status = Recusou`, `Notas += SUPRESSAO - nao contactar`. Nenhum agent volta nessa linha.

### Casos de borda

| Situação | Ação |
|---|---|
| Resposta em áudio | `Resposta (texto) = [audio - revisar manualmente]`, `Classificacao = Resposta ambigua` |
| "Não sou admin desse grupo" | `Classificacao = Fora de escopo`, `Proxima acao = achar admin correto` |
| Bloqueou sem responder | `Status = Recusou`, `Notas += bloqueou` |
| Só visualizou (2 tiques azuis) sem responder | contar normalmente como sem resposta |

---

## 9. W6 · CLOSER

**Arquivo:** `agents/w6_closer.py`

### Entrada / saída

| | |
|---|---|
| **Trigger** | `Status = Respondeu`, `Sem resposta`, e periodicamente `Topou` |
| **Lê** | B `Nome do Grupo`, G `Notas`, R `Resposta (texto)`, S `Classificacao resposta` |
| **Escreve** | U `Topou fazer?`, V `Divulgou?`, W `Follow-up feito?`, X `Data follow-up`, Y `Proxima acao`, F `Status` |

### Ramo 1 — `Status = Respondeu`

| `Classificacao` | Ação | Status final |
|---|---|---|
| `Pediu info` | Explicar os 5 benefícios + o funil com honestidade (**incluindo a taxa de R$ 20 do Concurso**) + enquadramento legal (fantasy sport, Art. 49 da Lei 14.790/2023). | segue `Respondeu`, `Proxima acao = aguardando decisao` |
| `Interessado` | `Topou fazer?` = `Sim`. Combinar a **liga com o nome do grupo**, mandar o link de referência, enviar material/artes prontas, e **orientar a marcar como publi/parceria (CONAR)**. | `Topou`, `Proxima acao = aguardando post no grupo` |
| `Recusou` | `Topou fazer?` = `Nao`. Agradecer curto. Supressão. | `Recusou` |
| `Fora de escopo` | Esclarecer **uma vez**. Se pediu cachê, explicar que é parceria sem pagamento, sem insistir. Se não é admin, `Proxima acao = achar admin correto`. | `Proxima acao = avaliar manualmente` |
| `Resposta ambigua` | **Não improvisar.** Deixar para humano. | `Proxima acao = revisar manualmente` |

**Os 5 benefícios (para `Pediu info`):**
1. Selo oficial de Parceiro Fundador — autoridade, chegou antes.
2. **Liga com o nome do grupo** — a galera compete entre si; gera movimento no grupo sem o admin ter que produzir conteúdo.
3. Cross-promo — a Zafe divulga o grupo de volta.
4. Conteúdo e artes prontas para o admin postar.
5. Ele entrega valor real ao grupo — um concurso com R$ 20 mil em PIX.

⚠️ **Nunca esconder a taxa de R$ 20.** O admin vai indicar isso para o grupo dele; ele precisa saber exatamente o que está indicando. Omitir queima a confiança dele com o grupo — e a da Zafe com os dois.

### Ramo 2 — `Status = Sem resposta`

1. **UM ÚNICO** follow-up, curto:
   `opa, só voltando aqui rapidinho — topa dar uma olhada? se nao rolar, sem problema 🙂`
2. `Follow-up feito?` = `Sim`, `Data follow-up` = hoje, `Status = Follow-up enviado`.
3. **Nunca um segundo follow-up.** Já em `Follow-up enviado`, o W6 ignora a linha; quem encerra é o W5. Insistir gera denúncia — e denúncia no WhatsApp derruba número.

### Ramo 3 — acompanhar quem topou

Para linhas em `Topou`: o admin liberou e a liga foi divulgada no grupo?
- Sim → `Divulgou?` = `Sim`, `Proxima acao = divulgou`.
- > 14 dias sem movimento → `Proxima acao = cobrar gentilmente 1x`.

---

## 10. Analista

O agent **A7 · Analista** é **compartilhado** com o loop de Instagram — ele lê as duas abas e compara os canais. A especificação completa dele está no documento do Instagram (seção 10). Aqui só o que ele mede especificamente deste loop:

- Taxa de link expirado (quanto do que o W1 coleta já está morto quando o W2 chega).
- Taxa de admin identificado (`admin nao identificado` ÷ total) — se for alta, o W2 precisa de outra estratégia.
- Taxa de resposta por tamanho de grupo.
- Taxa de autorização (`Topou` ÷ `Respondeu`).
- Contagem de grupos descartados por `grupo de aposta` — indica qualidade da fonte do W1.
- **Comparação direta Instagram vs WhatsApp:** qual canal traz mais parceiros por esforço, para decidir onde dobrar.

---

## 11. Estrutura e entregáveis

```
/agents
  w2_validador.py   w3_redator.py   w4_enviador.py
  w5_leitor.py      w6_closer.py
/lib
  sheets.py        # compartilhado com o loop de Instagram
  status.py        # inclui normalização de "Nao enviado" -> "Novo"
  copy_wa.py       # 3 variações + validador (regra do pedido de licença)
  whatsapp.py      # Playwright em web.whatsapp.com: abrir conversa, digitar SEM Enter, enviar
  supressao.py
  log.py
/config
  settings.example.yaml
run_loop.py --canal whatsapp
README.md
```

**README deve cobrir:** service account gratuita, **compartilhar a planilha com o e-mail dela**, Playwright, **login manual no WhatsApp Web** (o agent nunca escaneia QR nem digita credencial), como rodar cada agent, e um aviso explícito sobre o teto diário baixo e o porquê.

---

## 12. Critérios de aceite

- [ ] W2 aceita `Nao enviado` **e** `Novo` como entrada e normaliza.
- [ ] Link expirado é detectado e descartado, não vira erro silencioso.
- [ ] Linha sem admin identificado **não** avança para o W3.
- [ ] Grupos de aposta são descartados (inclusive o que tem "apostas" no nome).
- [ ] **Toda mensagem contém o pedido de licença.** Mensagem sem isso não pode ser engatilhada — testar o validador.
- [ ] Nenhuma mensagem tem link, palavra proibida, ou menção a R$ 20.
- [ ] W3 nunca pressiona Enter; confirma o indicador de rascunho.
- [ ] **Linha `Engatilhado` sem `Aprovado?=Sim` é ignorada pelo W4.** Testar explicitamente.
- [ ] W4 respeita `daily_cap` de 15 e para sozinho ao detectar bloqueio.
- [ ] Nada é postado dentro de nenhum grupo sem autorização do admin.
- [ ] Nunca é extraída a lista de números dos membros dos grupos.
- [ ] Quem recusou ou bloqueou nunca é contactado de novo.
- [ ] Ninguém recebe mais de **um** follow-up.
- [ ] Erro numa linha não aborta o lote.
- [ ] Custo total R$ 0,00.

## 13. Ordem de construção

1. Reaproveitar `lib/sheets.py` e `lib/status.py` do loop de Instagram; adicionar a normalização `Nao enviado → Novo`.
2. **W2** — testar em 5 links e ver quantos estão vivos e quantos têm admin identificável. Esse número decide se o loop é viável.
3. **W3** + `lib/copy_wa.py` — **mostrar 3 mensagens prontas para revisão antes de engatilhar em massa.**
4. **W4** com a trava de aprovação e o teto de 15 — testar com `--limit 2`.
5. **W5** → **W6**.

Peça revisão antes de rodar, pela primeira vez, qualquer agent que **envie** mensagem.
