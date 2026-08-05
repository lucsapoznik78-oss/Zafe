"""Modelo do lead, classificação de nicho, blocklist de apostas e dedupe.

Regras críticas (ver o prompt-base):
- Faixa de seguidores: 500 a 10.000 (inclusive). Fora disso -> pular.
- Só nichos de esporte/e-sports, público BR.
- Pular contas de aposta / tips de aposta.
- Nunca inventar dados: campo desconhecido fica vazio.
- Linguagem Zafe: nunca "aposta/odds/cassino" nos textos gravados.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from config import Config

# ---------------------------------------------------------------------------
# Nichos aceitos (esporte / e-sports). Chave = Setor gravado na coluna "Setor".
# Valores = palavras-chave (sem acento, minúsculas) que indicam o nicho.
# ---------------------------------------------------------------------------
NICHE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Fantasy": (
        "cartola", "fantasy", "escalacao", "mitar", "mito", "cartoleiro",
    ),
    "Futebol": (
        "futebol", "brasileirao", "serie a", "libertadores", "premier league",
        "champions", "selecao brasileira", "campeonato", "la liga", "gol",
        "tatico", "analise de jogo", "futebol europeu",
    ),
    "UFC": (
        "ufc", "mma", "octogono", "luta", "vale tudo", "jiu jitsu", "muay thai",
    ),
    "Basquete": (
        "nba", "basquete", "basketball", "nbb",
    ),
    "NFL": (
        "nfl", "futebol americano", "super bowl", "superbowl",
    ),
    "Tennis": (
        "tenis", "atp", "wta", "grand slam", "roland garros", "wimbledon",
    ),
    "Gaming-esports": (
        "e-sports", "esports", "esporte eletronico", "ea fc", "ea sports fc",
        "fifa", "cs2", "counter strike", "valorant", "league of legends", "lol",
        "free fire", "rainbow six", "gamer competitivo", "cblol",
    ),
}

# Contas de aposta / tipster: qualquer ocorrência -> pular o lead.
BETTING_BLOCKLIST: tuple[str, ...] = (
    "aposta", "apostas", "apostar", "apostador", "bet", "bets", "betting",
    "tips", "tipster", "palpite pago", "odds", "cassino", "casino", "bonus",
    "banca", "gale", "martingale", "sinais", "sinal", "mines", "aviator",
    "blaze", "bacbo", "bac bo", "tigrinho", "fortune tiger", "betano",
    "bet365", "sportingbet", "greenzada", "green certo", "entrada confirmada",
    "unidade", "stake", "handicap asiatico", "surebet",
)

# Sinais fortes de conta BR / PT-BR (heurística — nunca inventa, só ajuda a filtrar).
BR_SIGNALS: tuple[str, ...] = (
    "brasil", "brasileiro", "brasileira", "brasileirao", "pt-br", "brazil",
    "🇧🇷", "cartola", "nbb", "serie a", "cblol",
)


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def normalize_handle(raw: str) -> str:
    """@Handle, ' handle ', https://instagram.com/handle/ -> 'handle' minúsculo."""
    if not raw:
        return ""
    value = raw.strip()
    # Extrai de URL, se for URL.
    if "instagram.com" in value.lower() or value.startswith("http"):
        value = extract_handle_from_url(value) or value
    value = value.strip().lstrip("@").rstrip("/")
    return value.lower()


def extract_handle_from_url(url: str) -> str:
    m = re.search(r"instagram\.com/([A-Za-z0-9._]+)", url or "")
    return m.group(1) if m else ""


def _haystack(*parts: str) -> str:
    return strip_accents(" ".join(p for p in parts if p)).lower()


def looks_like_betting(name: str, handle: str, nicho: str) -> bool:
    hay = _haystack(name, handle, nicho)
    return any(kw in hay for kw in BETTING_BLOCKLIST)


def classify_setor(name: str, handle: str, nicho: str) -> str | None:
    """Retorna o Setor (nicho aceito) ou None se não bater nenhum nicho de esporte."""
    hay = _haystack(name, handle, nicho)
    for setor, keywords in NICHE_KEYWORDS.items():
        if any(kw in hay for kw in keywords):
            return setor
    return None


def looks_brazilian(name: str, handle: str, nicho: str, region_hint: str = "") -> bool:
    hay = _haystack(name, handle, nicho, region_hint)
    return any(sig in hay for sig in BR_SIGNALS)


@dataclass
class Candidate:
    """Um lead cru vindo de uma fonte gratuita, antes de virar linha na planilha."""

    handle: str
    name: str = ""
    followers: int | None = None
    setor: str = ""            # Setor/categoria (preenchido pela classificação se vazio)
    nicho_especifico: str = ""  # descrição curta
    contato: str = ""           # email/whatsapp público, se a fonte trouxer
    canal: str = "Instagram"
    profile_url: str = ""
    source: str = "Modash free search"
    region_hint: str = ""

    def normalized_handle(self) -> str:
        return normalize_handle(self.handle or self.profile_url)


@dataclass
class SkipReason:
    handle: str
    reason: str


@dataclass
class FilterResult:
    accepted: list[Candidate] = field(default_factory=list)
    skipped: list[SkipReason] = field(default_factory=list)

    def add_skip(self, cand: Candidate, reason: str) -> None:
        self.skipped.append(SkipReason(cand.normalized_handle() or "(sem handle)", reason))


def filter_candidates(
    candidates: Iterable[Candidate],
    existing_handles: set[str],
    config: Config,
    quantity: bool = False,
    allow_betting: bool = False,
) -> FilterResult:
    """Aplica dedupe + filtros. Não grava nada — só classifica.

    Sempre valem: dedupe (planilha + execução) e o corte de contas de aposta.

    Modo padrão (quantity=False): filtro RÍGIDO — pula seguidores desconhecidos,
    fora da faixa 500-10.000, e nicho fora de esporte/e-sports.

    Modo quantidade (quantity=True): prioriza VOLUME — não pula por seguidores
    (desconhecido vira 'verificar' na gravação) nem por faixa; e se não classificar
    o nicho, usa o Setor genérico 'Esporte' (a origem já é busca de esporte).
    """
    result = FilterResult()
    seen_this_run: set[str] = set()

    for cand in candidates:
        handle = cand.normalized_handle()

        if not handle:
            result.add_skip(cand, "sem @handle utilizável")
            continue

        if handle in existing_handles:
            result.add_skip(cand, "já existente na planilha")
            continue
        if handle in seen_this_run:
            result.add_skip(cand, "duplicado dentro desta execução")
            continue

        if not allow_betting and looks_like_betting(
            cand.name, handle, cand.nicho_especifico
        ):
            result.add_skip(cand, "parece conta de aposta/tips — pulado")
            continue

        if not quantity:
            if cand.followers is None:
                result.add_skip(cand, "seguidores desconhecidos (fonte não retornou)")
                continue
            if not (config.follower_min <= cand.followers <= config.follower_max):
                result.add_skip(
                    cand,
                    f"fora da faixa {config.follower_min}-{config.follower_max} "
                    f"(tem {cand.followers})",
                )
                continue

        setor = cand.setor or classify_setor(cand.name, handle, cand.nicho_especifico)
        if not setor:
            if quantity:
                setor = "Esporte"
            else:
                result.add_skip(cand, "nicho não é esporte/e-sports")
                continue

        cand.setor = setor
        cand.handle = handle
        seen_this_run.add(handle)
        result.accepted.append(cand)

    return result


def build_row(cand: Candidate, config: Config) -> list[str]:
    """Converte um Candidate aceito em linha de 17 colunas na ordem exata da
    planilha real (sem coluna de ID; começa em Canal).

    Nunca inventa dados: só usa o que a fonte trouxe.
    Linguagem Zafe: nada de 'aposta/odds/cassino' nas notas.
    """
    handle = cand.normalized_handle()
    profile_url = cand.profile_url.strip() or f"https://www.instagram.com/{handle}/"
    contato = cand.contato.strip() or f"@{handle}"
    ref_link = f"{config.concurso_ref_base}?ref={handle}"
    hoje = date.today().strftime("%d/%m/%Y")

    # Seguidor desconhecido nunca é inventado: fica marcado "verificar".
    seguidores = str(cand.followers) if cand.followers is not None else "verificar"

    if cand.followers is None:
        notas = (
            f"Fonte: {cand.source}. Seguidores A VERIFICAR (não confirmados). "
            f"Fantasy game de habilidade — abordar como parceria de criador."
        )
    else:
        notas = (
            f"Fonte: {cand.source}. Seguidores conforme a fonte (não estimados). "
            f"Fantasy game de habilidade — abordar como parceria de criador."
        )

    # Mapeia exatamente na ordem de config.COLUMNS (17 colunas, sem ID).
    return [
        cand.canal or "Instagram",        # Canal
        cand.setor,                       # Setor (Tópico)
        cand.name.strip(),                # Nome
        f"@{handle}",                     # @handle (Conta do Insta)
        profile_url,                      # Link do perfil (Link do Insta)
        seguidores,                       # Seguidores
        cand.nicho_especifico.strip(),    # Nicho específico (Contexto)
        contato,                          # Contato
        hoje,                             # Data coleta
        ref_link,                         # Link concurso ref
        "Nao enviado",                    # Status
        "",                               # Data envio
        "",                               # Respondeu?
        "",                               # Topou fazer?
        "Nao",                            # Divulgou?
        "Nao",                            # Follow-up feito?
        notas,                            # Notas
    ]
