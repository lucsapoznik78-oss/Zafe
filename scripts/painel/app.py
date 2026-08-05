"""Painel local Zafe — caixa de pedidos aos coletores.

Interface simples entre você e o AGENTE (Claude Code, que tem as ferramentas de
web). Você escolhe o modo (Instagram ou Grupos de WhatsApp), escreve uma
mensagem/pedido (ex.: "grupos de futebol do Flamengo", "influencers de UFC") e
envia. O pedido entra numa fila; o agente lê, garimpa na web, grava na planilha
e devolve o relatório aqui na tela.

Você NÃO precisa colar leads nem procurar nada — só pedir.

Sem dependências novas: usa só a biblioteca padrão do Python. O agente processa
os pedidos rodando este projeto (deixe o Claude Code aberto, ou peça "processa a
caixa de pedidos").

Rodar:
    python3 scripts/painel/app.py
    # abre http://localhost:8765
"""

from __future__ import annotations

import json
import time
import urllib.parse
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765

PANEL_DIR = Path(__file__).resolve().parent
INBOX = PANEL_DIR / "inbox"
PENDING = INBOX / "pending"
DONE = INBOX / "done"
for d in (PENDING, DONE):
    d.mkdir(parents=True, exist_ok=True)

MODES = {
    "insta": "Instagram (influencers → Página1)",
    "whats": "Grupos de WhatsApp (→ Página2)",
}


# ---------------------------------------------------------------------------
# Fila de pedidos
# ---------------------------------------------------------------------------
def create_request(mode: str, message: str) -> dict:
    if mode not in MODES:
        raise ValueError("modo inválido")
    message = (message or "").strip()
    if not message:
        raise ValueError("escreva o que você quer coletar")
    rid = datetime.now().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    req = {
        "id": rid,
        "mode": mode,
        "message": message,
        "status": "pendente",
        "created": time.time(),
        "report": "",
    }
    (PENDING / f"{rid}.json").write_text(
        json.dumps(req, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return req


def list_requests() -> list[dict]:
    items: list[dict] = []
    for d in (PENDING, DONE):
        for f in d.glob("*.json"):
            try:
                items.append(json.loads(f.read_text(encoding="utf-8")))
            except Exception:  # noqa: BLE001
                continue
    items.sort(key=lambda r: r.get("created", 0), reverse=True)
    return items[:30]


# ---------------------------------------------------------------------------
# HTML (renderizado no cliente a partir do JSON de /pedidos)
# ---------------------------------------------------------------------------
def page() -> str:
    return """<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Painel Zafe — Pedir ao agente</title>
<style>
  :root { --violeta:#7C5CFC; }
  * { box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    margin:0; background:#0f1020; color:#e8e8f0; }
  header { padding:18px 24px; border-bottom:1px solid #26264a; }
  header h1 { font-size:18px; margin:0; }
  header p { font-size:13px; color:#9a9ac0; margin:6px 0 0; }
  main { max-width:820px; margin:0 auto; padding:22px; display:grid; gap:22px; }
  .card { background:#17182e; border:1px solid #26264a; border-radius:12px; padding:18px; }
  .modes { display:flex; gap:10px; margin-bottom:14px; }
  .mode { flex:1; padding:12px; text-align:center; border:1px solid #33335e;
    border-radius:10px; cursor:pointer; font-size:13px; font-weight:600;
    background:#0f1020; color:#b8b8d0; }
  .mode.active { background:var(--violeta); color:#fff; border-color:var(--violeta); }
  textarea { width:100%; min-height:90px; background:#0f1020; color:#e8e8f0;
    border:1px solid #33335e; border-radius:8px; padding:12px; font-size:14px;
    resize:vertical; }
  .row { display:flex; align-items:center; gap:12px; margin-top:12px; }
  button.send { background:var(--violeta); color:#fff; border:0; border-radius:8px;
    padding:11px 18px; font-size:14px; font-weight:600; cursor:pointer; }
  button.send:disabled { opacity:.5; cursor:progress; }
  .ex { font-size:12px; color:#9a9ac0; }
  h2 { font-size:14px; margin:0 0 12px; color:#c8c8e0; }
  .req { border:1px solid #26264a; border-radius:10px; padding:12px; margin-bottom:12px;
    background:#12132480; }
  .req .top { display:flex; align-items:center; gap:10px; font-size:13px; }
  .tag { font-size:11px; padding:2px 8px; border-radius:20px; font-weight:600; }
  .tag.insta { background:#2a1f4d; color:#c9b8ff; }
  .tag.whats { background:#123a2a; color:#8ff0c0; }
  .st { margin-left:auto; font-size:11px; padding:2px 8px; border-radius:20px; font-weight:600; }
  .st.pendente { background:#4d3a12; color:#f0d68f; }
  .st.processando { background:#12324d; color:#8fd0f0; }
  .st.concluido { background:#123a2a; color:#8ff0c0; }
  .st.erro { background:#4d1212; color:#f08f8f; }
  .msg { margin:8px 0 0; font-size:13px; color:#e8e8f0; }
  .report { white-space:pre-wrap; background:#0b0b18; border:1px solid #26264a;
    border-radius:8px; padding:10px; margin-top:10px; font-size:12px; color:#c8f0d0;
    max-height:300px; overflow:auto; }
  .empty { color:#7a7a9a; font-size:13px; }
</style></head>
<body>
<header>
  <h1>Painel Zafe — Pedir ao agente</h1>
  <p>Escolha o modo, escreva o que quer coletar e envie. O agente garimpa na web,
     grava na planilha (append-only, sem duplicar, sem grupos/contas de aposta) e
     devolve o relatório abaixo. Você não precisa procurar nada.</p>
</header>
<main>
  <section class="card">
    <div class="modes">
      <div class="mode active" data-mode="whats" onclick="pick('whats')">
        Grupos de WhatsApp</div>
      <div class="mode" data-mode="insta" onclick="pick('insta')">
        Instagram (influencers)</div>
    </div>
    <textarea id="msg" placeholder="Ex.: grupos de futebol do Flamengo e Palmeiras&#10;Ex.: grupos de UFC / MMA&#10;Ex.: influencers de Cartola FC"></textarea>
    <div class="row">
      <button class="send" id="send" onclick="send()">Pedir ao agente</button>
      <span class="ex" id="ex">Ex.: "grupos de futebol", "grupos de e-sports Free Fire"</span>
    </div>
  </section>

  <section class="card">
    <h2>Pedidos</h2>
    <div id="list"><p class="empty">Nenhum pedido ainda.</p></div>
  </section>
</main>
<script>
let mode = 'whats';
const EX = {
  whats: 'Ex.: "grupos de futebol", "grupos de e-sports Free Fire", "grupos de UFC"',
  insta: 'Ex.: "influencers de Cartola FC", "creators de NBA", "perfis de tênis BR"'
};
function pick(m) {
  mode = m;
  document.querySelectorAll('.mode').forEach(e =>
    e.classList.toggle('active', e.dataset.mode === m));
  document.getElementById('ex').textContent = EX[m];
}
async function send() {
  const btn = document.getElementById('send');
  const ta = document.getElementById('msg');
  if (!ta.value.trim()) { ta.focus(); return; }
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    await fetch('/pedir', { method:'POST',
      body: new URLSearchParams({ mode, message: ta.value }) });
    ta.value = '';
    await load();
  } catch(e) { alert('Erro: '+e); }
  btn.disabled = false; btn.textContent = 'Pedir ao agente';
}
function esc(s){ return (s||'').replace(/[&<>]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function stClass(s){ return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,''); }
async function load() {
  const r = await fetch('/pedidos'); const items = await r.json();
  const el = document.getElementById('list');
  if (!items.length) { el.innerHTML = '<p class="empty">Nenhum pedido ainda.</p>'; return; }
  el.innerHTML = items.map(it => {
    const tag = it.mode === 'insta' ? 'insta' : 'whats';
    const tagLabel = it.mode === 'insta' ? 'Instagram' : 'WhatsApp';
    const st = stClass(it.status);
    const when = new Date((it.created||0)*1000).toLocaleString('pt-BR');
    const report = it.report ? '<div class="report">'+esc(it.report)+'</div>' : '';
    return `<div class="req"><div class="top">
      <span class="tag ${tag}">${tagLabel}</span>
      <span style="color:#7a7a9a;font-size:11px">${when}</span>
      <span class="st ${st}">${esc(it.status)}</span></div>
      <p class="msg">${esc(it.message)}</p>${report}</div>`;
  }).join('');
}
load(); setInterval(load, 3000);
</script>
</body></html>"""


# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: str, ctype: str = "text/plain") -> None:
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        if self.path in ("/", "/index.html"):
            self._send(200, page(), "text/html")
        elif self.path == "/pedidos":
            self._send(200, json.dumps(list_requests(), ensure_ascii=False),
                       "application/json")
        else:
            self._send(404, "não encontrado")

    def do_POST(self):  # noqa: N802
        if self.path != "/pedir":
            self._send(404, "não encontrado")
            return
        length = int(self.headers.get("Content-Length", 0))
        form = urllib.parse.parse_qs(self.rfile.read(length).decode("utf-8"))
        try:
            req = create_request(form.get("mode", [""])[0], form.get("message", [""])[0])
            self._send(200, json.dumps({"ok": True, "id": req["id"]}), "application/json")
        except ValueError as exc:
            self._send(400, json.dumps({"ok": False, "erro": str(exc)}), "application/json")

    def log_message(self, *args):
        pass


def main() -> None:
    print(f"Painel Zafe rodando em http://localhost:{PORT}")
    print(f"Pedidos ficam em: {PENDING}")
    print("Deixe o Claude Code aberto para o agente processar a fila.")
    print("Ctrl+C para parar.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
