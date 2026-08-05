"""Cliente da Google Sheets API (service account gratuita).

Responsabilidades:
- Ler TODAS as linhas existentes da Página1 (gid=0) para montar o dedupe set
  (@handle + Link do perfil, normalizados) ANTES de qualquer gravação.
- Descobrir o maior ID já existente para continuar a sequência.
- ANEXAR novas linhas depois da última preenchida — NUNCA sobrescrever
  (a planilha é co-editada).

Regra 4/5 do CLAUDE.md: nunca sobrescrever dados; só append.
"""

from __future__ import annotations

from dataclasses import dataclass

import gspread
from google.oauth2.service_account import Credentials

from config import COLUMNS, HANDLE_COL_INDEX, LINK_COL_INDEX, Config
from filters import normalize_handle

# Escopo mínimo necessário: ler + anexar na planilha. Nada além disso.
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Títulos de cabeçalho reconhecidos para localizar as colunas de identidade,
# cobrindo os títulos reais da planilha ("Conta do Insta" / "Link do Insta").
HANDLE_HEADERS = ("@handle", "Conta do Insta", "Conta do Instagram", "Handle")
LINK_HEADERS = ("Link do perfil", "Link do Insta", "Link do Instagram")


@dataclass
class SheetSnapshot:
    existing_handles: set[str]
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
        # Página1 é a PRIMEIRA aba (gid=0).
        self._ws = self._sheet.get_worksheet(0)

    # -- Leitura / dedupe ---------------------------------------------------

    def snapshot(self) -> SheetSnapshot:
        """Lê a aba inteira uma vez e monta o dedupe set (@handle + link)."""
        values = self._ws.get_all_values()
        if not values:
            return SheetSnapshot(set(), header_present=False, row_count=0)

        header = values[0]
        header_present = self._looks_like_header(header)
        data_rows = values[1:] if header_present else values

        idx_handle = self._find_col(header, HANDLE_HEADERS, HANDLE_COL_INDEX)
        idx_link = self._find_col(header, LINK_HEADERS, LINK_COL_INDEX)

        existing: set[str] = set()
        for row in data_rows:
            handle_raw = row[idx_handle] if len(row) > idx_handle else ""
            link_raw = row[idx_link] if len(row) > idx_link else ""
            for candidate in (handle_raw, link_raw):
                norm = normalize_handle(candidate)
                if norm:
                    existing.add(norm)

        return SheetSnapshot(
            existing_handles=existing,
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
        """A linha 1 é rótulo se a coluna de @handle não contém um @/URL de perfil.

        Numa linha de dados real, a 4ª coluna é '@usuario'; num cabeçalho é um
        rótulo como 'Conta do Insta'.
        """
        cell = row[HANDLE_COL_INDEX].strip().lower() if len(row) > HANDLE_COL_INDEX else ""
        return not (cell.startswith("@") or "instagram.com" in cell)

    # -- Escrita (append-only) ---------------------------------------------

    def ensure_header(self, snapshot: SheetSnapshot) -> None:
        """Se a aba estiver vazia, escreve o cabeçalho de 17 colunas na linha 1."""
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
