"""Configuração central do loop de abordagem Zafe.

Reaproveita a mesma planilha e service account gratuita dos coletores. Orçamento
do projeto: R$ 0,00 — nenhuma variável aqui aponta para serviço pago.

Duas abas, mesmo arquivo:
  Página1 (índice 0) = influencers do Instagram — agentes A2..A7
  Página2 (índice 1) = grupos de WhatsApp        — agentes W2..W6
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()

DEFAULT_SHEET_ID = "1BW8CjumkH6cOw3lRCYLmHiBWEKn_1ZejV1j9rm3WiyA"

# A fila de envio humano vive fora deste diretório, junto dos agents.
_DEFAULT_OUTBOX = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "zafe_contact",
    "outbox",
)

# --- Página1 (Instagram): 17 colunas reais, 0-based ------------------------
IG_COLS = {
    "canal": 0,
    "setor": 1,
    "nome": 2,
    "handle": 3,
    "link": 4,
    "seguidores": 5,
    "nicho": 6,
    "contato": 7,
    "data_coleta": 8,
    "ref": 9,
    "status": 10,
    "data_envio": 11,
    "respondeu": 12,
    "topou": 13,
    "divulgou": 14,
    "followup": 15,
    "notas": 16,
}

# --- Página2 (WhatsApp): 7 colunas reais, 0-based --------------------------
# Cabeçalho real (o que o W1 grava): Setor, Nome do Grupo, Link do Grupo,
# Categoria/Nicho, Data coleta, Status, Notas. Não há coluna de telefone —
# não raspamos contato de admin nem lista de membros.
WA_COLS = {
    "setor": 0,
    "nome": 1,
    "link": 2,
    "categoria": 3,
    "data_coleta": 4,
    "status": 5,
    "notas": 6,
}


@dataclass(frozen=True)
class Config:
    credentials_path: str
    sheet_id: str
    # Faixa de qualificação (micro-influencer / grupo saudável)
    seguidores_min: int
    seguidores_max: int
    membros_min: int
    membros_max: int
    # Link mandado no fechamento (nunca no 1o toque). Aponta para a ZONA GRÁTIS:
    # o Concurso está atrás de NEXT_PUBLIC_CONCURSO_ENABLED (default off, sem
    # CNPJ/PIX) e /concurso* redireciona pra /. Prometer prêmio em dinheiro numa
    # abordagem seria promessa que a plataforma não pode cumprir hoje.
    ref_base: str
    # Tetos conservadores por execução — protege a planilha e evita spam.
    ig_lote_max: int
    wa_lote_max: int
    # Pasta onde a fila de envio humano é escrita (outbox).
    outbox_dir: str
    forbidden: tuple[str, ...] = field(default=())

    @classmethod
    def from_env(cls) -> "Config":
        credentials = os.getenv("GOOGLE_SHEETS_CREDENTIALS", "").strip()
        if not credentials:
            raise SystemExit(
                "GOOGLE_SHEETS_CREDENTIALS não configurado. Aponte para o JSON "
                "da service account gratuita (mesma dos coletores)."
            )
        return cls(
            credentials_path=credentials,
            sheet_id=os.getenv("SHEET_ID", DEFAULT_SHEET_ID).strip() or DEFAULT_SHEET_ID,
            seguidores_min=_int("SEGUIDORES_MIN", 500),
            seguidores_max=_int("SEGUIDORES_MAX", 100_000),
            membros_min=_int("MEMBROS_MIN", 50),
            membros_max=_int("MEMBROS_MAX", 100_000),
            ref_base=os.getenv("REF_BASE", "https://zafe.app.br")
            .strip()
            .rstrip("/"),
            ig_lote_max=_int("IG_LOTE_MAX", 40),
            wa_lote_max=_int("WA_LOTE_MAX", 20),
            outbox_dir=os.getenv("OUTBOX_DIR", _DEFAULT_OUTBOX).strip() or _DEFAULT_OUTBOX,
            forbidden=FORBIDDEN,
        )


# Palavras proibidas na copy (regra de ouro Zafe: fantasy de habilidade, não bet).
#
# ATENÇÃO: casar por SUBSTRING aqui é bug, não rigor. "bet" casa dentro de
# "beta" e "tip" casa dentro de "tipo" — as duas palavras aparecem nas copies
# oficiais ("ainda tá em beta", "tipo o Cartola"), e o validador reprovava lote
# inteiro por causa disso. Use FORBIDDEN_RX, que casa palavra inteira, e liste
# aqui os plurais explicitamente em vez de contar com prefixo.
FORBIDDEN = (
    "aposta", "apostas", "apostar", "apostador", "apostadores", "apostadora",
    "odds", "cassino", "cassinos", "casino", "bet", "bets", "bettor",
    "depósito", "deposito", "saque", "saques", "banca", "bancas",
    "tipster", "tipsters", "jogo de azar", "jogos de azar",
    # "bolão" é o termo que a galera usa pra vaquinha de resultado — colar nele
    # desfaz o enquadramento de fantasy sport (o Cartola não se chama de bolão).
    "bolão", "bolao",
)

FORBIDDEN_RX = re.compile(
    r"\b(?:%s)\b" % "|".join(re.escape(p) for p in FORBIDDEN),
    re.IGNORECASE,
)


def achar_proibida(texto: str) -> str | None:
    """Devolve a primeira palavra proibida do texto, ou None. Palavra inteira."""
    m = FORBIDDEN_RX.search(texto)
    return m.group(0) if m else None

# Frases que provam benefício da marca — a copy do IG precisa conter uma.
BRAND_PHRASES = (
    "liga com o nome",
    "espaço que é literalmente seu",
    "competição de habilidade",
    "fantasy",
    "moeda virtual z$",
    "palpite",
    "previsão",
)


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        raise SystemExit(f"Variável {name} deve ser inteiro, recebi: {raw!r}")
