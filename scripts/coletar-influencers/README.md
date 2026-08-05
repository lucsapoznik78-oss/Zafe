# Coletor de micro-influencers Zafe

Agent reutilizável que **coleta micro-influencers brasileiros de esporte/e-sports**
(500 a 10.000 seguidores) e **anexa** numa planilha Google Sheets já existente,
**sem nunca duplicar** e **sem sobrescrever** dados.

> **Orçamento: R$ 0,00.** Só fontes 100% gratuitas, sem cadastro de pagamento,
> sem chave paga, sem trial que peça cartão. Se em algum momento a única forma de
> avançar for pagar algo, o script **para e avisa** — nunca gasta por conta própria.

> **Zafe é fantasy game de habilidade (Art. 49, Lei 14.790/2023), não é aposta.**
> Os textos gravados nunca usam "aposta/odds/cassino". Contas de aposta/tipster
> são **puladas** automaticamente.

---

## O que ele faz

1. Lê a planilha inteira **antes** de coletar e monta um _dedupe set_ com todos os
   `@handle` e `Link do perfil` já existentes (normalizados: sem `@`, sem `/`, minúsculo).
2. Carrega candidatos de uma fonte gratuita (CSV manual ou automação best-effort).
3. Filtra: **dedupe**, faixa **500–10.000** seguidores, **nicho de esporte/e-sports**,
   **pula contas de aposta**, pula quem não tem seguidores conhecidos.
4. **Anexa** os aprovados depois da última linha, no formato exato de 18 colunas,
   continuando a sequência de `ID`.
5. Imprime um **relatório**: gravados por setor, pulados por duplicidade, pulados por
   outros motivos (com o porquê).

Reexecutar só adiciona **novos** — nunca duplica (idempotente).

---

## Instalação

```bash
cd scripts/coletar-influencers
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# só se for usar a automação opcional (--source modash):
python -m playwright install chromium
```

Copie o `.env`:

```bash
cp .env.example .env
```

---

## Criar a service account gratuita e liberar a planilha

Tudo aqui é **gratuito** (Google Cloud free tier, sem cartão para este uso):

1. Acesse <https://console.cloud.google.com/> → crie/selecione um projeto.
2. **APIs e serviços → Biblioteca** → ative **Google Sheets API**.
3. **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
   Dê um nome (ex.: `zafe-coletor`) e conclua.
4. Na conta de serviço criada → aba **Chaves → Adicionar chave → JSON**.
   Baixe o arquivo e salve como `service-account.json` nesta pasta
   (ou aponte `GOOGLE_SHEETS_CREDENTIALS` no `.env` para o caminho dele).
5. Abra o JSON e copie o e-mail do campo `client_email`
   (algo como `zafe-coletor@...gserviceaccount.com`).
6. **Compartilhe a planilha** com esse e-mail, como **Editor**:
   <https://docs.google.com/spreadsheets/d/1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA/edit>
   → botão **Compartilhar** → cole o e-mail → **Editor** → Enviar.

Sem o passo 6 a API responde `403` (a service account não enxerga a planilha).

---

## Modo 1 — CSV (recomendado, estável, sem risco de ToS)

1. Abra a **busca gratuita da Modash** (sem cadastro, sem cartão):
   <https://www.modash.io/free-influencer-search-tool>
2. Filtre **Brasil + nicho de esporte + 500–10.000 seguidores**.
3. Copie os resultados para um CSV. Cabeçalhos aceitos (flexível):
   `handle, nome, seguidores, nicho, contato, link`
   (veja `candidatos.exemplo.csv`). Só `handle` **ou** `link` é obrigatório.
4. Rode:

```bash
python run.py --source csv --input candidatos.csv --dry-run   # confere primeiro
python run.py --source csv --input candidatos.csv             # grava de fato
```

`--dry-run` mostra exatamente o que seria gravado, sem escrever nada.

---

## Modo 2 — Modash automatizado (opcional, best-effort)

Automatiza a **mesma** busca gratuita via Playwright. Respeita `robots.txt` e aplica
delay entre ações. É **frágil por natureza** (página JS-pesada, HTML pode mudar,
pode haver captcha): se não conseguir extrair candidatos, **para e te manda usar o CSV**
— nunca inventa dados.

```bash
python run.py --source modash --niches "futebol,cartola,ufc,nba,nfl,tenis,ea fc" --limit 30
```

Se aparecer `[fonte gratuita indisponível]`, use o Modo 1 (CSV).

---

## Parâmetros

| Flag        | Padrão (via `.env`) | Descrição                                   |
|-------------|---------------------|---------------------------------------------|
| `--source`  | `csv`               | `csv` (recomendado) ou `modash`             |
| `--input`   | —                   | CSV de candidatos (obrigatório no modo csv) |
| `--niches`  | lista de esporte    | nichos separados por vírgula (modo modash)  |
| `--limit`   | `LIMIT=50`          | máx. de novos leads por execução            |
| `--min`     | `FOLLOWER_MIN=500`  | seguidores mínimos                          |
| `--max`     | `FOLLOWER_MAX=10000`| seguidores máximos                          |
| `--dry-run` | —                   | não grava; só mostra o que gravaria         |

---

## As 18 colunas gravadas (ordem exata, na Página1 / gid=0)

`ID | Canal | Setor | Nome | @handle | Link do perfil | Seguidores | Nicho específico |
Contato | Data coleta | Link concurso ref | Status | Data envio | Respondeu? |
Topou fazer? | Divulgou? | Follow-up feito? | Notas`

Preenchimento automático: `ID` sequencial; `Canal=Instagram`; `Status=Nao enviado`;
`Divulgou?=Nao`; `Follow-up feito?=Nao`; `Link concurso ref=<CONCURSO_REF_BASE>?ref=<handle>`;
campos de acompanhamento (`Data envio`, `Respondeu?`, `Topou fazer?`) ficam vazios.

---

## Garantias (critérios de aceite)

- **Nunca sobrescreve**: usa `append_rows` depois da última linha preenchida.
- **Nunca duplica**: `@handle` já presente na planilha (ou repetido na execução) é pulado.
- **Faixa rígida**: só grava 500–10.000 seguidores; contas de aposta são puladas.
- **Sem dados inventados**: seguidores vêm sempre da fonte; desconhecido = pulado.
- **Custo R$ 0,00**: nenhuma dependência exige assinatura, chave paga ou cartão.

---

## Arquivos

| Arquivo             | Papel                                                     |
|---------------------|-----------------------------------------------------------|
| `config.py`         | Configuração via `.env` e definição das 18 colunas.       |
| `filters.py`        | Modelo do lead, nichos, blocklist de aposta, dedupe, linha.|
| `sheets_client.py`  | Google Sheets: snapshot/dedupe/append (append-only).      |
| `csv_source.py`     | Ingestão de candidatos via CSV (modo primário).           |
| `modash_free.py`    | Automação opcional da busca gratuita (best-effort).       |
| `run.py`            | CLI orquestrador + relatório.                             |
