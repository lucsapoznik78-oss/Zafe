"""Runner / CLI do coletor de micro-influencers Zafe.

Fluxo (idempotente e append-only):
  1. Lê config do .env.
  2. Conecta na planilha e tira um snapshot: dedupe set (@handle + link) + maior ID.
  3. Carrega candidatos da fonte escolhida (csv | modash).
  4. Filtra: dedupe, faixa de seguidores, nicho de esporte, pula contas de aposta.
  5. Anexa os aceitos depois da última linha (nunca sobrescreve).
  6. Loga: achados por nicho, gravados, pulados por duplicidade, pulados por outros motivos.

Reexecutar só adiciona novos; nunca duplica.

Exemplos:
  python run.py --source csv --input candidatos.csv
  python run.py --source csv --input candidatos.csv --dry-run
  python run.py --source modash --niches futebol,ufc,nba --limit 30
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

import csv_source
import modash_free
from config import Config
from filters import build_row, filter_candidates
from sheets_client import SheetsClient

DEFAULT_NICHES = [
    "futebol",
    "cartola",
    "ufc",
    "nba basquete",
    "nfl futebol americano",
    "tenis",
    "ea fc esports",
]


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Coleta micro-influencers de esporte BR e anexa na planilha Zafe.",
    )
    p.add_argument(
        "--source",
        choices=["csv", "modash"],
        default="csv",
        help="Fonte dos candidatos. 'csv' (recomendado) ou 'modash' (best-effort).",
    )
    p.add_argument("--input", help="Caminho do CSV (obrigatório para --source csv).")
    p.add_argument(
        "--niches",
        help="Lista de nichos separada por vírgula (só para --source modash).",
    )
    p.add_argument("--limit", type=int, help="Máx. de novos leads nesta execução.")
    p.add_argument("--min", type=int, dest="follower_min", help="Seguidores mínimos.")
    p.add_argument("--max", type=int, dest="follower_max", help="Seguidores máximos.")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Faz tudo, mas NÃO grava na planilha. Só mostra o que gravaria.",
    )
    p.add_argument(
        "--quantity",
        action="store_true",
        help="Modo quantidade: não filtra por faixa de seguidores; desconhecido vira "
        "'verificar'. Prioriza volume sobre qualificação.",
    )
    p.add_argument(
        "--allow-betting",
        action="store_true",
        dest="allow_betting",
        help="Inclui criadores de nicho bet/palpite (captação de público — a Zafe "
        "é fantasy legal). Por padrão essas contas são puladas.",
    )
    return p.parse_args(argv)


def load_candidates(args: argparse.Namespace, config: Config):
    if args.source == "csv":
        if not args.input:
            raise SystemExit("--source csv exige --input caminho/para/candidatos.csv")
        return csv_source.load_candidates(args.input)

    # source == modash
    niches = (
        [n.strip() for n in args.niches.split(",") if n.strip()]
        if args.niches
        else DEFAULT_NICHES
    )
    try:
        return modash_free.collect(config, niches, config.limit)
    except modash_free.ModashUnavailable as exc:
        raise SystemExit(f"\n[fonte gratuita indisponível]\n{exc}\n")


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    config = Config.from_env()

    # Overrides de CLI sobre o .env.
    if args.limit is not None:
        object.__setattr__(config, "limit", args.limit)
    if args.follower_min is not None:
        object.__setattr__(config, "follower_min", args.follower_min)
    if args.follower_max is not None:
        object.__setattr__(config, "follower_max", args.follower_max)

    modo = "QUANTIDADE (sem filtro de faixa)" if args.quantity else \
        f"faixa {config.follower_min}-{config.follower_max}"
    print("== Coletor de micro-influencers Zafe ==")
    print(f"Fonte: {args.source} | {modo} | limite: {config.limit} "
          f"| {'DRY-RUN' if args.dry_run else 'gravando'}")

    # 1) Snapshot da planilha ANTES de coletar (dedupe).
    sheets = SheetsClient(config)
    snap = sheets.snapshot()
    print(f"Planilha: {snap.row_count} linhas existentes | "
          f"{len(snap.existing_handles)} handles no dedupe")

    # 2) Candidatos crus da fonte.
    raw = load_candidates(args, config)
    print(f"Candidatos crus da fonte: {len(raw)}")

    # 3) Filtro + dedupe.
    result = filter_candidates(
        raw, snap.existing_handles, config,
        quantity=args.quantity, allow_betting=args.allow_betting,
    )
    accepted = result.accepted[: config.limit]

    # 4) Monta as linhas (17 colunas, sem ID).
    rows = [build_row(cand, config) for cand in accepted]

    # 5) Grava (append-only), a menos que seja dry-run.
    if rows and not args.dry_run:
        sheets.ensure_header(snap)
        sheets.append_rows(rows)

    _print_log(raw, result, accepted, args.dry_run)
    return 0


def _print_log(raw, result, accepted, dry_run: bool) -> None:
    print("\n----------------- RELATÓRIO -----------------")

    by_setor = Counter(c.setor for c in accepted)
    print("Gravados por setor:")
    if by_setor:
        for setor, n in sorted(by_setor.items()):
            print(f"  - {setor}: {n}")
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
        print(f"\nHandles {'que seriam gravados' if dry_run else 'gravados'}:")
        for c in accepted:
            print(f"  @{c.normalized_handle()} — {c.setor} — {c.followers} seg.")
    print("---------------------------------------------")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
