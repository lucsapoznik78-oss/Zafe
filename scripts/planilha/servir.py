"""Serve a fila de envio em http://localhost:8787.

Não é frescura de dev: em `file://` o navegador bloqueia `navigator.clipboard`
(contexto inseguro) e o botão "Copiar mensagem" morre calado. `localhost` conta
como contexto seguro, então a página funciona inteira.

    ./.venv/bin/python servir.py [porta] [canal]

A raiz redireciona pra fila mais recente **daquele canal**, senão a fila do
WhatsApp gerada depois roubaria a raiz do Instagram só por ser mais nova.

    8787 instagram   |   8788 whatsapp
"""
from __future__ import annotations

import glob
import http.server
import os
import socketserver
import sys

OUTBOX = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "zafe_contact",
    "outbox",
)
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
CANAL = sys.argv[2] if len(sys.argv) > 2 else "instagram"


def mais_recente() -> str | None:
    filas = glob.glob(os.path.join(OUTBOX, f"{CANAL}-fila-*.html"))
    return os.path.basename(max(filas, key=os.path.getmtime)) if filas else None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=OUTBOX, **kw)

    def do_GET(self):
        if self.path == "/":
            alvo = mais_recente()
            if not alvo:
                self.send_error(404, f"nenhuma fila de {CANAL} no outbox")
                return
            self.send_response(302)
            self.send_header("Location", "/" + alvo)
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    atual = mais_recente()
    print(f"canal: {CANAL}")
    print(f"fila:  {atual or '(nenhuma)'}")
    print(f"abra:  http://localhost:{PORTA}")
    print("ctrl+c pra parar")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORTA), Handler) as srv:
        srv.serve_forever()
