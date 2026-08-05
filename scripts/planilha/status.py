"""Máquina de estados do loop de abordagem — a coluna Status É o cérebro.

Nenhum agente guarda memória. Todo o estado vive na coluna `Status` da planilha.
Cada agente processa APENAS as linhas no estado que o dispara, relê o Status
antes de agir (idempotência) e, em caso de erro, marca `Erro` e segue o lote
(isolamento de falha).

Fluxo (Instagram e WhatsApp):
  Novo ─A2/W2─> Qualificado ─A3/W3─> Aprovado ─A4/W4─> Na fila
       └─────> Rejeitado (terminal)
  Na fila ─VOCÊ ENVIA + confirmar_envio.py─> Enviado
  Enviado ─A5/W5─> Respondeu ─A6/W6─> Topou
          └─────> Sem resposta (timeout 3 dias)
          └─────> Recusou (terminal)

A copy é auto-aprovada pelo validador de compliance (sem gate humano).
O ENVIO é humano: o A4/W4 só monta o outbox e para em `Na fila`. Só o
`confirmar_envio.py` marca `Enviado` — assim o timeout do A5 conta a partir da
data real de envio e a taxa de resposta do relatório reflete a realidade.

O coletor grava o estado inicial como "Nao enviado" (histórico). Normalizamos
"Nao enviado" -> "Novo" na leitura para unificar as duas planilhas.
"""

from __future__ import annotations

from enum import Enum


class Status(str, Enum):
    NOVO = "Novo"
    QUALIFICADO = "Qualificado"
    REJEITADO = "Rejeitado"
    ENGATILHADO = "Engatilhado"
    APROVADO = "Aprovado"
    NA_FILA = "Na fila"
    ENVIADO = "Enviado"
    RESPONDEU = "Respondeu"
    SEM_RESPOSTA = "Sem resposta"
    TOPOU = "Topou"
    RECUSOU = "Recusou"
    ERRO = "Erro"


# Estado inicial legado gravado pelos coletores.
_ALIASES = {
    "nao enviado": Status.NOVO,
    "não enviado": Status.NOVO,
    "": Status.NOVO,
}

# Estados terminais: nenhum agente os reprocessa.
TERMINAIS = {Status.REJEITADO, Status.TOPOU, Status.RECUSOU, Status.SEM_RESPOSTA}


def normalize(raw: str) -> Status:
    """Converte o texto cru da célula Status num membro do enum.

    "Nao enviado"/vazio -> Novo. Texto desconhecido -> Erro (para revisão humana),
    nunca um palpite silencioso.
    """
    key = (raw or "").strip()
    low = key.lower()
    if low in _ALIASES:
        return _ALIASES[low]
    for st in Status:
        if st.value.lower() == low:
            return st
    return Status.ERRO


def is_terminal(status: Status) -> bool:
    return status in TERMINAIS
