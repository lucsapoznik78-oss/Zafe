"""Transforma a fila CSV do A4 numa pagina de trabalho pra copiar e colar."""
from __future__ import annotations

import csv, html, json, os, sys

CSV = sys.argv[1]
SAIDA = os.path.splitext(CSV)[0] + ".html"

with open(CSV, encoding="utf-8") as fh:
    linhas = list(csv.DictReader(fh))

cartoes = []
for r in linhas:
    handle = r["handle"].lstrip("@")
    dm = f"https://ig.me/m/{handle}"
    marca = ' data-revisar="1"' if r["revisar"] else ""
    aviso = (
        '<span class="tag revisar">revisar antes</span>' if r["revisar"] else ""
    )
    cartoes.append(f"""
<article class="card"{marca} id="c{r['n']}">
  <header>
    <span class="n">{r['n']}</span>
    <a class="dm" href="{html.escape(dm)}" target="_blank" rel="noopener">@{html.escape(handle)}</a>
    <span class="tag">{html.escape(r['nicho'])}</span>{aviso}
    <label class="feito"><input type="checkbox" data-n="{r['n']}"> enviado</label>
  </header>
  <p class="msg">{html.escape(r['mensagem'])}</p>
  <button class="copiar" type="button">Copiar mensagem</button>
</article>""")

dias = sorted({r["dia"] for r in linhas}, key=int)
blocos = []
for d in dias:
    doDia = [c for c, r in zip(cartoes, linhas) if r["dia"] == d]
    blocos.append(
        f'<section class="dia"><h2>Dia {d} <small>{len(doDia)} perfis</small></h2>'
        + "".join(doDia)
        + "</section>"
    )

doc = f"""<!doctype html>
<html lang="pt-br">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fila Instagram — Zafe</title>
<style>
  :root {{ --roxo:#7C5CFC; --azul:#0d6efd; --borda:#e6e3f0; }}
  * {{ box-sizing:border-box }}
  body {{ margin:0; padding:0 0 80px; background:#f6f5fa; color:#1a1a2e;
         font:19px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif }}
  .topo {{ position:sticky; top:0; z-index:5; background:var(--roxo); color:#fff;
           padding:18px 28px; display:flex; align-items:baseline; gap:18px;
           box-shadow:0 2px 12px rgba(0,0,0,.15) }}
  .topo h1 {{ margin:0; font-size:23px }}
  .topo .contador {{ margin-left:auto; font-size:17px; opacity:.95 }}
  .wrap {{ max-width:900px; margin:0 auto; padding:0 20px }}
  .dia h2 {{ font-size:26px; margin:38px 0 14px; padding-bottom:8px;
             border-bottom:3px solid var(--roxo) }}
  .dia h2 small {{ font-size:16px; font-weight:400; color:#6b6b83 }}
  .card {{ background:#fff; border:1px solid var(--borda); border-radius:12px;
           padding:20px 22px; margin-bottom:16px }}
  .card.ok {{ opacity:.45 }}
  .card[data-revisar] {{ border-left:5px solid #e8a33d }}
  .card header {{ display:flex; align-items:center; flex-wrap:wrap; gap:12px;
                  margin-bottom:12px }}
  .n {{ font-size:15px; color:#8b8ba7; font-variant-numeric:tabular-nums;
        min-width:34px }}
  a.dm {{ font-size:25px; font-weight:700; color:var(--azul);
          text-decoration:underline; text-underline-offset:3px }}
  a.dm:hover {{ color:#0a58ca }}
  .tag {{ font-size:14px; background:#efecff; color:#5b4bc4; padding:3px 10px;
          border-radius:20px }}
  .tag.revisar {{ background:#fdf0da; color:#8a5b12; font-weight:600 }}
  .feito {{ margin-left:auto; font-size:15px; color:#6b6b83; cursor:pointer;
            user-select:none; white-space:nowrap }}
  .feito input {{ width:17px; height:17px; vertical-align:-3px; margin-right:5px;
                  accent-color:var(--roxo); cursor:pointer }}
  .msg {{ font-size:20px; line-height:1.65; margin:0 0 14px; padding:16px 18px;
          background:#fbfaff; border:1px solid var(--borda); border-radius:9px;
          white-space:pre-wrap }}
  .copiar {{ font:600 16px inherit; padding:10px 20px; border:0; border-radius:8px;
             background:var(--roxo); color:#fff; cursor:pointer }}
  .copiar:hover {{ background:#6a4ae0 }}
  .copiar.ok {{ background:#1e9e63 }}
  @media (max-width:600px) {{ a.dm {{ font-size:21px }} .msg {{ font-size:18px }} }}
</style>

<div class="topo">
  <h1>Fila Instagram</h1>
  <span>{len(linhas)} perfis · o link azul abre a DM direto</span>
  <span class="contador"><b id="feitos">0</b> / {len(linhas)} enviados</span>
</div>

<div class="wrap">
{''.join(blocos)}
</div>

<script>
const CHAVE = "zafe-fila-{os.path.basename(CSV)}";
const feitos = new Set(JSON.parse(localStorage.getItem(CHAVE) || "[]"));

function pintar() {{
  document.querySelectorAll(".card").forEach(c => {{
    const cx = c.querySelector("input[data-n]");
    cx.checked = feitos.has(cx.dataset.n);
    c.classList.toggle("ok", cx.checked);
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
  await navigator.clipboard.writeText(
    b.closest(".card").querySelector(".msg").textContent);
  b.textContent = "Copiado";
  b.classList.add("ok");
  setTimeout(() => {{ b.textContent = "Copiar mensagem"; b.classList.remove("ok"); }}, 1400);
}});

pintar();
</script>
</html>"""

with open(SAIDA, "w", encoding="utf-8") as fh:
    fh.write(doc)
print(SAIDA)
