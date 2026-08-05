"""Modelo do grupo, classificação de nicho, blocklist de apostas e dedupe.

Regras críticas (espelham o coletor de influencers):
- Só grupos de esporte/e-sports, público BR.
- Pular grupos de aposta / palpite pago / cassino.
- Nunca inventar dados: campo desconhecido fica vazio.
- Linguagem Zafe: nunca "aposta/odds/cassino" nos textos gravados.
- Dedupe pelo link do grupo (código do convite quando é chat.whatsapp.com).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from typing import TYPE_CHECKING, Iterable
from urllib.parse import urlsplit, urlunsplit

if TYPE_CHECKING:
    from config import Config

# ---------------------------------------------------------------------------
# Nichos aceitos (esporte / e-sports). Chave = Categoria/Nicho gravada.
# Valores = palavras-chave (sem acento, minúsculas) que indicam o nicho.
# ---------------------------------------------------------------------------
NICHE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Fantasy / Cartola": (
        "cartola", "fantasy", "escalacao", "mitar", "mito", "cartoleiro",
    ),
    "Futebol": (
        "futebol", "brasileirao", "serie a", "libertadores", "premier league",
        "champions", "selecao", "campeonato", "la liga", "flamengo", "vasco",
        "palmeiras", "corinthians", "sao paulo", "gremio", "cruzeiro", "torcida",
        "futmessi", "efootball", "e-football",
    ),
    "UFC / MMA": (
        "ufc", "mma", "octogono", "luta", "vale tudo", "jiu jitsu", "jiu-jitsu",
        "muay thai", "boxe",
    ),
    "Basquete": (
        "nba", "basquete", "basketball", "nbb",
    ),
    "NFL / Futebol Americano": (
        "nfl", "futebol americano", "super bowl", "superbowl",
    ),
    "Tênis": (
        "tenis", "atp", "wta", "grand slam", "roland garros", "wimbledon",
    ),
    "Games / eSports": (
        "e-sports", "esports", "esporte eletronico", "ea fc", "ea sports fc",
        "fifa", "cs2", "counter strike", "valorant", "league of legends", "lol",
        "free fire", "freefire", "rainbow six", "cblol", "gamer", "gaming",
    ),
    "Vôlei": (
        "volei", "volleyball", "superliga",
    ),
    "Automobilismo / F1": (
        "formula 1", "formula1", "f1", "automobilismo", "stock car", "motogp",
    ),
}

# Grupos de aposta / palpite / tipster: qualquer ocorrência -> pular o grupo.
BETTING_BLOCKLIST: tuple[str, ...] = (
    "aposta", "apostas", "apostar", "apostador", "bet", "bets", "betting",
    "tips", "tipster", "palpite", "palpites", "odds", "cassino", "casino",
    "bonus", "banca", "gale", "martingale", "sinais", "sinal", "mines",
    "aviator", "blaze", "bacbo", "bac bo", "tigrinho", "fortune tiger",
    "betano", "bet365", "sportingbet", "greenzada", "green certo",
    "entrada confirmada", "unidade", "stake", "surebet",
)

# Sinais fortes de grupo BR / PT-BR (heurística — nunca inventa, só ajuda a filtrar).
BR_SIGNALS: tuple[str, ...] = (
    "brasil", "brasileiro", "brasileira", "brasileirao", "pt-br", "brazil",
    "🇧🇷", "cartola", "nbb", "serie a", "cblol", "flamengo", "corinthians",
    "palmeiras", "vasco", "gremio", "cruzeiro", "torcida",
)


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def normalize_link(raw: str) -> str:
    """Chave de dedupe para o link de um grupo.

    - chat.whatsapp.com/CODE (ou api.whatsapp.com/...) -> 'wa:code' (minúsculo).
    - Link de diretório (ongrupos.com/grupo/X, gruposwhats.app/...) -> URL
      normalizada: minúscula, sem esquema, sem query/fragmento, sem barra final.
    """
    if not raw:
        return ""
    value = raw.strip()
    if not value:
        return ""

    # Código de convite do WhatsApp: o identificador mais estável possível.
    m = re.search(r"(?:chat|api)\.whatsapp\.com/(?:invite/)?([A-Za-z0-9]+)", value)
    if m:
        return "wa:" + m.group(1).lower()

    parts = urlsplit(value if "://" in value else "https://" + value)
    host = parts.netloc.lower().lstrip("www.")
    path = parts.path.rstrip("/").lower()
    return urlunsplit(("", host, path, "", "")).lstrip("/")


def _haystack(*parts: str) -> str:
    return strip_accents(" ".join(p for p in parts if p)).lower()


def looks_like_betting(name: str, categoria: str) -> bool:
    hay = _haystack(name, categoria)
    return any(kw in hay for kw in BETTING_BLOCKLIST)


def classify_categoria(name: str, categoria: str) -> str | None:
    """Retorna a Categoria/Nicho (nicho aceito) ou None se não for esporte."""
    hay = _haystack(name, categoria)
    for nicho, keywords in NICHE_KEYWORDS.items():
        if any(kw in hay for kw in keywords):
            return nicho
    return None


def looks_brazilian(name: str, categoria: str, region_hint: str = "") -> bool:
    hay = _haystack(name, categoria, region_hint)
    return any(sig in hay for sig in BR_SIGNALS)


@dataclass
class GroupCandidate:
    """Um grupo cru vindo de um site de diretório, antes de virar linha."""

    name: str = ""
    link: str = ""
    categoria: str = ""          # Categoria/Nicho (classificada se vazia)
    canal: str = "WhatsApp"
    source: str = ""             # site de diretório de origem
    region_hint: str = ""

    def dedupe_key(self) -> str:
        return normalize_link(self.link)


@dataclass
class SkipReason:
    ref: str
    reason: str


@dataclass
class FilterResult:
    accepted: list[GroupCandidate] = field(default_factory=list)
    skipped: list[SkipReason] = field(default_factory=list)

    def add_skip(self, cand: GroupCandidate, reason: str) -> None:
        ref = cand.name.strip() or cand.link.strip() or "(sem link)"
        self.skipped.append(SkipReason(ref, reason))


def filter_candidates(
    candidates: Iterable[GroupCandidate],
    existing_links: set[str],
    config: Config,
    quantity: bool = False,
) -> FilterResult:
    """Aplica dedupe + filtros. Não grava nada — só classifica.

    Sempre valem: dedupe (planilha + execução) e o corte de grupos de aposta.

    Modo padrão (quantity=False): pula grupo cuja categoria não bate esporte.
    Modo quantidade (quantity=True): se não classificar, usa "Esporte (geral)"
    (a origem já é uma categoria de esporte no site de diretório).
    """
    result = FilterResult()
    seen_this_run: set[str] = set()

    for cand in candidates:
        key = cand.dedupe_key()

        if not key:
            result.add_skip(cand, "sem link utilizável")
            continue

        if key in existing_links:
            result.add_skip(cand, "já existente na planilha")
            continue
        if key in seen_this_run:
            result.add_skip(cand, "duplicado dentro desta execução")
            continue

        if looks_like_betting(cand.name, cand.categoria):
            result.add_skip(cand, "parece grupo de aposta/palpite — pulado")
            continue

        # Se bate esporte, mantém a categoria da fonte (ou a classificada);
        # em modo quantidade, aceita como "Esporte (geral)"; senão, pula.
        classified = classify_categoria(cand.name, cand.categoria)
        if classified:
            categoria = cand.categoria.strip() or classified
        elif quantity:
            categoria = cand.categoria.strip() or "Esporte (geral)"
        else:
            result.add_skip(cand, "nicho não é esporte/e-sports")
            continue

        cand.categoria = categoria
        seen_this_run.add(key)
        result.accepted.append(cand)

    return result


def build_row(cand: GroupCandidate, config: Config) -> list[str]:
    """Converte um GroupCandidate aceito em linha de 7 colunas na ordem exata
    da Página2 real.

    Nunca inventa dados: só usa o que a fonte trouxe.
    Linguagem Zafe: nada de 'aposta/odds/cassino' nas notas.
    """
    hoje = date.today().strftime("%d/%m/%Y")
    fonte = cand.source.strip()
    notas = f"Fonte: {fonte}." if fonte else ""

    return [
        cand.canal or "WhatsApp",     # Setor (canal)
        cand.name.strip(),            # Nome do Grupo
        cand.link.strip(),            # Link do Grupo
        cand.categoria.strip(),       # Categoria/Nicho
        hoje,                         # Data coleta
        "Nao enviado",                # Status
        notas,                        # Notas
    ]
