"""Configuração central do coletor de micro-influencers Zafe.

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

# ID padrão da planilha de destino (já criada, co-editada).
DEFAULT_SHEET_ID = "1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA"

# Ordem EXATA das 17 colunas da planilha real (Página1). Não reordenar.
# A planilha do usuário NÃO tem coluna "ID"; começa em "Canal" (Instagram).
COLUMNS = [
    "Canal",
    "Setor",
    "Nome",
    "@handle",
    "Link do perfil",
    "Seguidores",
    "Nicho específico",
    "Contato",
    "Data coleta",
    "Link concurso ref",
    "Status",
    "Data envio",
    "Respondeu?",
    "Topou fazer?",
    "Divulgou?",
    "Follow-up feito?",
    "Notas",
]

# Posições (0-based) das colunas de identidade na planilha real, usadas no dedupe
# quando o cabeçalho não bate por nome (os títulos reais são "Conta do Insta" /
# "Link do Insta"). @handle = coluna 4; Link = coluna 5.
HANDLE_COL_INDEX = 3
LINK_COL_INDEX = 4


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
    follower_min: int
    follower_max: int
    region: str
    limit: int
    concurso_ref_base: str
    # Automação opcional da fonte gratuita
    modash_free_url: str
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
            follower_min=_get_int("FOLLOWER_MIN", 500),
            follower_max=_get_int("FOLLOWER_MAX", 10_000),
            region=os.getenv("REGION", "BR").strip() or "BR",
            limit=_get_int("LIMIT", 50),
            concurso_ref_base=os.getenv(
                "CONCURSO_REF_BASE", "https://zafe.app.br/concurso/entrar"
            ).strip().rstrip("/"),
            modash_free_url=os.getenv(
                "MODASH_FREE_URL",
                "https://www.modash.io/free-influencer-search-tool",
            ).strip(),
            scraper_user_agent=os.getenv(
                "SCRAPER_USER_AGENT",
                "ZafeCreatorOutreach/1.0 (+https://zafe.app.br)",
            ).strip(),
            scraper_delay_seconds=float(os.getenv("SCRAPER_DELAY_SECONDS", "4") or 4),
        )
