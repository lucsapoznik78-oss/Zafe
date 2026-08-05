"""Fonte CSV — caminho PRIMÁRIO e estável.

Fluxo (ver README / subagente):
  1. O agente coleta grupos de esporte dos sites de diretório
     (gruposwhats.app, zapgrupos.com, grupodewhatsapp.com, linkdegrupo.com.br)
     e monta um CSV com: nome, link, categoria (, fonte).
  2. Este módulo lê esse CSV, e o runner filtra/deduplica/anexa na Página2.

Nunca inventa dados: só lê o que está no CSV. Cabeçalhos são flexíveis.
"""

from __future__ import annotations

import csv
from pathlib import Path

from filters import GroupCandidate

# Mapeia nomes de coluna aceitos -> campo do GroupCandidate. Tudo minúsculo.
_HEADER_ALIASES: dict[str, str] = {
    "nome": "name",
    "name": "name",
    "grupo": "name",
    "nome do grupo": "name",
    "titulo": "name",
    "link": "link",
    "url": "link",
    "link do grupo": "link",
    "convite": "link",
    "categoria": "categoria",
    "categoria/nicho": "categoria",
    "nicho": "categoria",
    "category": "categoria",
    "setor": "categoria",
    "fonte": "source",
    "source": "source",
    "site": "source",
    "origem": "source",
    "regiao": "region_hint",
    "região": "region_hint",
    "region": "region_hint",
    "pais": "region_hint",
    "país": "region_hint",
    "country": "region_hint",
}


def load_candidates(csv_path: str) -> list[GroupCandidate]:
    path = Path(csv_path)
    if not path.exists():
        raise SystemExit(f"CSV não encontrado: {csv_path}")

    candidates: list[GroupCandidate] = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None:
            raise SystemExit("CSV vazio ou sem cabeçalho.")

        field_map: dict[str, str] = {}
        for col in reader.fieldnames:
            key = (col or "").strip().lower()
            if key in _HEADER_ALIASES:
                field_map[col] = _HEADER_ALIASES[key]

        if "link" not in field_map.values():
            raise SystemExit(
                "CSV precisa de uma coluna de link do grupo (ex.: 'link', 'url')."
            )

        for raw in reader:
            data: dict[str, str] = {}
            for col, field_name in field_map.items():
                data[field_name] = (raw.get(col) or "").strip()

            if not data.get("link"):
                continue

            candidates.append(
                GroupCandidate(
                    name=data.get("name", ""),
                    link=data.get("link", ""),
                    categoria=data.get("categoria", ""),
                    source=data.get("source", ""),
                    region_hint=data.get("region_hint", ""),
                )
            )

    return candidates
