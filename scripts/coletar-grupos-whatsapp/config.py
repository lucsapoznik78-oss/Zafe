"""Configuração central do coletor de grupos de WhatsApp Zafe.

Gêmeo do coletor de influencers, mas grava na **Página2** da mesma planilha
(grupos de WhatsApp de esporte/e-sports), não na Página1 (influencers).

Toda a configuração vem de variáveis de ambiente (ver `.env.example`).
NENHUMA variável aqui corresponde a um serviço pago. Se algum dia o coletor
precisar de uma chave paga para avançar, ele deve PARAR e perguntar — nunca
assumir que pode gastar (orçamento do projeto: R$ 0,00).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# ID padrão da planilha de destino (a MESMA do coletor de influencers).
DEFAULT_SHEET_ID = "1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA"

# A Página2 é a SEGUNDA aba (índice 1, gid=2099491059).
DEFAULT_WORKSHEET_INDEX = 1

# Ordem EXATA das 7 colunas da Página2 real. Não reordenar.
# (Setor aqui é o canal — o valor gravado é sempre "WhatsApp".)
COLUMNS = [
    "Setor",
    "Nome do Grupo",
    "Link do Grupo",
    "Categoria/Nicho",
    "Data coleta",
    "Status",
    "Notas",
]

# Posições (0-based) das colunas de identidade, usadas no dedupe quando o
# cabeçalho não bate por nome. Nome do Grupo = coluna 1; Link = coluna 2.
NAME_COL_INDEX = 1
LINK_COL_INDEX = 2


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        raise SystemExit(f"Variável {name} deve ser um inteiro, recebi: {raw!r}")


@dataclass(frozen=True)
class Config:
    credentials_path: str
    sheet_id: str
    worksheet_index: int
    region: str
    limit: int
    scraper_user_agent: str
    scraper_delay_seconds: float

    @classmethod
    def from_env(cls) -> "Config":
        credentials = os.getenv("GOOGLE_SHEETS_CREDENTIALS", "").strip()
        if not credentials:
            raise SystemExit(
                "GOOGLE_SHEETS_CREDENTIALS não configurado. "
                "Aponte para o JSON da service account gratuita (ver README)."
            )
        return cls(
            credentials_path=credentials,
            sheet_id=os.getenv("SHEET_ID", DEFAULT_SHEET_ID).strip() or DEFAULT_SHEET_ID,
            worksheet_index=_get_int("WORKSHEET_INDEX", DEFAULT_WORKSHEET_INDEX),
            region=os.getenv("REGION", "BR").strip() or "BR",
            limit=_get_int("LIMIT", 50),
            scraper_user_agent=os.getenv(
                "SCRAPER_USER_AGENT",
                "ZafeCreatorOutreach/1.0 (+https://zafe.app.br)",
            ).strip(),
            scraper_delay_seconds=float(os.getenv("SCRAPER_DELAY_SECONDS", "4") or 4),
        )
