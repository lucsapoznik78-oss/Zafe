"""Runner / CLI do coletor de grupos de WhatsApp Zafe.

Gêmeo do coletor de influencers, mas grava na Página2 (grupos de esporte).

Fluxo (idempotente e append-only):
  1. Lê config do .env.
  2. Conecta na Página2 e tira um snapshot: dedupe set pelos links existentes.
  3. Carrega candidatos do CSV de harvest.
  4. Filtra: dedupe, nicho de esporte, pula grupos de aposta.
  5. Anexa os aceitos depois da última linha (nunca sobrescreve).
  6. Loga: gravados por categoria, duplicados, pulados por outros motivos.

Reexecutar só adiciona novos; nunca duplica.

Exemplos:
  python run.py --input grupos.csv --dry-run
  python run.py --input grupos.csv --quantity --limit 300
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

import csv_source
from config import Config
from filters import build_row, filter_candidates
from sheets_client import SheetsClient


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Coleta grupos de WhatsApp de esporte BR e anexa na Página2 Zafe.",
    )
    p.add_argument("--input", required=True, help="Caminho do CSV de grupos coletados.")
    p.add_argument("--limit", type=int, help="Máx. de novos grupos nesta execução.")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Faz tudo, mas NÃO grava na planilha. Só mostra o que gravaria.",
    )
    p.add_argument(
        "--quantity",
        action="store_true",
        help="Modo quantidade: nicho não classificado vira 'Esporte (geral)' "
        "(a origem já é uma categoria de esporte). Prioriza volume.",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    config = Config.from_env()

    if args.limit is not None:
        object.__setattr__(config, "limit", args.limit)

    modo = "QUANTIDADE" if args.quantity else "padrão (só nicho classificado)"
    print("== Coletor de grupos de WhatsApp Zafe ==")
    print(f"Modo: {modo} | limite: {config.limit} "
          f"| {'DRY-RUN' if args.dry_run else 'gravando'}")

    # 1) Snapshot da Página2 ANTES de coletar (dedupe).
    sheets = SheetsClient(config)
    snap = sheets.snapshot()
    print(f"Página2: {snap.row_count} linhas existentes | "
          f"{len(snap.existing_links)} links no dedupe")

    # 2) Candidatos crus do CSV.
    raw = csv_source.load_candidates(args.input)
    print(f"Candidatos crus da fonte: {len(raw)}")

    # 3) Filtro + dedupe.
    result = filter_candidates(raw, snap.existing_links, config, quantity=args.quantity)
    accepted = result.accepted[: config.limit]

    # 4) Monta as linhas (7 colunas).
    rows = [build_row(cand, config) for cand in accepted]

    # 5) Grava (append-only), a menos que seja dry-run.
    if rows and not args.dry_run:
        sheets.ensure_header(snap)
        sheets.append_rows(rows)

    _print_log(raw, result, accepted, args.dry_run)
    return 0


def _print_log(raw, result, accepted, dry_run: bool) -> None:
    print("\n----------------- RELATÓRIO -----------------")

    by_cat = Counter(c.categoria for c in accepted)
    print("Gravados por categoria:")
    if by_cat:
        for cat, n in sorted(by_cat.items()):
            print(f"  - {cat}: {n}")
    else:
        print("  (nenhum)")

    dup = [s for s in result.skipped if "existente" in s.reason or "duplicado" in s.reason]
    outros = [s for s in result.skipped if s not in dup]

    print(f"\nTotal crus........: {len(raw)}")
    print(f"{'Gravaria' if dry_run else 'Gravados'}..........: {len(accepted)}"
          f"{'  (DRY-RUN, nada foi escrito)' if dry_run else ''}")
    print(f"Pulados (duplicados): {len(dup)}")
    print(f"Pulados (outros)....: {len(outros)}")

    if outros:
        print("\nMotivos dos 'outros':")
        reasons = Counter(s.reason for s in outros)
        for reason, n in reasons.most_common():
            print(f"  - {reason}: {n}")

    if accepted:
        print(f"\nGrupos {'que seriam gravados' if dry_run else 'gravados'}:")
        for c in accepted:
            print(f"  {c.name} — {c.categoria} — {c.link}")
    print("---------------------------------------------")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
