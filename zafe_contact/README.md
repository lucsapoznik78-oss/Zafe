# zafe_contact

Central de **divulgação e abordagem** da Zafe. Aqui fica tudo sobre COMO a gente
fala com os leads que os coletores garimpam (influencers no IG → Página1, grupos de
WhatsApp → Página2) e como converte esse público em jogador da Zafe.

## O que é a Zafe (para não errar o discurso)

Liga de previsões / fantasy sport de **habilidade**, legal (Lei 14.790/2023, Art. 49).
NÃO é bet, NÃO é cassino. Moeda virtual **Z$** (não vira dinheiro e não sai da conta).

⚠️ **O Concurso Mensal (prêmio em R$ via PIX) está DESLIGADO** —
`NEXT_PUBLIC_CONCURSO_ENABLED=false`, porque ainda não há CNPJ nem provedor PIX
integrado, e `/concurso*` redireciona pra home. Enquanto isso, **nenhuma abordagem
pode prometer prêmio em dinheiro, PIX, ou mencionar a taxa de R$ 20**. A oferta é a
**zona grátis**: liga com o nome do criador/grupo, Z$ virtual, cross-promo.
O link é `zafe.app.br` — o antigo `/concurso/entrar?ref=` que está gravado na
planilha está morto.

## Regra de ouro da linguagem

Nunca usar "aposta / bet / apostador / odds / cassino / depósito / saque" na copy.
Usar: **previsão, palpite, previsor, probabilidade, competição de habilidade**.
Teste mental: *"o Cartola FC falaria isso de si mesmo?"*

Repare que o enquadramento é sempre **positivo**: a copy diz o que a Zafe é, nunca
"não é aposta" — além de ser o jeito certo de se apresentar, negar usando a palavra
proibida reprovaria no próprio validador dos agents.

O público de bet É alvo válido de captação (ele vai gostar da Zafe), mas a nossa fala
sempre trata a Zafe como jogo de habilidade, não como aposta.

## Os 13 agents

Cada agent é um markdown com o mesmo formato: frontmatter + regras invioláveis +
entrada/saída + algoritmo + casos de borda + relatório. **Nenhum deles guarda
memória** — o estado inteiro vive na coluna `Status` da planilha, e cada agent só
pega as linhas do estado dele. Se um quebra, a linha fica parada e o próximo pega
na rodada seguinte.

### `Agents/Insta/` — Instagram (Página1)
| Agent | Gatilho → Saída | O que faz |
|---|---|---|
| `A1-coletador_insta.md` | — → `Novo` | garimpa influencers de esporte/e-sports e anexa na planilha |
| `A2-qualificador.md` | `Novo` → `Qualificado` / `Rejeitado` | confere faixa e nicho, barra conta de aposta, e escreve o **gancho** |
| `A3-redator.md` | `Qualificado` → `Aprovado` | escreve a DM (4 variações) e valida compliance |
| `A4-fila-envio.md` | `Aprovado` → `Na fila` | gera o CSV de copiar-e-colar, teto 40/dia |
| `A5-leitor.md` | `Na fila`/`Enviado` → `Respondeu` / `Sem resposta` | confirma envio e classifica resposta |
| `A6-closer.md` | `Respondeu`/`Sem resposta` → `Topou` / `Recusou` | fecha a parceria, 1 follow-up só |
| `A7-analista.md` | — (read-only) | mede os dois canais e diz onde dobrar o esforço |

### `Agents/Whats/` — WhatsApp (Página2)
| Agent | Gatilho → Saída | O que faz |
|---|---|---|
| `W1-coletador-whats.md` | — → `Nao enviado` | garimpa grupos de esporte em diretórios públicos |
| `W2-validador.md` | `Novo` → `Qualificado` / `Rejeitado` | link ainda vivo?, tema bate?, barra grupo de aposta, escreve o gancho |
| `W3-redator.md` | `Qualificado` (+ liberado) → `Aprovado` | grava `autorizado=Sim`; guarda a **mensagem padrão** (uma só para todos os grupos) |
| `W4-fila-envio.md` | `Aprovado` → `Na fila` | CSV = **lista numerada de links**, teto **20/dia**, ritmo lento |
| `W5-leitor.md` | `Na fila`/`Enviado` → `Respondeu` / `Sem resposta` | confirma o post e registra a reação do grupo |
| `W6-closer.md` | `Respondeu`/`Sem resposta` → `Topou` / `Recusou` | responde dúvidas, monta a liga com o nome do grupo, 1 volta só |

O A7 atende **os dois canais**.

### A autorização do WhatsApp é conseguida por fora

No Instagram a DM já é o primeiro contato. No WhatsApp não: **postar em grupo sem
o admin liberar é spam**, e nenhum agent faz isso.

Quem consegue a autorização é **você**, por fora, no seu ritmo. Depois é só dizer
no chat quais linhas estão liberadas — *"do grupo 1 ao 20, número na tabela, pode
mandar"*. O W3 grava `autorizado=Sim` em `Notas`, escreve a mensagem e devolve
pronta pra você colar no grupo. Linha sem `autorizado=Sim` não recebe copy.

Como a mensagem deixa de ser abordagem fria e vira divulgação combinada, ela fala
com a galera do grupo (não com o admin), diz que o admin liberou, e **leva o link
da Zafe junto**.

### Um template por canal, não um monte de variações

Cada canal tem **um texto só**, no bloco `## A MENSAGEM PADRÃO` do respectivo
redator — `Agents/Insta/A3-redator.md` e `Agents/Whats/W3-redator.md`. Esses
blocos são a fonte única: o A4/W4 lê de lá e nenhum agent improvisa texto. Mudou
o texto? Muda ali e sobe a versão (`padrao v1` → `v2`), que fica gravada em
`Notas` como `copy_versao=` para o A7 comparar.

| | O que muda por lead | Como fica o CSV |
|---|---|---|
| **Instagram** | `[NOME]` · `[NICHO]` · `[GANCHO]` | cada linha carrega a mensagem já montada |
| **WhatsApp** | só `[TEMA DO GRUPO]` | lista numerada de links, **agrupada por tema** — você copia uma mensagem por tema |

## A linha que faz isso funcionar: envio é humano

Os agents fazem **julgamento e escrituração** — qualificar, escrever copy, validar
compliance, classificar resposta, medir. Tudo que exige estar logado no Instagram ou
no WhatsApp — abrir perfil, mandar DM, varrer inbox — é **humano**.

Isso não é limitação técnica, é a decisão certa: automação de DM é o padrão que as
plataformas usam para derrubar conta, e o envio manual mantém um humano olhando antes
de qualquer coisa sair no nome da Zafe. O A4/W4 entregam um CSV de copiar-e-colar; o
A5/W5 registram o que realmente saiu.

## A planilha e a CLI

Planilha viva: `1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA`
(**Página1** = influencers, 17 colunas · **Página2** = grupos, 7 colunas).

Ela é **co-editada ao vivo**. Por isso os agents só fazem duas escritas: atualizar
**uma célula** por vez, e **anexar** em `Notas`. Nunca reescrever faixa, nunca
reordenar coluna, nunca apagar linha.

Como a planilha não tem coluna pra tudo (não existe `Gancho`, `Mensagem`,
`Classificação`), esses campos moram dentro de `Notas` no formato `chave=valor`:
`gancho=` · `copy=` · `copy_versao=` · `classe=` · `motivo=` · `enviado=` ·
`followup=` · e, só no WhatsApp, `autorizado=` · `tema=` · `postado=` ·
`reacao=` · `volta=`.

Acesso via `scripts/planilha/cli.py` (service account gratuita):

```bash
cd scripts/planilha
./.venv/bin/python cli.py contar --aba ig
./.venv/bin/python cli.py ler    --aba ig --status Novo --limit 30
./.venv/bin/python cli.py set    --aba ig --linha 42 --campo status \
                                 --valor Qualificado --se-status Novo
./.venv/bin/python cli.py nota   --aba ig --linha 42 --texto "gancho=..."
```

`--se-status` é a trava de idempotência: relê o Status antes de escrever e aborta se
alguém já mudou o estado. Use sempre que avançar um lead de um estado pro outro.

### Máquina de estados

```
Novo ──A2/W2──> Qualificado ──A3/W3──> Aprovado ──A4/W4──> Na fila
  │                  │                                        │
  └──> Rejeitado     └──> Erro          VOCÊ ENVIA ──A5/W5──> Enviado
                                                                │
                                    ┌───────────────────────────┤
                                    v                           v
                              Respondeu ──A6/W6──> Topou    Sem resposta
                                                └──> Recusou   │ (1 follow-up)
                                                               └──> Enviado
```

Terminais: `Rejeitado`, `Topou`, `Recusou`. Quem entra em `Recusou` ou pede pra
parar vai pra **supressão** e nenhum agent volta nessa linha, nunca.

### `Instrucoes/` — referência de discurso
| Arquivo | Para quê |
|---|---|
| `canais.md` | Onde a gente divulga e as fontes de lead |
| `mensagens-instagram.md` · `mensagens-whatsapp.md` | Templates de abordagem |
| `oferta-parceria.md` | O que a gente oferece ao criador |
| `checklist-abordagem.md` | Passo a passo antes de mandar mensagem |
| `Loop_INSTAGRAM_agents.md` · `Loop_WHATSAPP_agents.md` | Specs originais do loop. **Parcialmente desatualizados** — veja o aviso no topo de cada um. Ficam como registro do raciocínio. |

`tabelas.md` (na raiz desta pasta) tem os links diretos da planilha.

### `outbox/` — as filas de envio
CSVs gerados pelo A4/W4 (copiar e colar) e relatórios do A7. Nada aqui é enviado
automaticamente.
