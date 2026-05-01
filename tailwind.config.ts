import type { Config } from "tailwindcss";

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
        background: "#000000",
        foreground: "#ffffff",
        primary: {
          DEFAULT: "#86efac",
          foreground: "#000000",
          light: "#bbf7d0",
          dark: "#4ade80",
        },
        secondary: {
          DEFAULT: "#111111",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#1a1a1a",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "#86efac",
          foreground: "#000000",
        },
        border: "#222222",
        input: "#1a1a1a",
        card: {
          DEFAULT: "#111111",
          foreground: "#ffffff",
        },
        popover: {
          DEFAULT: "#111111",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        sim: "#86efac",
        nao: "#f87171",
        ring: "#86efac",
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
      },
      animation: {
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
