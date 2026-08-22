// Gera posters PNG dos .glb usando puppeteer + model-viewer offline.
// Sobe um static server em /public, abre uma page com <model-viewer>, aguarda
// o evento 'load', screenshot da área do viewer, salva PNG.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = "/Users/mac/Downloads/zafe";
const OUT_2D = path.join(ROOT, "public/avatares/kit/2d");
const GLB_DIR = path.join(ROOT, "public/avatares/kit/3d");
// UMD build (não-module) pra `<script src>` funcionar sem type="module"
const MV_JS = path.join(ROOT, "node_modules/@google/model-viewer/dist/model-viewer-umd.min.js");

if (!fs.existsSync(OUT_2D)) fs.mkdirSync(OUT_2D, { recursive: true });

// static server serve tudo em /public + /mv.js + /viewer.html?glb=…
const server = http.createServer((req, res) => {
  const [rawUrl, query = ""] = req.url.split("?");
  const url = decodeURIComponent(rawUrl);
  if (url === "/viewer.html") {
    const params = new URLSearchParams(query);
    const glb = params.get("glb") || "";
    const html = `<!doctype html><html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#0F1012;width:100vw;height:100vh;overflow:hidden;}
model-viewer{width:100vw;height:100vh;background:#0F1012;}</style>
<script src="/mv.js" onerror="document.title='MV_LOAD_ERROR'"></script>
</head><body>
<model-viewer id="mv" src="${glb}" exposure="1.1" shadow-intensity="1" interaction-prompt="none"></model-viewer>
<script>window.__ready__ = true;</script>
</body></html>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  let filePath;
  if (url === "/mv.js") filePath = MV_JS;
  else filePath = path.join(ROOT, "public", url);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  const ext = path.extname(filePath);
  const mime = ext === ".glb" ? "model/gltf-binary" : ext === ".js" ? "application/javascript" : "application/octet-stream";
  res.writeHead(200, { "content-type": mime, "cache-control": "no-cache" });
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
console.log(`Server on :${port}`);

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.log("Uso: node gen_posters.mjs hyper1 hyper2 raro1 raro2 …");
  process.exit(1);
}

// WebGL headless: precisa do --headless=new + ANGLE swiftshader como back-end.
// (headless clássico do Chrome desativa GPU e model-viewer/three.js dependem
// de contexto WebGL real.)
const browser = await puppeteer.launch({
  headless: "shell",
  args: [
    "--no-sandbox",
    "--headless=new",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-web-security",
  ],
});
const page = await browser.newPage();
page.on("console", (msg) => console.log(`  [browser ${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => console.log(`  [pageerror] ${err.message}`));
page.on("requestfailed", (r) => console.log(`  [reqfail] ${r.url()} ${r.failure()?.errorText}`));

// 512×683 = mesmo aspect do card (3/4)
const W = 512, H = 683;
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

for (const name of targets) {
  const glbUrl = `/avatares/kit/3d/${name}.glb`;
  const pageUrl = `http://127.0.0.1:${port}/viewer.html?glb=${encodeURIComponent(glbUrl)}`;
  await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 60000 });
  // aguarda o custom element estar definido
  await page.waitForFunction(() => customElements.get("model-viewer") !== undefined, { timeout: 15000 });
  try {
    await page.evaluate(() => new Promise((resolve, reject) => {
      const mv = document.getElementById("mv");
      let done = false;
      const t = setTimeout(() => {
        if (!done) reject(new Error(`timeout load (mv.loaded=${mv.loaded} src=${mv.src})`));
      }, 60000);
      if (mv.loaded) { done = true; clearTimeout(t); return resolve(); }
      mv.addEventListener("load", () => { done = true; clearTimeout(t); resolve(); }, { once: true });
      mv.addEventListener("error", (e) => { done = true; clearTimeout(t); reject(new Error("mv error: " + JSON.stringify(e?.detail))); }, { once: true });
    }));
    // pequeno delay pra render frame final
    await new Promise((r) => setTimeout(r, 600));
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    continue;
  }
  const outPath = path.join(OUT_2D, `${name}.png`);
  await page.screenshot({ path: outPath, type: "png", omitBackground: false });
  const sz = fs.statSync(outPath).size;
  console.log(`  ✓ ${name}.png (${(sz / 1024).toFixed(0)} KB)`);
}

await browser.close();
server.close();
console.log("done");
