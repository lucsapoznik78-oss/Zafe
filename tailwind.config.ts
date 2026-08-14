import type { Config } from "tailwindcss";

/**
 * As cores NÃO moram aqui. Moram em `app/globals.css`, como canais RGB sob
 * `:root[data-theme="legacy"]` e `:root[data-theme="arquibancada"]`.
 *
 * Este arquivo só aponta para elas. Trocar o `data-theme` no <html> troca o app
 * inteiro — é o que torna o rollback de cor um passo só. Não voltar a cravar
 * hex aqui: hex neste arquivo é invisível ao interruptor de tema.
 */

/**
 * `token("--c-accent")` → `rgb(var(--c-accent) / <opacidade>)`.
 *
 * A forma de função (e não a string com `<alpha-value>`) é necessária para
 * distinguir "sem modificador" de "com modificador": só assim `border-border`
 * pode render 10% no tema novo e 100% no antigo, enquanto `border-border/40`
 * continua respeitando o 40% pedido no componente.
 */
const token = (channels: string, defaultAlpha = "1") =>
  // O cast é necessário: o Tailwind aceita função de cor em runtime, mas o tipo
  // `RecursiveKeyValuePair<string, string>` do `Config` só admite string.
  (({ opacityValue }: { opacityValue?: string } = {}) =>
    `rgb(var(${channels}) / ${opacityValue ?? defaultAlpha})`) as unknown as string;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token("--c-bg"),
        foreground: token("--c-text"),
        primary: {
          DEFAULT: token("--c-accent"),
          foreground: token("--c-text-on-accent"),
          light: token("--c-accent-hover"),
          dark: token("--c-accent-press"),
        },
        brand: {
          DEFAULT: token("--c-brand"),
          hover: token("--c-accent-hover"),
          active: token("--c-accent-press"),
          text: token("--c-accent-text"),
          bg: token("--c-accent-surface"),
          border: token("--c-accent-border"),
          onLight: token("--c-brand-on-light"),
        },
        secondary: {
          DEFAULT: token("--c-surface-2"),
          foreground: token("--c-text"),
        },
        muted: {
          DEFAULT: token("--c-surface-2"),
          foreground: token("--c-text-secondary"),
        },
        accent: {
          DEFAULT: token("--c-accent"),
          foreground: token("--c-text-on-accent"),
        },
        border: token("--c-line", "var(--line-a)"),
        input: token("--c-surface-2"),
        card: {
          DEFAULT: token("--c-surface"),
          foreground: token("--c-text"),
        },
        popover: {
          DEFAULT: token("--c-surface-3"),
          foreground: token("--c-text"),
        },
        destructive: {
          DEFAULT: token("--c-danger"),
          foreground: token("--c-text-on-accent"),
        },
        sim: { DEFAULT: token("--c-yes"), text: token("--c-yes-text") },
        nao: { DEFAULT: token("--c-no"), text: token("--c-no-text") },
        prize: { DEFAULT: token("--c-prize"), text: token("--c-prize-text") },
        success: { DEFAULT: token("--c-success"), text: token("--c-success") },
        live: token("--c-live"),
        surface: {
          0: token("--c-bg"),
          1: token("--c-surface"),
          2: token("--c-surface-2"),
          3: token("--c-surface-3"),
        },
        line: {
          DEFAULT: token("--c-line", "var(--line-a)"),
          strong: token("--c-line-strong", "var(--line-a)"),
        },
        ink: {
          DEFAULT: token("--c-text"),
          muted: token("--c-text-secondary"),
          faint: token("--c-text-muted"),
        },
        ring: token("--c-accent"),
      },
      /**
       * `text-sim` / `text-nao` (268 usos) precisam do tom claro: #2E9E63 e
       * #E5484D funcionam como preenchimento, mas a paleta manda usar #3FBE7B /
       * #EE5F63 quando viram texto. Separar em `textColor` resolve isso sem
       * tocar em nenhum componente — `bg-sim` continua no tom de preenchimento.
       */
      textColor: {
        sim: { DEFAULT: token("--c-yes-text"), text: token("--c-yes-text") },
        nao: { DEFAULT: token("--c-no-text"), text: token("--c-no-text") },
        /**
         * Mesma razão para os estados de sistema: `text-destructive` no tom de
         * preenchimento (#E5484D) dá 4.44:1 sobre o fundo — reprova. O tom de
         * texto (#EE5F63) dá 5.34:1. `bg-destructive` fica no tom fechado.
         */
        destructive: { DEFAULT: token("--c-no-text"), foreground: token("--c-text-on-accent") },
        success: { DEFAULT: token("--c-yes-text"), text: token("--c-yes-text") },
      },
      boxShadow: {
        base: "var(--shadow-base)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      keyframes: {
        "confetti-fall": {
          "0%":   { transform: "translateY(-10px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(350px) rotate(720deg)", opacity: "0" },
        },
        "shimmer-sweep": {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "odds-pulse-up": {
          "0%":   { backgroundColor: "rgb(var(--c-yes) / 0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
        "odds-pulse-down": {
          "0%":   { backgroundColor: "rgb(var(--c-no) / 0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
        "shimmer-sweep": "shimmer-sweep 1.6s ease-in-out 0.3s 2",
        "odds-pulse-up": "odds-pulse-up 1.2s ease-out",
        "odds-pulse-down": "odds-pulse-down 1.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
