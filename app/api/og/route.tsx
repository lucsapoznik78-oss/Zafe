import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "edge";

const CATEGORY_LABELS: Record<string, string> = {
  politica: "Política",
  esportes: "Esportes",
  economia: "Economia",
  tecnologia: "Tecnologia",
  entretenimento: "Entretenimento",
  cultura: "Cultura",
  outros: "Outros",
};

const CATEGORY_COLOR: Record<string, string> = {
  politica: "#f87171",
  esportes: "#60a5fa",
  economia: "#facc15",
  tecnologia: "#a78bfa",
  entretenimento: "#f472b6",
  cultura: "#fb923c",
  outros: "#94a3b8",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") ?? "topico"; // "topico" | "desafio"

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const admin = createAdminClient();
  const table = type === "desafio" ? "desafios" : "topics";
  const statsTable = type === "desafio" ? "v_desafio_stats" : "v_topic_stats";
  const statsKey = type === "desafio" ? "desafio_id" : "topic_id";

  const [{ data: topic }, { data: stats }] = await Promise.all([
    admin.from(table).select("title, category, closes_at").eq("id", id).single(),
    admin.from(statsTable).select("prob_sim, prob_nao, total_volume").eq(statsKey, id).single(),
  ]);

  const title = topic?.title ?? "Evento Zafe";
  const category = topic?.category ?? "outros";
  const probSim = Math.round((stats?.prob_sim ?? 0.5) * 100);
  const probNao = 100 - probSim;
  const volume = parseFloat(stats?.total_volume ?? "0");
  const catLabel = CATEGORY_LABELS[category] ?? "Outros";
  const catColor = CATEGORY_COLOR[category] ?? "#94a3b8";
  const isDesafio = type === "desafio";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#09090b",
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
            {isDesafio && (
              <div
                style={{
                  background: "#86efac22",
                  color: "#86efac",
                  padding: "6px 14px",
                  borderRadius: "99px",
                  fontSize: "18px",
                  fontWeight: 600,
                }}
              >
                Desafio
              </div>
            )}
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#86efac", letterSpacing: "-1px" }}>
            Zafe
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 60 ? "44px" : "52px",
            fontWeight: 800,
            color: "#ffffff",
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
                background: "#86efac",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: "#000",
              }}
            />
            <div
              style={{
                flex: 1,
                background: "#f87171",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: "#000",
              }}
            />
          </div>

          {/* Labels */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "32px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "16px", color: "#86efac", fontWeight: 600 }}>SIM</span>
                <span style={{ fontSize: "40px", fontWeight: 800, color: "#86efac", lineHeight: 1 }}>
                  {probSim}%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "16px", color: "#f87171", fontWeight: 600 }}>NÃO</span>
                <span style={{ fontSize: "40px", fontWeight: 800, color: "#f87171", lineHeight: 1 }}>
                  {probNao}%
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: "14px", color: "#71717a" }}>Volume total</span>
              <span style={{ fontSize: "28px", fontWeight: 700, color: "#a1a1aa" }}>
                Z$ {new Intl.NumberFormat("pt-BR").format(Math.round(volume))}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "16px", color: "#52525b" }}>zafe-rho.vercel.app</span>
          <span style={{ fontSize: "16px", color: "#52525b" }}>Mercado de previsão brasileiro</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
