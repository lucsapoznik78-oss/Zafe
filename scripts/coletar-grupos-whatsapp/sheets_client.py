"""Cliente da Google Sheets API (service account gratuita) — Página2.

Responsabilidades:
- Ler TODAS as linhas existentes da Página2 (grupos de WhatsApp) para montar o
  dedupe set (pelo Link do Grupo normalizado) ANTES de qualquer gravação.
- ANEXAR novas linhas depois da última preenchida — NUNCA sobrescrever
  (a planilha é co-editada).
"""

from __future__ import annotations

from dataclasses import dataclass

import gspread
from google.oauth2.service_account import Credentials

from config import COLUMNS, LINK_COL_INDEX, Config
from filters import normalize_link

# Escopo mínimo necessário: ler + anexar na planilha. Nada além disso.
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Títulos de cabeçalho reconhecidos para localizar a coluna de link.
LINK_HEADERS = ("Link do Grupo", "Link", "Link do grupo", "URL")


@dataclass
class SheetSnapshot:
    existing_links: set[str]
    header_present: bool
    row_count: int


class SheetsClient:
    def __init__(self, config: Config):
        self.config = config
        creds = Credentials.from_service_account_file(
            config.credentials_path, scopes=SCOPES
        )
        self._gc = gspread.authorize(creds)
        self._sheet = self._gc.open_by_key(config.sheet_id)
        # Página2 é a SEGUNDA aba (índice 1).
        self._ws = self._sheet.get_worksheet(config.worksheet_index)

    # -- Leitura / dedupe ---------------------------------------------------

    def snapshot(self) -> SheetSnapshot:
        """Lê a aba inteira uma vez e monta o dedupe set (pelo link)."""
        values = self._ws.get_all_values()
        if not values:
            return SheetSnapshot(set(), header_present=False, row_count=0)

        header = values[0]
        header_present = self._looks_like_header(header)
        data_rows = values[1:] if header_present else values

        idx_link = self._find_col(header, LINK_HEADERS, LINK_COL_INDEX)

        existing: set[str] = set()
        for row in data_rows:
            link_raw = row[idx_link] if len(row) > idx_link else ""
            norm = normalize_link(link_raw)
            if norm:
                existing.add(norm)

        return SheetSnapshot(
            existing_links=existing,
            header_present=header_present,
            row_count=len(data_rows),
        )

    @staticmethod
    def _find_col(header: list[str], names: tuple[str, ...], fallback: int) -> int:
        lowered = {c.strip().lower(): i for i, c in enumerate(header)}
        for name in names:
            if name.lower() in lowered:
                return lowered[name.lower()]
        return fallback

    @staticmethod
    def _looks_like_header(row: list[str]) -> bool:
        """A linha 1 é rótulo se a coluna de link não contém um link real.

        Numa linha de dados, a 3ª coluna é uma URL; num cabeçalho é 'Link do Grupo'.
        """
        cell = row[LINK_COL_INDEX].strip().lower() if len(row) > LINK_COL_INDEX else ""
        return not (cell.startswith("http") or "whatsapp.com" in cell)

    # -- Escrita (append-only) ---------------------------------------------

    def ensure_header(self, snapshot: SheetSnapshot) -> None:
        """Se a aba estiver vazia, escreve o cabeçalho de 7 colunas na linha 1."""
        if snapshot.row_count == 0 and not snapshot.header_present:
            self._ws.update("A1", [COLUMNS], value_input_option="USER_ENTERED")

    def append_rows(self, rows: list[list[str]]) -> None:
        """Anexa depois da última linha preenchida. Não sobrescreve nada."""
        if not rows:
            return
        self._ws.append_rows(
            rows,
            value_input_option="USER_ENTERED",
            insert_data_option="INSERT_ROWS",
            table_range="A1",
        )
