"""Acesso à planilha viva (Google Sheets API, service account gratuita).

Contrato de segurança (regra 4/5 do CLAUDE.md — a planilha é co-editada):
- NUNCA sobrescrever uma linha inteira nem reordenar colunas.
- Só duas escritas são permitidas: (1) atualizar UMA célula por vez;
  (2) anexar texto na coluna Notas (append-only, preservando o que já existe).
- Antes de agir sobre uma linha, o agente RELÊ o Status daquela linha
  (idempotência): se outro agente/humano já mudou o estado, ele pula.

Cada linha é entregue como um `Row` com o número real na planilha (1-based),
para que o update mire a célula exata.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from datetime import date

import gspread
from google.oauth2.service_account import Credentials

from status import Status, normalize

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# A API do Sheets corta em 60 leituras/min E 60 escritas/min por usuário (cotas
# separadas). Ficamos abaixo das duas e, se ainda assim vier 429, esperamos e
# tentamos de novo — em vez de morrer no meio do lote e deixar a planilha num
# estado parcial. Sem isso, um lote de 80+ leads estoura a cota na certa.
_MAX_POR_JANELA = 50
_JANELA_SEG = 60.0
_TENTATIVAS = 5


@dataclass
class Row:
    number: int           # linha real na planilha (1-based, inclui cabeçalho)
    values: list[str]     # células da linha, na ordem das colunas
    status: Status


class Sheet:
    """Wrapper de UMA aba (Página1 ou Página2), com o mapa de colunas dela."""

    def __init__(self, credentials_path: str, sheet_id: str, ws_index: int, cols: dict[str, int]):
        creds = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
        self._gc = gspread.authorize(creds)
        self._book = self._gc.open_by_key(sheet_id)
        self._ws = self._book.get_worksheet(ws_index)
        self.cols = cols
        self._escritas: deque[float] = deque()
        self._leituras: deque[float] = deque()

    # -- Leitura ------------------------------------------------------------

    def rows_in(self, *wanted: Status) -> list[Row]:
        """Todas as linhas de dados cujo Status normalizado está em `wanted`.

        Linha 1 é cabeçalho e é ignorada. `wanted` vazio devolve todas.
        """
        idx = self.cols["status"]
        out: list[Row] = []
        self._aguardar(self._leituras)
        for i, raw in enumerate(self._ws.get_all_values()):
            if i == 0:
                continue  # cabeçalho
            st = normalize(raw[idx] if len(raw) > idx else "")
            if not wanted or st in wanted:
                out.append(Row(number=i + 1, values=raw, status=st))
        return out

    def reread_status(self, row_number: int) -> Status:
        """Relê só a célula de Status de uma linha (checagem de idempotência).

        Aplica o mesmo retry com back-off das escritas: lotes grandes de leads
        (ex.: 80+) disparariam 429 sem isso (cota: 60 leituras/min por usuário).
        """
        col = self.cols["status"] + 1  # gspread é 1-based
        for tentativa in range(_TENTATIVAS):
            self._aguardar(self._leituras)
            try:
                raw = self._ws.cell(row_number, col).value
                return normalize(raw or "")
            except gspread.exceptions.APIError as exc:
                if exc.response.status_code != 429 or tentativa == _TENTATIVAS - 1:
                    raise
                self._leituras.clear()
                time.sleep(2 ** tentativa * 5)

    def get(self, row: Row, key: str) -> str:
        idx = self.cols[key]
        return row.values[idx] if len(row.values) > idx else ""

    # -- Escrita (célula única / append em Notas) ---------------------------

    @staticmethod
    def _aguardar(janela: deque[float]) -> None:
        """Segura a chamada até ela caber na janela de 1 min daquela cota."""
        agora = time.monotonic()
        while janela and agora - janela[0] >= _JANELA_SEG:
            janela.popleft()
        if len(janela) >= _MAX_POR_JANELA:
            espera = _JANELA_SEG - (agora - janela[0]) + 0.5
            if espera > 0:
                time.sleep(espera)
            janela.clear()
        janela.append(time.monotonic())

    def set_cell(self, row_number: int, key: str, value: str) -> None:
        col = self.cols[key] + 1
        for tentativa in range(_TENTATIVAS):
            self._aguardar(self._escritas)
            try:
                self._ws.update_cell(row_number, col, value)
                return
            except gspread.exceptions.APIError as exc:
                if exc.response.status_code != 429 or tentativa == _TENTATIVAS - 1:
                    raise
                self._escritas.clear()
                time.sleep(2 ** tentativa * 5)

    def set_status(self, row_number: int, status: Status) -> None:
        self.set_cell(row_number, "status", status.value)

    def append_note(self, row: Row, text: str) -> None:
        """Anexa uma linha datada em Notas sem apagar o conteúdo anterior."""
        idx = self.cols["notas"]
        prev = row.values[idx] if len(row.values) > idx else ""
        stamp = date.today().isoformat()
        combined = (prev + "\n" if prev else "") + f"[{stamp}] {text}"
        self.set_cell(row.number, "notas", combined)
