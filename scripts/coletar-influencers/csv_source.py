"""Fonte CSV — caminho PRIMÁRIO e 100% sem risco de ToS.

Fluxo recomendado (ver README):
  1. Você abre a busca gratuita da Modash no navegador, filtra por Brasil +
     nicho de esporte + faixa 500-10.000 seguidores.
  2. Copia os candidatos (handle, nome, seguidores, nicho) para um CSV.
  3. Este módulo lê esse CSV, e o runner filtra/deduplica/anexa na planilha.

Nunca inventa dados: só lê o que está no CSV. Cabeçalhos são flexíveis
(aceita variações comuns em PT/EN).
"""

from __future__ import annotations

import csv
from pathlib import Path

from filters import Candidate

# Mapeia nomes de coluna aceitos -> campo do Candidate. Tudo minúsculo.
_HEADER_ALIASES: dict[str, str] = {
    "handle": "handle",
    "@handle": "handle",
    "usuario": "handle",
    "username": "handle",
    "user": "handle",
    "nome": "name",
    "name": "name",
    "perfil": "name",
    "seguidores": "followers",
    "followers": "followers",
    "seguidores_qtd": "followers",
    "setor": "setor",
    "categoria": "setor",
    "category": "setor",
    "nicho": "nicho_especifico",
    "nicho_especifico": "nicho_especifico",
    "nicho específico": "nicho_especifico",
    "niche": "nicho_especifico",
    "bio": "nicho_especifico",
    "contato": "contato",
    "contact": "contato",
    "email": "contato",
    "link": "profile_url",
    "link do perfil": "profile_url",
    "profile_url": "profile_url",
    "url": "profile_url",
    "regiao": "region_hint",
    "região": "region_hint",
    "region": "region_hint",
    "pais": "region_hint",
    "país": "region_hint",
    "country": "region_hint",
}


def _parse_followers(raw: str) -> int | None:
    if raw is None:
        return None
    cleaned = raw.strip().lower().replace(".", "").replace(",", "").replace(" ", "")
    if not cleaned:
        return None
    mult = 1
    if cleaned.endswith("k"):
        mult = 1_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("m"):
        mult = 1_000_000
        cleaned = cleaned[:-1]
    try:
        return int(float(cleaned) * mult)
    except ValueError:
        return None


def load_candidates(csv_path: str) -> list[Candidate]:
    path = Path(csv_path)
    if not path.exists():
        raise SystemExit(f"CSV não encontrado: {csv_path}")

    candidates: list[Candidate] = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None:
            raise SystemExit("CSV vazio ou sem cabeçalho.")

        # Resolve o mapeamento cabeçalho-do-arquivo -> campo do Candidate.
        field_map: dict[str, str] = {}
        for col in reader.fieldnames:
            key = (col or "").strip().lower()
            if key in _HEADER_ALIASES:
                field_map[col] = _HEADER_ALIASES[key]

        if "handle" not in field_map.values() and "profile_url" not in field_map.values():
            raise SystemExit(
                "CSV precisa de uma coluna de handle ou de link do perfil "
                "(ex.: 'handle', 'usuario', 'link')."
            )

        for raw in reader:
            data: dict[str, str] = {}
            followers: int | None = None
            for col, field_name in field_map.items():
                value = (raw.get(col) or "").strip()
                if field_name == "followers":
                    followers = _parse_followers(value)
                else:
                    data[field_name] = value

            handle = data.get("handle", "") or data.get("profile_url", "")
            if not handle:
                continue

            candidates.append(
                Candidate(
                    handle=data.get("handle", ""),
                    name=data.get("name", ""),
                    followers=followers,
                    setor=data.get("setor", ""),
                    nicho_especifico=data.get("nicho_especifico", ""),
                    contato=data.get("contato", ""),
                    profile_url=data.get("profile_url", ""),
                    region_hint=data.get("region_hint", ""),
                    source="Modash free search (export CSV manual)",
                )
            )

    return candidates
