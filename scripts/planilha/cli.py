"""CLI mínima da planilha de captação — é o único jeito dos agents A2..A7 e
W2..W6 tocarem a planilha.

Não há orquestração aqui: nenhum comando decide o que fazer com um lead. Quem
julga é o agent (o markdown em `zafe_contact/Agents/`); este arquivo só lê e
grava, respeitando o contrato da planilha co-editada (ver `sheets.py`).

    python cli.py contar --aba ig
    python cli.py ler    --aba ig --status Novo --limit 50
    python cli.py set    --aba ig --linha 42 --campo status --valor Qualificado \\
                         --se-status Novo
    python cli.py nota   --aba ig --linha 42 --texto "gancho=analise do Palmeiras"

`--se-status` é a trava de idempotência: relê a célula de Status imediatamente
antes de escrever e aborta se outro agent (ou você, na aba aberta) já mudou o
estado. Use sempre que o agent estiver avançando um lead de um estado pro outro.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter

from config import IG_COLS, WA_COLS, Config
from sheets import Sheet
from status import normalize

ABAS = {
    "ig": (0, IG_COLS),   # Página1 — influencers do Instagram
    "wa": (1, WA_COLS),   # Página2 — grupos de WhatsApp
}


def abrir(aba: str) -> Sheet:
    cfg = Config.from_env()
    ws_index, cols = ABAS[aba]
    return Sheet(cfg.credentials_path, cfg.sheet_id, ws_index, cols)


def cmd_contar(args: argparse.Namespace) -> int:
    sheet = abrir(args.aba)
    contagem = Counter(row.status.value for row in sheet.rows_in())
    for estado, n in contagem.most_common():
        print(f"{n:>5}  {estado}")
    print(f"{sum(contagem.values()):>5}  TOTAL")
    return 0


def cmd_ler(args: argparse.Namespace) -> int:
    sheet = abrir(args.aba)
    alvos = [normalize(s) for s in args.status] if args.status else []
    linhas = sheet.rows_in(*alvos)
    if args.limit:
        linhas = linhas[: args.limit]
    print(
        json.dumps(
            [
                {
                    "linha": r.number,
                    **{k: sheet.get(r, k) for k in sheet.cols},
                    "status": r.status.value,  # normalizado, sobrepõe a célula crua
                }
                for r in linhas
            ],
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def cmd_set(args: argparse.Namespace) -> int:
    sheet = abrir(args.aba)
    if args.campo not in sheet.cols:
        sys.exit(f"campo desconhecido: {args.campo}. Válidos: {', '.join(sheet.cols)}")
    if args.se_status:
        atual = sheet.reread_status(args.linha)
        if atual != normalize(args.se_status):
            print(f"pulado: linha {args.linha} está em '{atual.value}', não '{args.se_status}'")
            return 0
    sheet.set_cell(args.linha, args.campo, args.valor)
    print(f"linha {args.linha}: {args.campo} = {args.valor}")
    return 0


def cmd_nota(args: argparse.Namespace) -> int:
    sheet = abrir(args.aba)
    # append_note precisa do conteúdo atual de Notas para não sobrescrever.
    alvo = next((r for r in sheet.rows_in() if r.number == args.linha), None)
    if alvo is None:
        sys.exit(f"linha {args.linha} não existe na aba {args.aba}")
    sheet.append_note(alvo, args.texto)
    print(f"linha {args.linha}: nota anexada")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    def com_aba(p: argparse.ArgumentParser) -> argparse.ArgumentParser:
        p.add_argument("--aba", choices=ABAS, required=True)
        return p

    com_aba(sub.add_parser("contar")).set_defaults(fn=cmd_contar)

    p_ler = com_aba(sub.add_parser("ler"))
    p_ler.add_argument("--status", nargs="*", help="filtra por um ou mais estados")
    p_ler.add_argument("--limit", type=int, default=0)
    p_ler.set_defaults(fn=cmd_ler)

    p_set = com_aba(sub.add_parser("set"))
    p_set.add_argument("--linha", type=int, required=True)
    p_set.add_argument("--campo", required=True)
    p_set.add_argument("--valor", required=True)
    p_set.add_argument("--se-status", dest="se_status", help="trava de idempotência")
    p_set.set_defaults(fn=cmd_set)

    p_nota = com_aba(sub.add_parser("nota"))
    p_nota.add_argument("--linha", type=int, required=True)
    p_nota.add_argument("--texto", required=True)
    p_nota.set_defaults(fn=cmd_nota)

    args = parser.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
