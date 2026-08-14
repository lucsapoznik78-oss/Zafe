import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "edge";

const CATEGORY_LABELS: Record<string, string> = {
  esportes: "Esportes",
  esports: "e-Sports",
};

/**
 * Paleta arquibancada, chapada. Satori (next/og) renderiza fora do documento:
 * não existe :root, então `var(--accent)` não resolve. Este arquivo NÃO segue o
 * interruptor `data-theme` — está anotado em ROLLBACK.md.
 */
const C = {
  bg:        "#0D1B2A", // --bg
  brand:     "#FFC53D", // --brand
  text:      "#F2F4F8", // --text
  textSec:   "#93A5BC", // --text-secondary
  textMuted: "#8494AC", // --text-muted
  onAccent:  "#0D1B2A", // --text-on-accent
  yes:       "#2E9E63", // --yes  (preenchimento)
  yesText:   "#3FBE7B", // --yes-text
  no:        "#E5484D", // --no   (preenchimento)
  noText:    "#EE5F63", // --no-text
};

// Chip de categoria: só há duas. Sem laranja nem ciano na paleta nova, então
// vira acento vs. verde — dois tons que já existem e continuam distinguíveis.
const CATEGORY_COLOR: Record<string, string> = {
  esportes: C.brand,
  esports: C.yesText,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const admin = createAdminClient();

  const [{ data: topic }, { data: stats }] = await Promise.all([
    admin.from("topics").select("title, category, closes_at").eq("id", id).single(),
    admin.from("v_topic_stats").select("prob_sim, prob_nao, total_volume").eq("topic_id", id).single(),
  ]);

  const title = topic?.title ?? "Evento Zafe";
  const category = topic?.category ?? "outros";
  const probSim = Math.round((stats?.prob_sim ?? 0.5) * 100);
  const probNao = 100 - probSim;
  const volume = parseFloat(stats?.total_volume ?? "0");
  const catLabel = CATEGORY_LABELS[category] ?? "Outros";
  const catColor = CATEGORY_COLOR[category] ?? C.textSec;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                background: catColor + "22",
                color: catColor,
                padding: "6px 14px",
                borderRadius: "99px",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              {catLabel}
            </div>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: C.brand, letterSpacing: "-1px" }}>
            Zafe
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 60 ? "44px" : "52px",
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.2,
            maxWidth: "900px",
          }}
        >
          {title}
        </div>

        {/* Probability bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", borderRadius: "12px", overflow: "hidden", height: "28px" }}>
            <div
              style={{
                width: `${probSim}%`,
                background: C.yes,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: C.onAccent,
              }}
            />
            <div
              style={{
                flex: 1,
                background: C.no,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: C.onAccent,
              }}
            />
          </div>

          {/* Labels */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "32px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "16px", color: C.yesText, fontWeight: 600 }}>SIM</span>
                <span style={{ fontSize: "40px", fontWeight: 800, color: C.yesText, lineHeight: 1 }}>
                  {probSim}%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "16px", color: C.noText, fontWeight: 600 }}>NÃO</span>
                <span style={{ fontSize: "40px", fontWeight: 800, color: C.noText, lineHeight: 1 }}>
                  {probNao}%
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: "14px", color: C.textMuted }}>Volume total</span>
              <span style={{ fontSize: "28px", fontWeight: 700, color: C.textSec }}>
                Z$ {new Intl.NumberFormat("pt-BR").format(Math.round(volume))}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "16px", color: C.textMuted }}>zafe.app.br</span>
          <span style={{ fontSize: "16px", color: C.textMuted }}>Liga de previsões brasileira</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
