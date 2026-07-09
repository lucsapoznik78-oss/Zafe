#!/bin/bash
# Ping leve no Zafe — gera impressões e mantém a Vercel aquecida.
# Executa a cada 30–60 min via cron. Máximo 2 visitas/hora em páginas variadas.
# USO: ./scripts/ping-site.sh  ou  via cron: */30 * * * * /caminho/scripts/ping-site.sh

URLS=(
  "https://www.zafe.app.br"
  "https://www.zafe.app.br/liga"
  "https://www.zafe.app.br/economico"
  "https://www.zafe.app.br/concurso"
  "https://www.zafe.app.br/comunidade"
  "https://www.zafe.app.br/ranking"
  "https://www.zafe.app.br/copa"
  "https://www.zafe.app.br/copa/ranking"
  "https://www.zafe.app.br/login"
  "https://www.zafe.app.br/termos"
  "https://www.zafe.app.br/historico"
  "https://www.zafe.app.br/comunidade/criar"
)

# Sorteia 2 URLs diferentes
IDX1=$((RANDOM % ${#URLS[@]}))
IDX2=$IDX1
while [ "$IDX2" = "$IDX1" ]; do
  IDX2=$((RANDOM % ${#URLS[@]}))
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pingando: ${URLS[$IDX1]} e ${URLS[$IDX2]}"
curl -sL -o /dev/null -w "  %{http_code} %{url_effective}\n" "${URLS[$IDX1]}"
sleep 3
curl -sL -o /dev/null -w "  %{http_code} %{url_effective}\n" "${URLS[$IDX2]}"
