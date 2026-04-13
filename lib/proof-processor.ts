/**
 * Proof Processor — prepara provas para avaliação pelo Claude
 *
 * O servidor é o intermediário: baixa conteúdo, converte imagens para base64,
 * extrai texto de páginas, chama Google Vision — Claude só julga, nunca busca.
 *
 * Tipos suportados:
 *   link / resultado_oficial → fetch do HTML → texto limpo
 *   foto (URL direta, Imgur, Drive, Dropbox) → base64 + Vision (Web + Landmark)
 *   foto (upload base64 direto) → já chegou como base64
 *   video (YouTube) → thumbnail + título via oEmbed
 *   video (outro link) → fetch texto da página
 */

const VISION_KEY = process.env.GOOGLE_VISION_API_KEY;
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`;
const MAX_TEXT_CHARS = 5000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const FETCH_TIMEOUT_MS = 15_000;

export interface ProcessedProof {
  summary: string;
  images?: { b64: string; mimeType: string }[];
  visionSummary?: string;
  canVerify: boolean;
  method: string;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZafeVerifier/1.0)",
        "Accept": "text/html,application/xhtml+xml,text/plain",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) return null;
    return stripHtml(await res.text());
  } catch {
    return null;
  }
}

async function fetchImageBase64(url: string): Promise<{ b64: string; mimeType: string } | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZafeVerifier/1.0)" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      // Still process — Claude handles up to ~5MB
    }
    return {
      b64: Buffer.from(buf).toString("base64"),
      mimeType: ct.split(";")[0].trim(),
    };
  } catch {
    return null;
  }
}

function driveDirectUrl(url: string): string | null {
  // https://drive.google.com/file/d/{ID}/view → export download
  const m1 = url.match(/\/file\/d\/([^/?#]+)/);
  if (m1) return `https://drive.google.com/uc?export=download&id=${m1[1]}`;
  // https://drive.google.com/open?id={ID}
  const m2 = url.match(/[?&]id=([^&]+)/);
  if (m2) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
  return null;
}

function dropboxDirectUrl(url: string): string {
  return url
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace("?dl=0", "?dl=1")
    .replace("?raw=0", "?raw=1");
}

function imgurDirectUrl(url: string): string {
  // Gallery link → direct image
  if (!url.match(/\.(jpg|jpeg|png|gif|webp|mp4)$/i)) {
    const id = url.split("/").pop()?.split(".")[0];
    if (id && !id.includes("gallery")) return `https://i.imgur.com/${id}.jpg`;
  }
  return url;
}

// ── Google Vision ─────────────────────────────────────────────────────────────

async function callVision(
  b64: string,
  features: { type: string; maxResults?: number }[]
): Promise<any | null> {
  if (!VISION_KEY) return null;
  try {
    const res = await fetchWithTimeout(VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image: { content: b64 }, features }],
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseVisionResult(visionJson: any): string {
  const r = visionJson?.responses?.[0];
  if (!r) return "";
  const parts: string[] = [];

  // Web Detection — verifica se imagem existe na web
  const web = r.webDetection;
  if (web) {
    const entities = (web.webEntities ?? [])
      .filter((e: any) => e.score > 0.5 && e.description)
      .slice(0, 6)
      .map((e: any) => e.description);
    if (entities.length) parts.push(`Entidades web: ${entities.join(", ")}`);

    const matching = web.pagesWithMatchingImages?.length ?? 0;
    if (matching > 0) parts.push(`Imagem encontrada em ${matching} páginas web`);
    else parts.push("Imagem NÃO encontrada em outras páginas web (pode ser inédita ou privada)");

    const bestGuess = web.bestGuessLabels?.[0]?.label;
    if (bestGuess) parts.push(`Melhor identificação: "${bestGuess}"`);
  }

  // Landmark Detection — localização física
  const landmarks = r.landmarkAnnotations ?? [];
  if (landmarks.length > 0) {
    const names = landmarks.map((l: any) => `${l.description} (${(l.score * 100).toFixed(0)}%)`).join(", ");
    parts.push(`Local identificado: ${names}`);
    const loc = landmarks[0]?.locations?.[0]?.latLng;
    if (loc) parts.push(`Coordenadas: ${loc.latitude?.toFixed(4)}, ${loc.longitude?.toFixed(4)}`);
  }

  // OCR / Texto na imagem
  const text = r.textAnnotations?.[0]?.description?.trim().slice(0, 400);
  if (text) parts.push(`Texto na imagem: "${text}"`);

  // Safe search
  const safe = r.safeSearchAnnotation;
  if (safe?.adult === "VERY_LIKELY" || safe?.adult === "LIKELY") {
    parts.push("AVISO: conteúdo adulto detectado");
  }

  return parts.join("\n");
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processProof(
  proofUrl: string,
  proofType: string,
  rawBase64?: string // se o usuário fez upload direto
): Promise<ProcessedProof> {
  const url = proofUrl.trim();

  // ── Upload direto (base64 já vem do frontend) ──────────────────
  if (rawBase64) {
    const mimeMatch = rawBase64.match(/^data:(image\/[^;]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? "image/jpeg";
    const b64 = rawBase64.replace(/^data:[^;]+;base64,/, "");

    const visionJson = await callVision(b64, [
      { type: "WEB_DETECTION", maxResults: 10 },
      { type: "LANDMARK_DETECTION", maxResults: 5 },
      { type: "TEXT_DETECTION", maxResults: 1 },
    ]);
    const visionSummary = visionJson ? parseVisionResult(visionJson) : "";

    return {
      summary: "Imagem enviada via upload direto.",
      images: [{ b64, mimeType }],
      visionSummary,
      canVerify: true,
      method: "upload_direto",
    };
  }

  // ── Link de notícia ou resultado oficial ───────────────────────
  if (proofType === "link" || proofType === "resultado_oficial") {
    const text = await fetchText(url);
    if (!text) {
      return {
        summary: `Não foi possível acessar a URL: ${url}`,
        canVerify: false,
        method: "link_fetch",
        error: "URL inacessível ou retornou erro HTTP",
      };
    }
    return {
      summary: `Conteúdo da página (${url}):\n\n${text}`,
      canVerify: true,
      method: "link_fetch",
    };
  }

  // ── Foto / print ───────────────────────────────────────────────
  if (proofType === "foto") {
    let imageUrl = url;
    let method = "foto_url";

    if (url.includes("drive.google.com")) {
      imageUrl = driveDirectUrl(url) ?? url;
      method = "foto_gdrive";
    } else if (url.includes("dropbox.com")) {
      imageUrl = dropboxDirectUrl(url);
      method = "foto_dropbox";
    } else if (url.includes("imgur.com")) {
      imageUrl = imgurDirectUrl(url);
      method = "foto_imgur";
    }

    const img = await fetchImageBase64(imageUrl);
    if (!img) {
      // Tenta como link de texto como fallback
      const text = await fetchText(imageUrl);
      if (text) {
        return { summary: `Página da imagem: ${text}`, canVerify: true, method: "foto_fallback_text" };
      }
      return {
        summary: `Não foi possível baixar a imagem de: ${imageUrl}`,
        canVerify: false,
        method,
        error: "Imagem inacessível — verifique se o link é público",
      };
    }

    // Google Vision: Web Detection + Landmark + OCR
    const visionJson = await callVision(img.b64, [
      { type: "WEB_DETECTION", maxResults: 10 },
      { type: "LANDMARK_DETECTION", maxResults: 5 },
      { type: "TEXT_DETECTION", maxResults: 1 },
    ]);
    const visionSummary = visionJson ? parseVisionResult(visionJson) : "";

    return {
      summary: `Imagem baixada de: ${imageUrl}`,
      images: [img],
      visionSummary,
      canVerify: true,
      method,
    };
  }

  // ── Vídeo ──────────────────────────────────────────────────────
  if (proofType === "video") {
    // YouTube: thumbnail + título
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/#]+)/);
    if (ytMatch) {
      const videoId = ytMatch[1];

      // Título via oEmbed
      let title = "";
      try {
        const oe = await fetchWithTimeout(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (oe.ok) title = (await oe.json()).title ?? "";
      } catch {}

      // Thumbnail maxres → hq fallback
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const thumbFallback = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      let img = await fetchImageBase64(thumbUrl);
      if (!img) img = await fetchImageBase64(thumbFallback);

      // Google Vision no thumbnail
      let visionSummary = "";
      if (img) {
        const vJson = await callVision(img.b64, [
          { type: "WEB_DETECTION", maxResults: 5 },
          { type: "TEXT_DETECTION", maxResults: 1 },
        ]);
        if (vJson) visionSummary = parseVisionResult(vJson);
      }

      return {
        summary: `Vídeo YouTube: "${title}"\nURL: ${url}\nID: ${videoId}`,
        images: img ? [img] : undefined,
        visionSummary,
        canVerify: true,
        method: "video_youtube",
      };
    }

    // Qualquer outro vídeo: fetch texto da página
    const text = await fetchText(url);
    return {
      summary: text
        ? `Página do vídeo (${url}):\n\n${text}`
        : `Não foi possível acessar o vídeo: ${url}`,
      canVerify: !!text,
      method: "video_page",
      error: text ? undefined : "Vídeo inacessível",
    };
  }

  // Fallback genérico
  const text = await fetchText(url);
  return {
    summary: text ? `Conteúdo de ${url}:\n\n${text}` : `URL inacessível: ${url}`,
    canVerify: !!text,
    method: "generic",
    error: text ? undefined : "URL inacessível",
  };
}
