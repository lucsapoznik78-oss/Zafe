"""Página de trabalho pra conseguir autorização dos admins (Página2).

Não escreve nada na planilha. A autorização é conseguida por você, por fora — esta
página só junta numa tela o que você precisa: o link que abre o grupo, se o convite
ainda está vivo, o pedido pro admin e a mensagem que vai no grupo depois.

    ./.venv/bin/python fila_whats.py [quantos]
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime
import html
import os
import re
import sys
import urllib.request

from config import WA_COLS, Config, achar_proibida
from sheets import Sheet
from status import Status

QUANTOS = int(sys.argv[1]) if len(sys.argv) > 1 else 20
OUTBOX = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "zafe_contact",
    "outbox",
)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

# Pedido de autorização — vai na DM do admin, não no grupo.
PEDIDO = (
    "Opa, tudo certo? Tô ajudando a Zafe, um fantasy game de esporte que ainda tá "
    "em beta — de graça, é só entrar e jogar. Queria te pedir permissão pra mandar "
    "uma mensagem no {grupo} apresentando pra galera, e a ideia é montar uma liga "
    "com o nome do grupo pro pessoal competir entre si. Se não fizer sentido, sem "
    "problema nenhum. Pode ser?"
)

# Mensagem que vai DENTRO do grupo depois de liberado (W3 padrao v1).
POST = (
    "Galera, quem curte {tema} tem que testar isso: achei um fantasy game de "
    "esporte chamado Zafe, tá em beta ainda mas já dá pra jogar de graça — prever "
    "resultado, montar time, competir com a galera, tipo o Cartola. zafe.app.br, "
    "é rapidinho de entrar. Alguém topa jogar junto?"
)


def tema_de(categoria: str) -> str:
    dentro = re.search(r"\(([^)]+)\)", categoria)
    if dentro:
        return dentro.group(1).strip()
    return categoria.split("/")[0].strip() or "esporte"


def codigo_de(link: str) -> str | None:
    m = re.search(r"(?:chat\.whatsapp\.com|ongrupos\.com/grupo)/([A-Za-z0-9]{15,30})", link)
    return m.group(1) if m else None


def checar(codigo: str):
    """Devolve (vivo, nome_real). Convite revogado nao traz o og:description."""
    url = f"https://chat.whatsapp.com/{codigo}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            corpo = r.read(60000).decode("utf-8", "ignore")
    except Exception as e:
        return None, f"erro: {type(e).__name__}"
    titulo = re.search(r'og:title" content="([^"]*)"', corpo)
    desc = re.search(r'og:description" content="([^"]*)"', corpo)
    vivo = bool(desc and "Group Invite" in desc.group(1))
    return vivo, (titulo.group(1) if titulo else "")


cfg = Config.from_env()
sheet = Sheet(cfg.credentials_path, cfg.sheet_id, 1, WA_COLS)
todas = sheet.rows_in(Status.NOVO)
alvos = todas[:QUANTOS]
print(f"{len(todas)} em Novo — pegando os {len(alvos)} primeiros", flush=True)

itens = []
for i, row in enumerate(alvos, 1):
    link = sheet.get(row, "link")
    itens.append({
        "n": i,
        "linha": row.number,
        "nome": sheet.get(row, "nome"),
        "categoria": sheet.get(row, "categoria"),
        "tema": tema_de(sheet.get(row, "categoria")),
        "codigo": codigo_de(link),
        "origem": link,
    })

print("checando os convites...", flush=True)
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    futuros = {
        ex.submit(checar, it["codigo"]): it for it in itens if it["codigo"]
    }
    for fut in cf.as_completed(futuros):
        it = futuros[fut]
        it["vivo"], it["nome_real"] = fut.result()

for it in itens:
    it.setdefault("vivo", None)
    it.setdefault("nome_real", "")

# --- compliance: as duas copies passam pelo mesmo filtro dos redatores --------
for texto, quem in ((PEDIDO.format(grupo="grupo"), "PEDIDO"),
                    (POST.format(tema="futebol"), "POST")):
    achada = achar_proibida(texto)
    if achada:
        raise SystemExit(f"{quem} tem palavra proibida: {achada!r}")
    if POST is texto and texto.lower().count("zafe.app.br") != 1:
        raise SystemExit("POST precisa de exatamente um link")

cartoes = []
for it in itens:
    if it["vivo"] is True:
        selo, cls = "convite vivo", "ok"
    elif it["vivo"] is False:
        selo, cls = "convite expirado", "morto"
    else:
        selo, cls = (it["nome_real"] or "nao checado"), "duvida"
    nome = html.escape(it["nome_real"] or it["nome"])
    convite = f"https://chat.whatsapp.com/{it['codigo']}" if it["codigo"] else it["origem"]
    divergiu = (
        f'<span class="tag alerta">na planilha: {html.escape(it["nome"])}</span>'
        if it["nome_real"] and it["nome_real"].strip() != it["nome"].strip() else ""
    )
    cartoes.append(f"""
<article class="card {cls}">
  <header>
    <span class="n">{it['n']}</span>
    <a class="grupo" href="{html.escape(convite)}" target="_blank" rel="noopener">{nome}</a>
    <span class="tag">{html.escape(it['tema'])}</span>
    <span class="tag selo {cls}">{selo}</span>{divergiu}
    <span class="tag linha">linha {it['linha']}</span>
    <label class="feito"><input type="checkbox" data-n="{it['n']}"> autorizado</label>
  </header>
  <div class="bloco">
    <h3>1. pedir pro admin <small>na DM dele</small></h3>
    <p class="msg pedido">{html.escape(PEDIDO.format(grupo=nome))}</p>
    <button class="copiar" type="button">Copiar pedido</button>
  </div>
  <div class="bloco depois">
    <h3>2. só depois de liberado, postar no grupo</h3>
    <p class="msg">{html.escape(POST.format(tema=it['tema']))}</p>
    <button class="copiar" type="button">Copiar mensagem do grupo</button>
  </div>
</article>""")

carimbo = datetime.datetime.now().strftime("%Y%m%d-%H%M")
destino = os.path.join(OUTBOX, f"whatsapp-fila-{carimbo}.html")
vivos = sum(1 for i in itens if i["vivo"] is True)
mortos = sum(1 for i in itens if i["vivo"] is False)

doc = f"""<!doctype html>
<html lang="pt-br">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grupos WhatsApp — autorizacao</title>
<style>
  :root {{ --verde:#1e9e63; --roxo:#7C5CFC; --azul:#0d6efd; --borda:#e2e6e3; }}
  * {{ box-sizing:border-box }}
  body {{ margin:0; padding:0 0 80px; background:#f5f7f6; color:#16261f;
         font:19px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif }}
  .topo {{ position:sticky; top:0; z-index:5; background:var(--verde); color:#fff;
           padding:18px 28px; display:flex; align-items:baseline; gap:18px;
           flex-wrap:wrap; box-shadow:0 2px 12px rgba(0,0,0,.15) }}
  .topo h1 {{ margin:0; font-size:23px }}
  .topo .contador {{ margin-left:auto; font-size:17px }}
  .wrap {{ max-width:900px; margin:0 auto; padding:0 20px }}
  .aviso {{ background:#fff8e6; border:1px solid #f0d79a; border-left:5px solid #e8a33d;
            border-radius:10px; padding:16px 20px; margin:24px 0; font-size:17px }}
  .card {{ background:#fff; border:1px solid var(--borda); border-radius:12px;
           padding:20px 22px; margin-bottom:18px }}
  .card.ok2 {{ opacity:.45 }}
  .card.morto {{ opacity:.55; border-left:5px solid #c0392b }}
  .card header {{ display:flex; align-items:center; flex-wrap:wrap; gap:10px;
                  margin-bottom:14px }}
  .n {{ font-size:15px; color:#7d8b85; min-width:30px; font-variant-numeric:tabular-nums }}
  a.grupo {{ font-size:25px; font-weight:700; color:var(--azul);
             text-decoration:underline; text-underline-offset:3px }}
  a.grupo:hover {{ color:#0a58ca }}
  .tag {{ font-size:14px; background:#eef1ef; color:#4a5a53; padding:3px 10px;
          border-radius:20px }}
  .tag.selo.ok {{ background:#e3f6ec; color:#12704a }}
  .tag.selo.morto {{ background:#fdeceb; color:#a4302a; font-weight:600 }}
  .tag.selo.duvida {{ background:#fdf0da; color:#8a5b12 }}
  .tag.alerta {{ background:#fdf0da; color:#8a5b12 }}
  .feito {{ margin-left:auto; font-size:15px; color:#5d6b64; cursor:pointer;
            user-select:none; white-space:nowrap }}
  .feito input {{ width:17px; height:17px; vertical-align:-3px; margin-right:5px;
                  accent-color:var(--verde); cursor:pointer }}
  .bloco {{ margin-top:14px }}
  .bloco h3 {{ font-size:16px; margin:0 0 8px; color:#3d4d46; text-transform:uppercase;
               letter-spacing:.4px }}
  .bloco h3 small {{ text-transform:none; letter-spacing:0; font-weight:400;
                     color:#7d8b85 }}
  .bloco.depois {{ border-top:1px dashed var(--borda); padding-top:14px }}
  .msg {{ font-size:20px; line-height:1.65; margin:0 0 12px; padding:16px 18px;
          background:#fafbfa; border:1px solid var(--borda); border-radius:9px;
          white-space:pre-wrap }}
  .msg.pedido {{ background:#f7f5ff; border-color:#e0dbf5 }}
  .copiar {{ font:600 16px inherit; padding:10px 20px; border:0; border-radius:8px;
             background:var(--verde); color:#fff; cursor:pointer }}
  .copiar:hover {{ background:#188252 }}
  .copiar.ok {{ background:var(--roxo) }}
  @media (max-width:600px) {{ a.grupo {{ font-size:21px }} .msg {{ font-size:18px }} }}
</style>

<div class="topo">
  <h1>Grupos WhatsApp — autorizacao</h1>
  <span>{len(itens)} grupos · {vivos} convites vivos · {mortos} expirados</span>
  <span class="contador"><b id="feitos">0</b> / {len(itens)} autorizados</span>
</div>

<div class="wrap">
  <div class="aviso">
    <b>Nada é postado sem o admin liberar.</b> Passo 1 é a DM pro admin. Só depois
    que ele responder sim é que a mensagem do passo 2 vai no grupo — e quem posta é
    você. Marque <b>autorizado</b> aqui e me diga no chat quais números liberaram
    (ex.: <i>"1 ao 7 e o 12 liberaram"</i>) que eu gravo <code>autorizado=Sim</code>
    na planilha e monto a fila do W4.
  </div>
{''.join(cartoes)}
</div>

<script>
const CHAVE = "zafe-whats-{carimbo}";
const feitos = new Set(JSON.parse(localStorage.getItem(CHAVE) || "[]"));

function pintar() {{
  document.querySelectorAll(".card").forEach(c => {{
    const cx = c.querySelector("input[data-n]");
    cx.checked = feitos.has(cx.dataset.n);
    c.classList.toggle("ok2", cx.checked);
  }});
  document.getElementById("feitos").textContent = feitos.size;
}}

document.addEventListener("change", e => {{
  const cx = e.target.closest("input[data-n]");
  if (!cx) return;
  cx.checked ? feitos.add(cx.dataset.n) : feitos.delete(cx.dataset.n);
  localStorage.setItem(CHAVE, JSON.stringify([...feitos]));
  pintar();
}});

document.addEventListener("click", async e => {{
  const b = e.target.closest(".copiar");
  if (!b) return;
  const txt = b.parentElement.querySelector(".msg").textContent;
  await navigator.clipboard.writeText(txt);
  const antes = b.textContent;
  b.textContent = "Copiado";
  b.classList.add("ok");
  setTimeout(() => {{ b.textContent = antes; b.classList.remove("ok"); }}, 1400);
}});

pintar();
</script>
</html>"""

with open(destino, "w", encoding="utf-8") as fh:
    fh.write(doc)

print(f"\n{destino}")
print(f"vivos: {vivos} | expirados: {mortos} | nao checados: {len(itens)-vivos-mortos}")
for it in itens:
    if it["vivo"] is not True:
        print(f"  {it['n']:>2} linha {it['linha']} — {it['nome']} — {it['nome_real'] or 'expirado'}")
