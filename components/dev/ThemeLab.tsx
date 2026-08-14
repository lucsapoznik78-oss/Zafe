"use client";

import { useEffect, useState } from "react";

/**
 * Seletor de paleta para avaliação — só existe em preview.
 *
 * Troca `data-theme` no <html> ao vivo, para comparar as candidatas em cima de
 * dados reais em vez de mockup. Não escreve em lugar nenhum além do
 * localStorage do próprio navegador.
 *
 * Aparece apenas quando NEXT_PUBLIC_THEME_LAB=1. Essa variável está setada só
 * no ambiente Preview da Vercel; em produção o componente devolve null.
 *
 * O estilo é inline e neutro de propósito: se o painel usasse os tokens, ele
 * mudaria de cor junto com o tema e você perderia a referência fixa.
 */

const TEMAS = [
  ["claro", "claro · azul-royal"],
  ["papel", "papel · petróleo"],
  ["grafite", "grafite · mono"],
  ["campo", "campo · lima"],
  ["arquibancada", "arquibancada"],
  ["legacy", "legacy (roxo)"],
] as const;

const CHAVE = "zafe_theme_lab";

export default function ThemeLab() {
  const [atual, setAtual] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE);
    const daUrl = new URLSearchParams(location.search).get("tema");
    const escolhido = daUrl ?? salvo;
    if (escolhido) document.documentElement.dataset.theme = escolhido;
    setAtual(escolhido ?? document.documentElement.dataset.theme ?? null);
  }, []);

  if (process.env.NEXT_PUBLIC_THEME_LAB !== "1") return null;

  const trocar = (t: string) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(CHAVE, t);
    setAtual(t);
  };

  return (
    <div
      style={{
        position: "fixed", right: 12, bottom: 12, zIndex: 2147483647,
        fontFamily: "ui-monospace, monospace", fontSize: 11,
      }}
    >
      {aberto && (
        <div
          style={{
            marginBottom: 6, padding: 6, borderRadius: 10,
            background: "#101114", border: "1px solid #33363D",
            boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 170,
          }}
        >
          {TEMAS.map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => trocar(id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "6px 8px", borderRadius: 6, border: "none",
                cursor: "pointer", marginBottom: 2,
                background: atual === id ? "#F0F1F3" : "transparent",
                color: atual === id ? "#101114" : "#C9CCD3",
                fontWeight: atual === id ? 700 : 400,
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setAberto((v) => !v)}
        style={{
          padding: "7px 12px", borderRadius: 999, cursor: "pointer",
          background: "#101114", color: "#F0F1F3",
          border: "1px solid #33363D", boxShadow: "0 4px 14px rgba(0,0,0,.4)",
        }}
      >
        tema: {atual ?? "…"}
      </button>
    </div>
  );
}
