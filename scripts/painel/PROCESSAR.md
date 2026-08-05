# Como o agente processa a caixa de pedidos

Este arquivo diz ao agente (Claude Code) o que fazer com os pedidos que chegam
pelo painel (`scripts/painel/app.py`). Um "pedido" é um JSON em
`scripts/painel/inbox/pending/<id>.json` com os campos:

```json
{ "id": "...", "mode": "whats|insta", "message": "<o que coletar>",
  "status": "pendente", "created": 0, "report": "" }
```

## Passos para CADA pedido pendente

1. Leia o pedido. Marque `status: "processando"` (reescreva o JSON no lugar).
2. **Garimpe na web** conforme o `mode` e a `message`:
   - **whats** → use WebFetch nos sites de diretório de grupos, nas categorias
     que casam com a mensagem:
     - `https://gruposwhats.app/category/futebol` (e `?page=2`, `page=3`…)
     - `https://gruposwhats.app/category/esports`
     - `https://grupodewhatsapp.com/esportes/futebol`, `/esportes`
     - `https://linkdegrupo.com.br/grupos/futebol`
     - Troque a categoria conforme a mensagem (basquete, ufc, tenis, games…).
     - Monte um CSV `nome,link,categoria,fonte` em
       `scripts/coletar-grupos-whatsapp/painel-<id>.csv`.
     - Rode o coletor:
       `cd scripts/coletar-grupos-whatsapp && <venv>/python run.py --input painel-<id>.csv --quantity --limit 300`
       (rode com `--dry-run` primeiro só se quiser conferir).
   - **insta** → use WebSearch por nicho de esporte/e-sports BR para achar
     @handles públicos (não invente seguidores; desconhecido = "verificar").
     - Monte um CSV `handle,nome,seguidores,nicho` em
       `scripts/coletar-influencers/painel-<id>.csv`.
     - Rode: `cd scripts/coletar-influencers && <venv>/python run.py --source csv --input painel-<id>.csv --quantity --limit 200`
     - **Se a mensagem pedir foco em bet/aposta/palpite/tipster**, adicione
       `--allow-betting` ao comando. Público de bet é lead válido (a Zafe é
       fantasy legal; não somos responsáveis pelo que a pessoa também joga). A
       linguagem gravada continua limpa — nunca "aposta/odds/cassino" nas notas.
     - Lembre: descoberta grátis de IG por nicho é limitada — colete o que der
       via busca, nunca pague nem prometa verificação de seguidores em massa.
3. Pegue o RELATÓRIO impresso pelo run.py. Coloque em `report` do JSON,
   marque `status: "concluido"` e **mova** o arquivo para
   `scripts/painel/inbox/done/<id>.json`.
4. Se algo falhar (site bloqueou, nada encontrado), marque `status: "erro"` e
   escreva o motivo em `report`, e mova para `done/`.

Regras invioláveis (valem sempre): R$ 0,00 (nada pago), nunca inventar dados,
append-only, dedupe automático (o run.py já faz), pular grupos/contas de aposta,
linguagem Zafe (nunca "aposta/odds/cassino" nos textos).

O `<venv>` é `scripts/coletar-influencers/.venv/bin/python` (os dois coletores
usam o mesmo).
